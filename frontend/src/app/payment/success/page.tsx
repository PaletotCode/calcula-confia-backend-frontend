"use client";

import AppProviders from "@/components/AppProviders";
import PaymentStatusPage from "../PaymentStatusPage";

export default function PaymentSuccessPage() {
  return (
    <AppProviders>
      <PaymentStatusPage status="success" />
    </AppProviders>
  );
}