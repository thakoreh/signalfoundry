import type { Campaign, CampaignInput, DiscoveryStatus } from "./types";

export function discoveryReady(status: DiscoveryStatus | null): boolean {
  return Boolean(
    status?.enabled &&
    status.providers?.discovery?.configured &&
    status.providers.discovery.licensed &&
    status.blockers?.length === 0,
  );
}

export function createCampaign(
  client: typeof api,
  input: CampaignInput,
): Promise<Campaign> {
  return client<Campaign>("/campaigns", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    const headers = new Headers(options.headers);
    if (!headers.has("Content-Type"))
      headers.set("Content-Type", "application/json");
    response = await fetch(`/api${path}`, {
      ...options,
      headers,
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new Error(
      "Unable to reach the research service. Check your connection, then try again.",
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
