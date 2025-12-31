import * as path from "node:path";

import type config from "#config";

type Config = typeof config;

const CONFIG_PATH = path.join(process.cwd(), "config.json");

export async function loadConfig(): Promise<{
  readonly config: Config;
  readonly cookies: Bun.CookieMap;
}> {
  const config: Config = await Bun.file(CONFIG_PATH).json();
  const cookies = new Bun.CookieMap(config.cookies);
  return { config, cookies } as const;
}

export async function updateConfig(config: Config): Promise<void> {
  const content = JSON.stringify(config);
  await Bun.write(CONFIG_PATH, content);
}
