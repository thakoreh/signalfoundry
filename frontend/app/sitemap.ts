import type { MetadataRoute } from "next";
import { productionOrigin, PUBLIC_PATHS } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = productionOrigin();
  return origin
    ? PUBLIC_PATHS.map((path) => ({ url: new URL(path, origin).href }))
    : [];
}
