/** Local access stays strict; deployment adds one exact HTTPS preview origin. */
export function previewHost(
  origin = process.env.SIGNALFOUNDRY_PREVIEW_ORIGIN,
): string | null {
  if (!origin) return null;
  if (!/^https:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(origin))
    throw new Error(
      "The preview origin must be one exact lowercase HTTPS origin",
    );
  const host = origin.slice("https://".length);
  const labels = host.split(".");
  if (
    host.length > 253 ||
    labels.length < 2 ||
    /^\d+$/.test(labels.at(-1)!) ||
    labels.some(
      (label) =>
        !label ||
        label.length > 63 ||
        label.startsWith("-") ||
        label.endsWith("-"),
    ) ||
    [
      "localhost",
      "local",
      "internal",
      "test",
      "invalid",
      "onion",
      "home",
      "lan",
    ].includes(labels.at(-1)!)
  )
    throw new Error("The preview origin must use a valid public DNS hostname");
  return host;
}
export function isAllowedHost(
  host: string | null,
  origin = process.env.SIGNALFOUNDRY_PREVIEW_ORIGIN,
): boolean {
  if (!host) return false;
  const preview = previewHost(origin);
  if (
    preview &&
    (host.toLowerCase() === preview || host.toLowerCase() === `${preview}:443`)
  )
    return true;
  return (
    /^(localhost|127\.0\.0\.1)(?::(?:[1-9]\d{0,4}))?$/i.test(host) &&
    (!host.includes(":") || Number(host.split(":")[1]) <= 65535)
  );
}
export function hasTrustedHeaders(
  headers: Pick<Headers, "get">,
  origin = process.env.SIGNALFOUNDRY_PREVIEW_ORIGIN,
): boolean {
  const host = headers.get("host");
  if (!isAllowedHost(host, origin)) return false;
  const forwardedHost = headers.get("x-forwarded-host");
  if (forwardedHost && forwardedHost.toLowerCase() !== host!.toLowerCase())
    return false;
  if (headers.get("forwarded")) return false;
  if (origin && !/^(localhost|127\.0\.0\.1)(:|$)/i.test(host!)) {
    if (headers.get("x-forwarded-proto") !== "https") return false;
    const requestOrigin = headers.get("origin");
    if (requestOrigin && requestOrigin !== origin) return false;
  }
  return true;
}
