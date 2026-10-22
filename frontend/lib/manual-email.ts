/** Conservative client handoff, never delivery or a sent record. */
export function manualEmailLink(recipient: string, subject: string, body: string): string | null {
  if (!/^[^\s@,;<>]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(recipient) || /[\r\n]/.test(subject)) return null;
  const link = `mailto:${encodeURIComponent(recipient).replace(/%40/g, "@")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return link.length <= 1800 ? link : null;
}

export function requestEmailApp(link: string) {
  if (!link.startsWith("mailto:")) throw new Error("Invalid email handoff");
  window.location.assign(link);
}
