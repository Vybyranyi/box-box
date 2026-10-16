import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CACHE_DIR = join(import.meta.dirname, "..", ".cache");
const refresh = process.argv.includes("--refresh");

/** Minimum gap between network requests, to stay inside Jolpica's rate limit. */
const THROTTLE_MS = 400;
let lastRequestAt = 0;

/** GET a JSON (or text) resource, cached on disk in scripts/.cache. Pass --refresh to bypass. */
export async function fetchCached<T>(
  url: string,
  as: "json" | "text" = "json",
): Promise<T> {
  mkdirSync(CACHE_DIR, { recursive: true });
  const file = join(
    CACHE_DIR,
    createHash("sha1").update(url).digest("hex") + ".cache",
  );

  if (!refresh && existsSync(file)) {
    const body = readFileSync(file, "utf8");
    return (as === "json" ? JSON.parse(body) : body) as T;
  }

  const wait = lastRequestAt + THROTTLE_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();

  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, {
      headers: { "User-Agent": "box-box-data-script" },
    });
    if (res.status === 429 && attempt <= 5) {
      console.warn(`  429 from ${url}, retrying in ${attempt * 5}s`);
      await new Promise((r) => setTimeout(r, attempt * 5000));
      continue;
    }
    if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
    const body = await res.text();
    writeFileSync(file, body);
    return (as === "json" ? JSON.parse(body) : body) as T;
  }
}
