import type { ChatMessage, ContentPart, LLMConfig } from "../types";

export const RELAY_URL = "/functions/v1/app/relay";

const RELAY_UNAVAILABLE =
  "该模型供应商不允许浏览器直连，且转发服务未部署。请部署 functions/app/relay 转发服务后重试，或改用支持浏览器直连的供应商。";

export type TestConnectionResult =
  | { ok: true; latencyMs: number; model: string }
  | { ok: false; error: string };

type ChatPayload = {
  model: string;
  messages: ChatMessage[];
  stream: boolean;
  temperature: number;
  max_tokens?: number;
};

type StreamChunk = {
  choices?: { delta?: { content?: string | null } }[];
  error?: { message?: string };
};

function endpointOf(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
}

function buildHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  return headers;
}

async function readErrorDetail(res: Response): Promise<string | null> {
  let text = "";
  try {
    text = await res.text();
  } catch {
    return null;
  }
  try {
    const json = JSON.parse(text) as { error?: { message?: string }; message?: string };
    const msg = json.error?.message ?? json.message;
    if (msg) return msg;
  } catch {
    if (text.trim()) return text.trim().slice(0, 300);
  }
  return null;
}

const RELAY_ENDPOINT_STATUSES = new Set([404, 405, 501, 502, 503, 504]);

async function relayRequest(
  targetUrl: string,
  apiKey: string,
  payload: ChatPayload,
  signal?: AbortSignal,
): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(RELAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUrl, apiKey, payload }),
      signal,
    });
  } catch {
    throw new Error(RELAY_UNAVAILABLE);
  }
  if (!res.ok) {
    if (RELAY_ENDPOINT_STATUSES.has(res.status)) throw new Error(RELAY_UNAVAILABLE);
    const detail = await readErrorDetail(res);
    throw new Error(detail ? `转发请求失败（HTTP ${res.status}）：${detail}` : RELAY_UNAVAILABLE);
  }
  return res;
}

async function requestCompletion(
  config: LLMConfig,
  payload: ChatPayload,
  signal?: AbortSignal,
): Promise<Response> {
  const url = endpointOf(config.baseUrl);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: buildHeaders(config.apiKey),
      body: JSON.stringify(payload),
      signal,
    });
    if (!res.ok) {
      const detail = await readErrorDetail(res);
      throw new Error(detail ? `请求失败（HTTP ${res.status}）：${detail}` : `请求失败（HTTP ${res.status}）`);
    }
    return res;
  } catch (err) {
    if (!(err instanceof TypeError)) throw err;
    return relayRequest(url, config.apiKey, payload, signal);
  }
}

function createSSEParser(onDelta: (delta: string) => void) {
  let buffer = "";
  let full = "";
  let done = false;

  const handleEvent = (raw: string): void => {
    for (const line of raw.split("\n")) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data) continue;
      if (data === "[DONE]") {
        done = true;
        return;
      }
      let chunk: StreamChunk;
      try {
        chunk = JSON.parse(data) as StreamChunk;
      } catch {
        continue;
      }
      if (chunk.error?.message) {
        throw new Error(`模型返回错误：${chunk.error.message}`);
      }
      const delta = chunk.choices?.[0]?.delta?.content;
      if (typeof delta === "string" && delta) {
        full += delta;
        onDelta(delta);
      }
    }
  };

  return {
    push(chunk: string): void {
      if (done) return;
      buffer += chunk;
      buffer = buffer.replace(/\r\n/g, "\n");
      let idx = buffer.indexOf("\n\n");
      while (idx !== -1 && !done) {
        handleEvent(buffer.slice(0, idx));
        buffer = buffer.slice(idx + 2);
        idx = buffer.indexOf("\n\n");
      }
    },
    flush(): void {
      if (done || !buffer) return;
      const rest = buffer;
      buffer = "";
      handleEvent(rest);
    },
    isDone(): boolean {
      return done;
    },
    text(): string {
      return full;
    },
  };
}

function parseSSEText(text: string): string {
  const parser = createSSEParser(() => {});
  parser.push(text);
  parser.flush();
  return parser.text();
}

function extractContentParts(parts: ContentPart[]): string {
  return parts.map((p) => (p.type === "text" ? p.text : "")).join("");
}

type OnceResponseJson = {
  choices?: { message?: { content?: string | ContentPart[] } }[];
  error?: { message?: string };
};

function extractOnceText(text: string, status: number): string {
  let json: OnceResponseJson | null = null;
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === "object") json = parsed as OnceResponseJson;
  } catch {
    // 可能是转发服务返回的 SSE 文本流，稍后按 SSE 解析
  }
  if (json?.error?.message) throw new Error(`模型返回错误：${json.error.message}`);
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return extractContentParts(content);
  const streamed = parseSSEText(text);
  if (streamed) return streamed;
  throw new Error(`模型响应无法解析（HTTP ${status}）：${text.trim().slice(0, 300)}`);
}

export async function streamChat(
  config: LLMConfig,
  messages: ChatMessage[],
  handlers: { onDelta: (delta: string) => void },
  signal?: AbortSignal,
): Promise<string> {
  const payload: ChatPayload = {
    model: config.model,
    messages,
    stream: true,
    temperature: 0.7,
  };
  const res = await requestCompletion(config, payload, signal);
  const parser = createSSEParser(handlers.onDelta);
  const reader = res.body?.getReader();
  if (!reader) {
    const text = await res.text();
    parser.push(text);
    parser.flush();
    return parser.text();
  }
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parser.push(decoder.decode(value, { stream: true }));
      if (parser.isDone()) break;
    }
    parser.flush();
  } finally {
    reader.cancel().catch(() => {});
  }
  return parser.text();
}

export async function chatOnce(
  config: LLMConfig,
  messages: ChatMessage[],
  signal?: AbortSignal,
  extra?: { max_tokens?: number },
): Promise<string> {
  const payload: ChatPayload = {
    model: config.model,
    messages,
    stream: false,
    temperature: 0.7,
    ...extra,
  };
  const res = await requestCompletion(config, payload, signal);
  const text = await res.text();
  return extractOnceText(text, res.status);
}

export async function testConnection(config: LLMConfig): Promise<TestConnectionResult> {
  const start = performance.now();
  try {
    await chatOnce(
      config,
      [{ role: "user", content: "ping" }],
      undefined,
      { max_tokens: 5 },
    );
    return {
      ok: true,
      latencyMs: Math.round(performance.now() - start),
      model: config.model,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
