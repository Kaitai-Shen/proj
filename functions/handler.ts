const MAX_BODY_BYTES = 8 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 5 * 60 * 1000;

const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /\.local$/i,
  /\.internal$/i,
];

function isAllowedTarget(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (!url.pathname.endsWith("/chat/completions")) return false;
  if (url.username || url.password) return false;
  const host = url.hostname;
  return !BLOCKED_HOST_PATTERNS.some((p) => p.test(host));
}

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function handler(request: Request): Promise<Response> {
  if (request.method === "GET") {
    return Response.json(
      { ok: true, service: "lecturecast-relay" },
      { headers: NO_STORE },
    );
  }
  if (request.method !== "POST") {
    return Response.json(
      { ok: false, error: "method_not_allowed" },
      { status: 405, headers: { ...NO_STORE, Allow: "GET, POST" } },
    );
  }

  let body: {
    targetUrl?: unknown;
    apiKey?: unknown;
    payload?: unknown;
  };
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) {
      return Response.json(
        { ok: false, error: "payload_too_large" },
        { status: 413, headers: NO_STORE },
      );
    }
    body = JSON.parse(text);
  } catch {
    return Response.json(
      { ok: false, error: "invalid_json" },
      { status: 400, headers: NO_STORE },
    );
  }

  const targetUrl = typeof body.targetUrl === "string" ? body.targetUrl : "";
  const apiKey = typeof body.apiKey === "string" ? body.apiKey : "";
  const payload = body.payload;
  if (!targetUrl || !isAllowedTarget(targetUrl) || !payload || typeof payload !== "object") {
    return Response.json(
      { ok: false, error: "invalid_target" },
      { status: 400, headers: NO_STORE },
    );
  }

  const upstreamHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) upstreamHeaders["Authorization"] = `Bearer ${apiKey}`;

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, {
      method: "POST",
      headers: upstreamHeaders,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "upstream_failed";
    return Response.json(
      { ok: false, error: `upstream_failed: ${msg}` },
      { status: 502, headers: NO_STORE },
    );
  }

  const contentType = upstream.headers.get("content-type") ?? "application/json";
  return new Response(upstream.body, {
    status: upstream.status,
    headers: { "Content-Type": contentType, ...NO_STORE },
  });
}
