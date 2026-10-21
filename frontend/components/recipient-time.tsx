"use client";
import { useEffect, useState } from "react";

export function RecipientTime({ zone }: { zone?: string | null }) {
  const [stamp, setStamp] = useState(() => Date.now());
  useEffect(() => {
    if (!zone) return;
    const timer = setInterval(() => setStamp(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, [zone]);
  if (!zone) return null;
  let time: string | null = null;
  try {
    time = new Intl.DateTimeFormat("en", { timeZone: zone, weekday: "short", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(stamp);
  } catch {
    // Only timezone formatting can throw here; render outside this boundary.
  }
  return time ? <p>Recipient local time: <span suppressHydrationWarning>{time}</span> ({zone}). Consider weekday working hours; this is guidance, not an optimal send time.</p> : <p>Recipient timezone needs review.</p>;
}
