/**
 * Minimal Server-Sent Events reader built on `fetch` + streaming response.
 *
 * The browser's native `EventSource` cannot send an `Authorization` header, so
 * it can't carry our Bearer JWT. This reader streams the response body, parses
 * the `event:`/`data:` frames itself, and supports auth headers + cancellation
 * via an `AbortSignal`. Behaviour matches the SSE the backend emits
 * (`event: <type>\ndata: <json>\n\n`).
 */

export type SseFrame = { event: string; data: string };

export type StreamSseOptions = {
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Called for every parsed frame. */
  onFrame: (frame: SseFrame) => void;
  /** Called once the stream ends (server closed or aborted). */
  onClose?: () => void;
  /** Called on network/HTTP error. */
  onError?: (error: unknown) => void;
};

export async function streamSse(url: string, options: StreamSseOptions): Promise<void> {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "text/event-stream", ...options.headers },
      signal: options.signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(`SSE request failed: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    // SSE frames are separated by a blank line. Accumulate until we have a full
    // frame, then parse its `event:`/`data:` fields (data can span lines).
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let separator: number;
      while ((separator = buffer.indexOf("\n\n")) !== -1) {
        const rawFrame = buffer.slice(0, separator);
        buffer = buffer.slice(separator + 2);

        let event = "message";
        const dataLines: string[] = [];
        for (const line of rawFrame.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
        }
        if (dataLines.length > 0) {
          options.onFrame({ event, data: dataLines.join("\n") });
        }
      }
    }

    options.onClose?.();
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      options.onClose?.();
      return;
    }
    options.onError?.(error);
  }
}
