import { MAX_JSON_BODY } from "@/lib/constants";

export async function readLimitedBody(req: Request, maxBytes = MAX_JSON_BODY): Promise<Uint8Array | null> {
  const reader = req.body?.getReader();
  if (!reader) {
    const bytes = new Uint8Array(await req.arrayBuffer());
    return bytes.byteLength > maxBytes ? null : bytes;
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export function parseJsonObject(bytes: Uint8Array): Record<string, unknown> | null {
  if (bytes.byteLength === 0) return {};
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}
