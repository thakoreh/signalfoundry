import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "SignalFoundry — Find your next right customer",
  description:
    "Evidence-led account research. Build your ideal customer profile, prioritize accounts, and turn public signals into thoughtful outreach.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
