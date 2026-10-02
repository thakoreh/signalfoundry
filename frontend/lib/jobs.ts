import type { ResearchJob } from "./types.ts";
export function activeJob(job: ResearchJob | null): boolean {
  return !!job && ["queued", "running", "retrying"].includes(job.status);
}
