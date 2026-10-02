export class WorkerFailure extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}
export function workerConfiguration() {
  const origin = process.env.SIGNALFOUNDRY_WORKER_URL;
  const token = process.env.SIGNALFOUNDRY_WORKER_TOKEN;
  if (
    !origin ||
    !token ||
    !/^[A-Za-z0-9_-]{32,256}$/.test(token) ||
    /^(replace|placeholder|your_|changeme)/i.test(token)
  )
    throw new WorkerFailure("Research worker is not configured", false);
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    throw new WorkerFailure("Research worker configuration is invalid", false);
  }
  if (
    url.protocol !== "https:" ||
    url.origin !== origin ||
    url.username ||
    url.password ||
    url.port ||
    !url.hostname.includes(".") ||
    /^[\d.]+$/.test(url.hostname) ||
    url.hostname.includes(":") ||
    /(^|\.)(localhost|local|internal|test|invalid|example|onion|home|lan|arpa)$/.test(
      url.hostname,
    )
  ) {
    throw new WorkerFailure(
      "Research worker requires an exact public HTTPS origin",
      false,
    );
  }
  return { origin, token };
}
export async function callWorker(
  path: "/worker/research" | "/worker/analyze",
  payload: unknown,
): Promise<unknown> {
  const { origin, token } = workerConfiguration();
  const body = JSON.stringify(payload);
  if (new TextEncoder().encode(body).byteLength > 64 * 1024)
    throw new WorkerFailure("Research request exceeds size limit", false);
  let response: Response;
  try {
    response = await fetch(`${origin}${path}`, {
      method: "POST",
      redirect: "error",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body,
      signal: AbortSignal.timeout(120_000),
    });
  } catch {
    throw new WorkerFailure(
      "Research worker could not be reached; retrying may help",
      true,
    );
  }
  if (!response.ok) {
    const retryable =
      response.status === 408 ||
      response.status === 429 ||
      response.status >= 500;
    throw new WorkerFailure(
      `Research worker returned HTTP ${response.status}`,
      retryable,
    );
  }
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new WorkerFailure(
      "Research worker returned an invalid response",
      false,
    );
  const reader = response.body?.getReader();
  if (!reader)
    throw new WorkerFailure(
      "Research worker returned an empty response",
      false,
    );
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1_048_576) {
        await reader.cancel();
        throw new WorkerFailure(
          "Research worker response exceeds size limit",
          false,
        );
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof WorkerFailure) throw error;
    throw new WorkerFailure("Research worker response was interrupted", true);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new WorkerFailure("Research worker returned invalid JSON", false);
  }
}
