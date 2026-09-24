export function ndjsonStreamResponse<T>(generator: AsyncGenerator<T>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await generator.next();
        if (done) {
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
      } catch (err) {
        controller.enqueue(
          encoder.encode(`${JSON.stringify({ type: "stream_error", error: err instanceof Error ? err.message : String(err) })}\n`),
        );
        controller.close();
      }
    },
    async cancel() {
      await generator.return?.(undefined);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}

/** Reads an NDJSON response body on the client, calling onEvent for each parsed line. */
export async function readNdjson<T>(response: Response, onEvent: (event: T) => void): Promise<void> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      onEvent(JSON.parse(line) as T);
    }
  }
  if (buffer.trim()) {
    onEvent(JSON.parse(buffer) as T);
  }
}
