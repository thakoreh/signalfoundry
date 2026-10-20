export type BusinessIntake = { website: string } | { manual: true };

const INTAKE_KEY = "clientrove:business-intake";
const MAX_AGE = 60 * 60 * 1000;
type IntakeStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Draft validation only; the backend still checks DNS and every fetch target. */
export function normalizeBusinessWebsite(input: string): string {
  try {
    const value = input.trim();
    if (!value || value.length > 2048 || /\s/.test(value)) return "";
    const url = new URL(
      /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`,
    );
    const host = url.hostname.toLowerCase();
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.port ||
      host.length > 253 ||
      !host.includes(".") ||
      /^[\d.]+$/.test(host) ||
      host.includes(":") ||
      /\.(localhost|local|internal|test|invalid|example)$/.test(host) ||
      !host
        .split(".")
        .every(
          (label) =>
            label.length <= 63 &&
            /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label),
        )
    )
      return "";
    url.search = "";
    url.hash = "";
    return url.href;
  } catch {
    return "";
  }
}

/** Per-tab handoff only. This neither analyzes nor changes a saved profile. */
export function saveBusinessIntake(
  intent: BusinessIntake,
  storage: IntakeStorage = window.sessionStorage,
): void {
  const clean: BusinessIntake =
    "manual" in intent
      ? { manual: true }
      : { website: normalizeBusinessWebsite(intent.website) };
  if ("website" in clean && !clean.website)
    throw new Error("Enter a public business website.");
  storage.setItem(
    INTAKE_KEY,
    JSON.stringify({ ...clean, createdAt: Date.now() }),
  );
}

export function consumeBusinessIntake(
  storage?: IntakeStorage,
  now = Date.now(),
): BusinessIntake | null {
  try {
    const source = storage ?? window.sessionStorage;
    const raw = source.getItem(INTAKE_KEY);
    if (!raw) return null;
    source.removeItem(INTAKE_KEY);
    if (raw.length > 4096) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const item = value as Record<string, unknown>;
    if (
      typeof item.createdAt !== "number" ||
      now < item.createdAt ||
      now - item.createdAt > MAX_AGE
    )
      return null;
    if (item.manual === true) return { manual: true };
    if (typeof item.website !== "string") return null;
    const website = normalizeBusinessWebsite(item.website);
    return website ? { website } : null;
  } catch {
    return null;
  }
}
