import envPaths from "env-paths";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

type Cache = {
  last_check_ymd?: string;
  last_seen_latest?: string;
};

function todayYmd(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function parseSemver(v: string): [number, number, number] {
  const parts = String(v).trim().split(".");
  const a = Number(parts[0] ?? 0);
  const b = Number(parts[1] ?? 0);
  const c = Number(parts[2] ?? 0);
  return [
    Number.isFinite(a) ? Math.max(0, Math.trunc(a)) : 0,
    Number.isFinite(b) ? Math.max(0, Math.trunc(b)) : 0,
    Number.isFinite(c) ? Math.max(0, Math.trunc(c)) : 0,
  ];
}

function semverGt(a: string, b: string): boolean {
  const [am, an, ap] = parseSemver(a);
  const [bm, bn, bp] = parseSemver(b);
  if (am !== bm) return am > bm;
  if (an !== bn) return an > bn;
  return ap > bp;
}

async function readCache(path: string): Promise<Cache> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as Cache;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeCache(path: string, value: Cache): Promise<void> {
  await writeFile(path, JSON.stringify(value, null, 2), "utf8");
}

async function fetchLatestVersion(timeoutMs = 1500): Promise<string | null> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  // Don’t keep the process alive just for the timer.
  (t as any).unref?.();

  try {
    const res = await fetch("https://registry.npmjs.org/@togalma/cli/latest", {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as any;
    const v = typeof json?.version === "string" ? json.version : null;
    return v ? v.trim() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function checkForUpdates(opts: { currentVersion: string }): Promise<void> {
  const current = String(opts.currentVersion || "").trim();
  if (!current) return;
  if (current === "0.0.0") return;

  const paths = envPaths("togalma");
  const cachePath = join(paths.config, "update.json");
  await mkdir(paths.config, { recursive: true });

  const cache = await readCache(cachePath);
  const today = todayYmd();
  if (cache.last_check_ymd === today) return;

  const latest = await fetchLatestVersion();
  await writeCache(cachePath, { last_check_ymd: today, last_seen_latest: latest ?? cache.last_seen_latest });

  if (!latest) return;
  if (!semverGt(latest, current)) return;

  process.stderr.write(
    `Update available: ${current} → ${latest} (npm i -g @togalma/cli@latest)\n`
  );
}

