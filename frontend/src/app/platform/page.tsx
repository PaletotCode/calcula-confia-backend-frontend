"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import useAuth from "@/hooks/useAuth";
import { inferPurchaseFromUser } from "@/utils/user-credits";

const Calculator = dynamic(() => import("@/components/Calculator"), { ssr: false });

export default function PlatformPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();

  const hasSuccessfulPayment = useMemo(
    () => inferPurchaseFromUser(user),
    [user]
  );

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!isAuthenticated || !hasSuccessfulPayment) {
      router.replace("/");
    }
  }, [hasSuccessfulPayment, isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-4 text-center text-sm text-white/80 shadow-2xl">
          Verificando seu acesso...
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !hasSuccessfulPayment) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="max-w-md rounded-3xl border border-white/10 bg-white/10 p-8 text-center shadow-2xl">
          <h1 className="text-2xl font-semibold">Acesso indisponível</h1>
          <p className="mt-4 text-sm leading-relaxed text-white/80">
            Para entrar na plataforma, finalize um pagamento aprovado no Mercado Pago usando esta conta. Assim que o pagamento
            for confirmado, seu acesso será liberado automaticamente.
          </p>
        </div>
      </div>
    );
  }

  return <Calculator />;
}