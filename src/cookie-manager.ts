import { loadConfig, updateConfig } from "./config-manager";

/**
 * Makes a GET request to `base_url` and refreshes cookies if the server returns Set-Cookie headers.
 * Updates both in-memory cookies and `config.json`.
 */
export async function refreshCookies(
  base_url: string,
  cookie: string,
): Promise<string | undefined> {
  try {
    console.info("[CookieManager] Attempting to refresh cookies from base URL...");
    const resp = await fetch(base_url, { headers: { cookie } });
    if (!resp.ok) {
      console.error(`[CookieManager] Failed to refresh cookies: status ${resp.status}`);
      return;
    }

    const setCookieHeaders = resp.headers.getSetCookie();
    if (!setCookieHeaders.length) {
      console.warn("[CookieManager] No Set-Cookie headers found in response.");
      return;
    }

    const cookieString = setCookieHeaders
      .map((header) => {
        const cookie = Bun.Cookie.parse(header);
        return `${cookie.name}=${cookie.value}`;
      })
      .join("; ");

    saveCookieToConfig(cookieString);
    return cookieString;
  } catch (e) {
    console.error(`[CookieManager] Error refreshing cookies: ${e}`);
  }
}

async function saveCookieToConfig(new_cookie: string): Promise<void> {
  try {
    const config = await loadConfig();
    config.cookie = new_cookie;
    updateConfig(config);
    console.info("[CookieManager] Updated cookies in config.json");
  } catch (e) {
    console.error(`[CookieManager] Failed to update config.json: ${e}`);
  }
}

export function is_jwt_expired(resp_json: unknown): boolean {
  if (!resp_json) return false;
  if (!(typeof resp_json === "object")) return false;

  // return (
  //     resp_json.get("error", {}).get("name", "") == "ResponseError"
  //     and resp_json["error"].get("cause", {}).get("message", "") == "JWT expired"
  // ) or (
  //     resp_json.get("error", {}).get("name", "") == "ResponseError"
  //     and "JWTExpired" in resp_json["error"].get("message", "")
  // )
}
