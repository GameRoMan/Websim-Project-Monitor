import { processProjectRevision } from "./project-revision";

import { refreshCookies, is_jwt_expired, cookie } from "./cookie-manager";

import type { ProjectsRevisionsData, ProjectsCommentsData, WebsimComment } from "websim";

import config from "#config";

const globalHeaders = { cookie: config.cookie };

// # text to check for and send
// auto_response_prefix = config.get("auto_response_prefix")
// loc_auto_response_create_revision = auto_response_prefix + config.get(
//     "auto_response_create_revision"
// )

async function refresh_and_update_cookies() {
  const new_cookies = await refreshCookies(config.base_url, globalHeaders.cookie);
  if (new_cookies) {
    globalHeaders.cookie = new_cookies;
  }
}

function getHeaders() {
  const cookie = globalHeaders.cookie;
  const headers = { "Content-Type": "application/json", cookie } as const;
  return headers;
}

// async function check_comment_has_auto_response(owner_id, comment_id):
//     url_replies = (
//         f"{base_url}/api/v1/projects/{project_id}/comments/{comment_id}/replies"
//     )
//     async with session.get(url_replies) as resp:
//         resp_json = await resp.json()

//         if is_jwt_expired(resp_json):
//             await refresh_and_update_cookies(base_url, cookies)
//             return True

//         elif resp.status != 200:
//             console.error(
//                 f"Fetch revisions failed: {resp.status}, Body: {await resp.text()}"
//             )
//             return True

//         rep_data = resp_json

//         already_replied = any(
//             r["comment"]["author"]["id"] == owner_id
//             and auto_response_prefix in r["comment"]["raw_content"]
//             for r in rep_data["comments"]["data"]
//         )

//         if already_replied:
//             console.info("[Monitor] Found auto reply headers. Skipping.")
//             return True
//     return False

async function fetchLatestRevisions(project_id: string) {
  const headers = getHeaders();
  const url_revisions = `${config.base_url}/api/v1/projects/${project_id}/revisions` as const;
  const resp = await fetch(url_revisions, { headers });

  const resp_json: unknown = await resp.json();

  if (is_jwt_expired(resp_json)) {
    await refresh_and_update_cookies();
    return;
  }

  if (resp.status !== 200) {
    console.error(`Fetch revisions failed: ${resp.status}, Body: ${await resp.text()}`);
    return;
  }

  const { revisions } = resp_json as ProjectsRevisionsData;

  const first = revisions.data[0];

  if (!first) {
    console.info("[Monitor] No revisions found");
    return;
  }

  console.info(`[Monitor] site.state = ${first.site.state}`);

  if (first.site.state !== "done") {
    console.info("[Monitor] Site not yet ready. Skipping execution.");
    return;
  }

  // const owner_id = first.project_revision.created_by.id;
}

async function fetchComments(project_id: string) {
  const headers = getHeaders();
  const url_comments = `${config.base_url}/api/v1/projects/${project_id}/comments`;
  const resp = await fetch(url_comments, { headers });

  let tipped_amount: number | null = null;

  const resp_json: unknown = await resp.json();

  if (is_jwt_expired(resp_json)) {
    await refresh_and_update_cookies();
    return;
  }

  if (resp.status !== 200) {
    console.error(`Fetch revisions failed: ${resp.status}, Body: ${await resp.text()}`);
    return;
  }

  const {
    comments: { data: comm_data },
  } = resp_json as ProjectsCommentsData;

  let comment: WebsimComment | null = null;

  if (!comm_data.length) {
    console.info("[Monitor] No comments to process");
    return;
  }

  for (const { comment: c } of comm_data) {
    // Skip pinned comments
    if (c.pinned) continue;

    // last comment before replied
    // if (await check_comment_has_auto_response(owner_id, comment["id"])) {
    //    break
    // }

    comment = c;
  }

  if (comment === null) {
    console.info("[Monitor] No comments to process");
    return;
  }

  const comment_id = comment.id;
  const raw_content = comment.raw_content;
  const author = comment.author;

  if (comment.card_data && comment.card_data.type === "tip_comment") {
    tipped_amount = comment.card_data.credits_spent;
  }

  console.info(`[Monitor] First comment by ${author.username}: "${raw_content}"`);
}

async function checkRepliesForExistingAutoResponse(
  project_id: string,
  { comment_id }: { comment_id: string },
) {
  const url_replies = `${config.base_url}/api/v1/projects/${project_id}/comments/${comment_id}/replies`;
  const resp = await fetch(url_replies, { headers: getHeaders() });
  const resp_json: unknown = await resp.json();
  if (is_jwt_expired(resp_json)) {
    await refresh_and_update_cookies();
    return;
  }

  if (resp.status !== 200) {
    console.error(`Fetch replies failed: ${resp.status}, Body: ${await resp.text()}`);
    return;
  }

  const { comments } = resp_json as ProjectsCommentsData;

  const already_replied = comments.data.some((r) => {
    // return (
    //   // r.comment.author.id === owner_id &&
    //   //  r.comment.raw_content?.includes(auto_response_prefix)
    // );
  });

  // already_replied = any(
  //     r["comment"]["author"]["id"] == owner_id
  //     and auto_response_prefix in r["comment"]["raw_content"]
  //     for r in rep_data["comments"]["data"]
  // )

  // if already_replied:
  //     console.info("[Monitor] Found auto reply headers. Skipping.")
  //     return
}

async function checkAndRespond(project_id: string) {
  try {
    console.info(`[Monitor] Checking project ${project_id}`);

    // Step 1: Fetch latest revisions
    await fetchLatestRevisions(project_id);

    // Step 2: Fetch comments
    await fetchComments(project_id);

    // Step 3: Check replies for existing auto response
    await checkRepliesForExistingAutoResponse(project_id);

    // Step 4: Create new revision with safety note
    console.info("[Monitor] Creating new revision...");
    const revision = await processProjectRevision(
      project_id,
      "prompt", // raw_content + config.additional_note,
      config.model_id,
      globalHeaders.cookie,
    );

    console.info(
      `[Monitor] Revision created: ID=${revision.revision_id}, version=${revision.revision_version}`,
    );

    // Step 5: Post confirmation comment

    // await fetch(url_comments, {
    //   method: "POST",
    //   headers: getHeaders(),
    //   body: JSON.stringify({
    //     // content: loc_auto_response_create_revision,
    //     // parent_comment_id: comment_id,
    //   }),
    // });

    // await session.post(
    //     url_comments,
    //     headers=headers,
    //     json={
    //         "content": loc_auto_response_create_revision,
    //         "parent_comment_id": comment_id,
    //     },
    // )
    console.info("[Monitor] Confirmation comment posted.");
  } catch (e) {
    console.error(`[Monitor] Error: ${e}`);
  }
}

async function monitorProject(project_id: string) {
  console.info(`[Monitor] Starting automatic monitor for project ${project_id}`);

  while (true) {
    await checkAndRespond(project_id);
    await Bun.sleep(config.interval * 1000);
  }
}

monitorProject(config.project_id);
