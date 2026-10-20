import LandingPage from "@/components/landing-page";
import { publicPageMetadata } from "@/lib/seo";

export function generateMetadata() {
  return publicPageMetadata("/", "Find businesses that need what you sell");
}

export default function HomePage() {
  return <LandingPage />;
}
