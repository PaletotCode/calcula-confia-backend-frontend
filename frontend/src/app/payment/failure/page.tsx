"use client";

import AppProviders from "@/components/AppProviders";
import PaymentStatusPage from "../PaymentStatusPage";

export default function PaymentFailurePage() {
  return (
    <AppProviders>
      <PaymentStatusPage status="failure" />
    </AppProviders>
  );
}