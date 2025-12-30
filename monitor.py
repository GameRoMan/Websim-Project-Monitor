import asyncio
import logging
import aiohttp

from .project_revision import process_project_revision

from .cookie_manager import refresh_cookies, is_jwt_expired

from .config_manager import load_config

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("monitor")


project_id = None
base_url = None
model_id = None
additional_note = None
cookies = None

# Additional Items
require_like_project = None
require_tip_credit = None
minimum_tip_amount = None

# text to check for and send
loc_auto_response_prefix = None
loc_auto_response_create_revision = None
loc_auto_response_require_likes = None
loc_auto_response_require_tip = None


def load_config_items():
    global \
        project_id, \
        base_url, \
        model_id, \
        additional_note, \
        cookies, \
        require_like_project, \
        require_tip_credit, \
        minimum_tip_amount
    global \
        loc_auto_response_prefix, \
        loc_auto_response_create_revision, \
        loc_auto_response_require_likes, \
        loc_auto_response_require_tip
    # Load Config Items
    project_id = config.get("project_id")
    base_url = config.get("base_url", "http://localhost")
    model_id = config.get("model_id", "gpt-5-mini")
    additional_note = config.get("additional_note", "")
    cookies = config.get("cookies", {})

    # Additional Items
    require_like_project = config.get("require_like_project", False)
    require_tip_credit = config.get("require_tip_credit", False)
    print(type(require_tip_credit))
    minimum_tip_amount = config.get("minimum_tip_amount", 0)

    # text to check for and send
    loc_auto_response_prefix = config.get("auto_response_prefix")
    loc_auto_response_create_revision = loc_auto_response_prefix + config.get(
        "auto_response_create_revision"
    )
    loc_auto_response_require_likes = loc_auto_response_prefix + config.get(
        "auto_response_require_likes"
    )
    loc_auto_response_require_tip = loc_auto_response_prefix + config.get(
        "auto_response_require_tip"
    ).replace("<$MINIMUM_TIP_COUNT>", str(minimum_tip_amount))


async def check_comment_has_auto_response(session, owner_id, comment_id):
    url_replies = (
        f"{base_url}/api/v1/projects/{project_id}/comments/{comment_id}/replies"
    )
    async with session.get(url_replies) as resp:
        resp_json = await resp.json()

        if is_jwt_expired(resp_json):
            await refresh_and_update_cookies(base_url, cookies)
            return True

        elif resp.status != 200:
            logger.error(
                f"Fetch revisions failed: {resp.status}, Body: {await resp.text()}"
            )
            return True

        rep_data = resp_json

        already_replied = any(
            r["comment"]["author"]["id"] == owner_id
            and loc_auto_response_prefix in r["comment"]["raw_content"]
            for r in rep_data["comments"]["data"]
        )

        if already_replied:
            logger.info("[Monitor] Found auto reply headers. Skipping.")
            return True
    return False


async def refresh_and_update_cookies(url, cookies):
    new_cookies = await refresh_cookies(url, cookies)
    if new_cookies:
        cookies.update(new_cookies)


async def check_and_respond(project_id: str, config: dict):
    try:
        load_config_items()

        headers = {"Content-Type": "application/json"}

        logger.info(f"[Monitor] Checking project {project_id}")

        async with aiohttp.ClientSession(cookies=cookies) as session:
            # Step 1: Fetch latest revisions
            url_revisions = f"{base_url}/api/v1/projects/{project_id}/revisions"
            async with session.get(url_revisions) as resp:
                resp_json = await resp.json()

                if is_jwt_expired(resp_json):
                    await refresh_and_update_cookies(base_url, cookies)
                    return

                elif resp.status != 200:
                    logger.error(
                        f"Fetch revisions failed: {resp.status}, Body: {await resp.text()}"
                    )
                    return

                rev_data = resp_json

                first = (
                    rev_data["revisions"]["data"][0]
                    if rev_data["revisions"]["data"]
                    else None
                )

                if not first:
                    logger.info("[Monitor] No revisions found")
                    return

                logger.info(f"[Monitor] site.state = {first['site']['state']}")

                if first["site"]["state"] != "done":
                    logger.info("[Monitor] Site not yet ready. Skipping execution.")
                    return

                owner_id = first["project_revision"]["created_by"]["id"]

            # Step 2: Fetch comments
            url_comments = f"{base_url}/api/v1/projects/{project_id}/comments"
            tipped_amount = -1  # Default for no tip

            async with session.get(url_comments) as resp:
                resp_json = await resp.json()

                if is_jwt_expired(resp_json):
                    await refresh_and_update_cookies(base_url, cookies)
                    return

                elif resp.status != 200:
                    logger.error(
                        f"Fetch revisions failed: {resp.status}, Body: {await resp.text()}"
                    )
                    return

                comm_data = resp_json

                entry = {}

                if not comm_data["comments"]["data"]:
                    logger.info("[Monitor] No comments to process")
                    return

                for comment in comm_data["comments"]["data"]:
                    if comment["comment"]["pinned"]:  # Skip pinned comments
                        continue
                    elif await check_comment_has_auto_response(
                        session, owner_id, comment["comment"]["id"]
                    ):  # last comment before replied
                        break
                    else:
                        entry = comment

                if entry == {}:
                    logger.info("[Monitor] No comments to process")
                    return

                comment = entry["comment"]
                comment_id = comment["id"]
                raw_content = comment["raw_content"]
                author = comment["author"]
                if (
                    comment["card_data"]
                    and comment["card_data"]["type"] == "tip_comment"
                ):
                    tipped_amount = comment["card_data"]["credits_spent"]

                logger.info(
                    f'[Monitor] First comment by {author["username"]}: "{raw_content}"'
                )

            # Step 3: Check replies for existing auto response
            url_replies = (
                f"{base_url}/api/v1/projects/{project_id}/comments/{comment_id}/replies"
            )
            async with session.get(url_replies) as resp:
                resp_json = await resp.json()

                if is_jwt_expired(resp_json):
                    await refresh_and_update_cookies(base_url, cookies)
                    return

                elif resp.status != 200:
                    logger.error(
                        f"Fetch revisions failed: {resp.status}, Body: {await resp.text()}"
                    )
                    return

                rep_data = resp_json

                already_replied = any(
                    r["comment"]["author"]["id"] == owner_id
                    and loc_auto_response_prefix in r["comment"]["raw_content"]
                    for r in rep_data["comments"]["data"]
                )

                if already_replied:
                    logger.info("[Monitor] Found auto reply headers. Skipping.")
                    return

            # Step 4: Check if author has liked the project if required
            # Going through the pages is usually not required
            if require_tip_credit:
                if not tipped_amount >= minimum_tip_amount:
                    logger.info(
                        "[Monitor] Did not tip or tipped too little. Sending Reminder."
                    )
                    await session.post(
                        url_comments,
                        headers=headers,
                        json={
                            "content": loc_auto_response_require_tip,
                            "parent_comment_id": comment_id,
                        },
                    )
                    logger.info("[Monitor] Reminder Sent.")
                    return

            if require_like_project:
                url_likes = (
                    f"{base_url}/api/v1/users/{author['username']}/likes?first=100"
                )
                async with session.get(url_likes) as resp:
                    resp_json = await resp.json()

                    if is_jwt_expired(resp_json):
                        await refresh_and_update_cookies(base_url, cookies)
                        return

                    elif resp.status != 200:
                        logger.error(
                            f"Fetch revisions failed: {resp.status}, Body: {await resp.text()}"
                        )
                        return

                    like_data = resp_json

                    likes_list = []

                    for l in like_data.get("likes", {}).get("data", [{}]):
                        try:
                            likes_list.append(
                                l.get("project", {}).get("id", "No ID") == project_id
                            )  # Some like items have broken projects
                        except:
                            continue

                    has_liked = any(likes_list)

                    if not has_liked:
                        logger.info(
                            "[Monitor] Author has not liked the project. Sending reminder."
                        )
                        await session.post(
                            url_comments,
                            headers=headers,
                            json={
                                "content": loc_auto_response_require_likes,
                                "parent_comment_id": comment_id,
                            },
                        )
                        logger.info("[Monitor] Like-reminder posted.")
                        return
            else:
                logger.info("[Monitor] Checking likes not required.")

            # Step 5: Create new revision with safety note
            logger.info("[Monitor] Creating new revision...")
            revision = await process_project_revision(
                project_id,
                raw_content + additional_note,
                model_id=model_id,
                base_url=base_url,
                cookies=cookies,
            )
            logger.info(
                f"[Monitor] Revision created: ID={revision['revision_id']}, version={revision['version']}"
            )

            # Step 6: Post confirmation comment
            await session.post(
                url_comments,
                headers=headers,
                json={
                    "content": loc_auto_response_create_revision,
                    "parent_comment_id": comment_id,
                },
            )
            logger.info("[Monitor] Confirmation comment posted.")

    except Exception as e:
        logger.error(f"[Monitor] Error: {e}", exc_info=True)


def monitor_project(config: dict, *, interval_sec: int = 10, **kwargs):
    project_id = config.get("project_id")
    load_config_items()

    async def runner():
        while True:
            await check_and_respond(project_id, config)
            await asyncio.sleep(interval_sec)

    logger.info(f"[Monitor] Starting automatic monitor for project {project_id}")
    asyncio.run(runner())


if __name__ == "__main__":
    config = load_config()
    monitor_project(config, interval_sec=config.get("interval", 10))
