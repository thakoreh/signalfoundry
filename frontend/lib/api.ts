export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
      cache: "no-store",
    });
  } catch {
    throw new Error(
      "Unable to reach the research server. Check that the backend is running, then try again.",
    );
  }
  if (!response.ok) {
    let message = `Request failed (${response.status}). Please try again.`;
    try {
      const payload = await response.json();
      if (typeof payload.detail === "string") message = payload.detail;
      else if (Array.isArray(payload.detail))
        message = payload.detail.map((e: { msg: string }) => e.msg).join("; ");
    } catch {
      /* A proxy can return HTML; preserve the readable fallback. */
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}
export const jsonBody = (data: unknown) => JSON.stringify(data);
export const errorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
