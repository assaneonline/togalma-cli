import { z } from "zod";
import { CLI_VERSION } from "./version.js";

export class HttpError extends Error {
  public status: number;
  public body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export function baseUrlFromEnvOrFlag(flagBaseUrl?: string): string {
  const raw = flagBaseUrl || process.env.TOGALMA_BASE_URL || "https://togalma.com";
  return raw.replace(/\/+$/, "");
}

export function ensureHttps(baseUrl: string, allowInsecure = false) {
  if (allowInsecure) return;
  if (!baseUrl.startsWith("https://")) {
    throw new Error(
      `Refusing non-HTTPS baseUrl: ${baseUrl}. Set --allow-insecure or use https.`
    );
  }
}

type RequestOptions = {
  method: "GET" | "POST";
  path: string;
  token?: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
};

export async function requestJson<T>(
  baseUrl: string,
  opts: RequestOptions,
  schema?: z.ZodType<T>
): Promise<T> {
  const url = new URL(baseUrl + opts.path);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v === undefined) continue;
      url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (CLI_VERSION && CLI_VERSION !== "0.0.0") {
    headers["X-Togalma-CLI-Version"] = CLI_VERSION;
  }
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  let body: string | undefined;
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }

  const res = await fetch(url, { method: opts.method, headers, body });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }

  if (!res.ok) {
    const msg =
      typeof (json as any)?.error === "string"
        ? (json as any).error
        : `HTTP ${res.status}`;
    throw new HttpError(msg, res.status, json);
  }

  if (!schema) return json as T;
  return schema.parse(json);
}

