import config from "#config";
import type { ProjectData } from "websim";

/**
 * Generates a random alphanumeric site ID of given length.
 */
function generateSiteId(length: number = 17): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

/**
 * Custom error for project revision failures.
 */
class ProjectRevisionError extends Error {
  override readonly name = "ProjectRevisionError";
}

async function fetchCurrentProjectInfo({
  project_id,
  headers,
}: {
  project_id: string;
  headers: HeadersInit;
}) {
  const url_proj = `${config.base_url}/api/v1/projects/${project_id}`;
  const resp = await fetch(url_proj, { headers });

  if (resp.status !== 200) {
    const body = await resp.text();
    const msg = `Failed to fetch project info: ${resp.status}, Response: ${body}`;
    console.error(msg);
    throw new ProjectRevisionError(msg);
  }

  const proj_data: ProjectData = await resp.json();
  const parent_version = proj_data.project_revision!.version;
  console.info(`Current project version: ${parent_version}`);
  return { parent_version };
}

async function createNewRevision(
  { project_id, headers }: { project_id: string; headers: HeadersInit },
  { parent_version }: { parent_version: number },
) {
  const url_revisions = `${config.base_url}/api/v1/projects/${project_id}/revisions`;
  const payload = { parent_version };
  // async with session.post(url_revisions, headers=headers, json=payload) as resp:
  //     if resp.status != 201:
  //         body = await resp.text()
  //         msg = f"Failed to create revision: {resp.status}, Response: {body}"
  //         console.error(msg)
  //         raise ProjectRevisionError(msg)
  //     rev_data = await resp.json()
  //     revision_id = rev_data["project_revision"]["id"]
  //     revision_version = rev_data["project_revision"]["version"]
  //     console.info(f"Created revision ID: {revision_id}, Version: {revision_version}")
}

async function createDraftSite({
  project_id,
  headers,
}: {
  project_id: string;
  headers: HeadersInit;
}) {
  const site_id = generateSiteId();
  console.info(`Generated site ID: ${site_id}`);
  const url_site = `${config.base_url}/api/v1/sites`;

  // # Extra Step: Enable optional features
  // enableMultiplayer = "multiplayer" in prompt.lower()
  // enableDB = "database" in prompt.lower() or "db" in prompt.lower()

  // # Construct Final Payload
  // payload_site = {
  //     "generate": {
  //         "prompt": {"type": "plaintext", "text": prompt, "data": None},
  //         "flags": {"use_worker_generation": False},
  //         "model": model_id,
  //         "lore": {
  //             "version": 1,
  //             "attachments": [],
  //             "references": [],
  //             "enableDatabase": False,
  //             "enableApi": True,
  //             "enableMultiplayer": enableMultiplayer,
  //             "enableMobilePrompt": True,
  //             "enableDB": enableDB,
  //             "enableLLM": False,
  //             "enableLLM2": True,
  //             "enableTweaks": False,
  //             "features": {
  //                 "context": True,
  //                 "errors": True,
  //                 "htmx": True,
  //                 "images": True,
  //                 "navigation": True,
  //             },
  //         },
  //     },
  //     "project_id": project_id,
  //     "project_version": revision_version,
  //     "project_revision_id": revision_id,
  //     "site_id": site_id,
  // }

  // async with session.post(url_site, headers=headers, json=payload_site) as resp:
  //     if resp.status != 201:
  //         body = await resp.text()
  //         msg = f"Failed to create site: {resp.status}, Response: {body}"
  //         console.error(msg)
  //         raise ProjectRevisionError(msg)
  //     console.info("Created draft site successfully")
}

async function confirmDraft() {
  // url_confirm = f"{config.base_url}/api/v1/projects/{project_id}/revisions/{revision_version}"
  // async with session.patch(
  //     url_confirm, headers=headers, json={"draft": False}
  // ) as resp:
  //     if resp.status != 200:
  //         body = await resp.text()
  //         msg = f"Failed to confirm draft: {resp.status}, Response: {body}"
  //         console.error(msg)
  //         raise ProjectRevisionError(msg)
  //     console.info("Confirmed draft successfully")
}

async function updateProjectCurrentVersion() {
  // url_update = f"{config.base_url}/api/v1/projects/{project_id}"
  // async with session.patch(
  //     url_update, headers=headers, json={"current_version": revision_version}
  // ) as resp:
  //     if resp.status != 200:
  //         body = await resp.text()
  //         msg = (
  //             f"Failed to update current version: {resp.status}, Response: {body}"
  //         )
  //         console.error(msg)
  //         raise ProjectRevisionError(msg)
  //     console.info(f"Updated project current version to: {revision_version}")
}

export async function processProjectRevision(
  project_id: string,
  prompt: string,
  model_id: string = "gemini-flash",
  cookie: string,
) {
  const headers = { "Content-Type": "application/json", cookie } as const;

  // # 1) Fetch current project info
  const { parent_version } = await fetchCurrentProjectInfo({ project_id, headers });

  // # 2) Create new revision
  await createNewRevision({ project_id, headers }, { parent_version });

  // # 3) Create draft site
  await createDraftSite({ project_id, headers });

  // # 4) Confirm draft
  await confirmDraft();

  // # 5) Update project current version
  await updateProjectCurrentVersion();

  // return {
  //     "revision_id": revision_id,
  //     "version": revision_version,
  //     "site_id": site_id,
  // }
}
