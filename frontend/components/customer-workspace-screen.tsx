"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PRODUCT_NAME } from "../lib/product";
import { SignalBrand } from "./signal-brand";
import { CustomerSearch } from "./customer-search";
import { CustomerSearchResults } from "./customer-search-results";
import { OutreachWorkspace } from "./outreach-workspace";
import "./business-onboarding.css";

export function CustomerWorkspaceScreen({
  searchId,
  organizationControl,
  userControl,
  outreach = false,
}: {
  searchId?: string;
  organizationControl?: React.ReactNode;
  userControl?: React.ReactNode;
  outreach?: boolean;
}) {
  const router = useRouter();
  return (
    <div className="business-onboarding customer-workspace">
      <a className="skip-link" href="#customer-content">
        Skip to customer search
      </a>
      <header className="business-onboarding-header">
        <Link className="sf-brand" href="/" aria-label={`${PRODUCT_NAME} home`}>
          <SignalBrand />
        </Link>
        <div className="business-onboarding-account">
          {organizationControl}
          {userControl}
        </div>
      </header>
      <main id="customer-content" tabIndex={-1}>
        {outreach && searchId ? (
          <OutreachWorkspace key={searchId} searchId={searchId} />
        ) : searchId ? (
          <CustomerSearchResults key={searchId} searchId={searchId} />
        ) : (
          <CustomerSearch onBack={() => router.push("/workspace")} />
        )}
      </main>
    </div>
  );
}
