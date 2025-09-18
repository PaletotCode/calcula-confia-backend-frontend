"use client";

import AppProviders from "@/components/AppProviders";
import PaymentStatusPage from "../PaymentStatusPage";

export default function PaymentPendingPage() {
  return (
    <AppProviders>
      <PaymentStatusPage status="pending" />
    </AppProviders>
  );
}