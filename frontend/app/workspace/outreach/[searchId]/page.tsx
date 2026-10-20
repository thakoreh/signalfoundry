import { notFound } from "next/navigation";
import { CustomerWorkspacePage } from "@/components/customer-workspace-page";
import { validCustomerSearchId } from "@/lib/customer-search";

export default async function OutreachPage({
  params,
}: {
  params: Promise<{ searchId: string }>;
}) {
  const { searchId } = await params;
  if (!validCustomerSearchId(searchId)) notFound();
  return <CustomerWorkspacePage searchId={searchId} outreach />;
}
