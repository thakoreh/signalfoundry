import { notFound } from "next/navigation";
import { CustomerWorkspacePage } from "@/components/customer-workspace-page";
import { validCustomerSearchId } from "@/lib/customer-search";

export default async function OutreachPage({
  params,
  searchParams,
}: {
  params: Promise<{ searchId: string }>;
  searchParams: Promise<{ thread?: string }>;
}) {
  const { searchId } = await params;
  const { thread } = await searchParams;
  if (!validCustomerSearchId(searchId)) notFound();
  return <CustomerWorkspacePage searchId={searchId} initialThreadId={thread} outreach />;
}
