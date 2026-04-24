import envPaths from "env-paths";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { Session } from "./types.js";

const paths = envPaths("togalma");

export function sessionPath(): string {
  // env-paths uses ~/.config on linux; on mac uses ~/Library/Preferences.
  // The plan asked for ~/.config/togalma/session.json; we'll keep it stable by using env-paths,
  // and allow override via TOGALMA_SESSION_PATH if needed.
  const override = process.env.TOGALMA_SESSION_PATH;
  if (override) return override;
  return path.join(paths.config, "session.json");
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export async function loadSession(): Promise<Session | null> {
  try {
    const raw = await fs.readFile(sessionPath(), "utf8");
    const parsed = JSON.parse(raw) as Session;
    if (!parsed?.token) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveSession(session: Session): Promise<void> {
  const p = sessionPath();
  await ensureDir(path.dirname(p));
  const tmp = path.join(os.tmpdir(), `togalma-session-${Date.now()}.json`);
  await fs.writeFile(tmp, JSON.stringify(session, null, 2), { encoding: "utf8" });
  // Best-effort 0600
  try {
    await fs.chmod(tmp, 0o600);
  } catch {
    // ignore
  }
  await fs.rename(tmp, p);
  try {
    await fs.chmod(p, 0o600);
  } catch {
    // ignore
  }
}

export async function clearSession(): Promise<void> {
  try {
    await fs.unlink(sessionPath());
  } catch {
    // ignore
  }
}

