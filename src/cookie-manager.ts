// import aiohttp
// from http.cookies import SimpleCookie

// from .config_manager import load_config, update_config

/**
 * Makes a GET request to `base_url` and refreshes cookies if the server returns Set-Cookie headers.
 * Updates both in-memory cookies and `config.json`.
 */
export async function refreshCookies(
  base_url: string,
  // current_cookies: dict[str, str]
): Promise<Record<string, string> | void> {
  try {
    console.info("[CookieManager] Attempting to refresh cookies from base URL...");
    // async with aiohttp.ClientSession() as session:
    //     async with session.get(base_url, cookies=current_cookies) as resp:
    //         if resp.status != 200:
    //             console.error(
    //                 f"[CookieManager] Failed to refresh cookies: status {resp.status}"
    //             )
    //             return None

    //         set_cookie_headers = resp.headers.getall("Set-Cookie", [])
    //         if not set_cookie_headers:
    //             console.warning(
    //                 "[CookieManager] No Set-Cookie headers found in response."
    //             )
    //             return None

    //         new_cookies = {}
    //         for header in set_cookie_headers:
    //             sc = SimpleCookie()
    //             sc.load(header)
    //             for k, v in sc.items():
    //                 new_cookies[k] = v.value
    //                 console.info(f"[CookieManager] Refreshed cookie: {k}={v.value}")

    //         # Update config.yaml
    //         save_cookies_to_config(new_cookies)
    //         return new_cookies
  } catch (e) {
    console.error(`[CookieManager] Error refreshing cookies: ${e}`);
  }
}

// function save_cookies_to_config(new_cookies: dict[str, str]):
//     try:
//         config = load_config()
//         cookie_string = "; ".join(f"{k}={v}" for k, v in new_cookies.items())
//         config["cookies"] = cookie_string
//         update_config(config)
//         console.info("[CookieManager] Updated cookies in config.yaml")
//     except Exception as e:
//         console.error(f"[CookieManager] Failed to update config.yaml: {e}")

// function is_jwt_expired(resp_json: dict) -> bool:
//     return (
//         isinstance(resp_json, dict)
//         and resp_json.get("error", {}).get("name", "") == "ResponseError"
//         and resp_json["error"].get("cause", {}).get("message", "") == "JWT expired"
//     ) or (
//         isinstance(resp_json, dict)
//         and resp_json.get("error", {}).get("name", "") == "ResponseError"
//         and "JWTExpired" in resp_json["error"].get("message", "")
//     )
