"use client";

import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, Suspense } from "react";
import useAuth from "@/hooks/useAuth";
import { useMutation } from "@tanstack/react-query";
import { createOrder, extractErrorMessage } from "@/lib/api";
import { LucideIcon } from "@/components/LucideIcon";
import { inferPurchaseFromUser } from "@/utils/user-credits";
import MercadoPagoBrick from "@/components/MercadoPagoBrick";

const Calculator = dynamic(() => import("@/components/Calculator"), { ssr: false });

const DEFAULT_PLATFORM_CREDIT_PRICE = 5;

function PlatformContent() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, refresh } = useAuth();
  const searchParams = useSearchParams();
  const [isPaymentCardOpen, setIsPaymentCardOpen] = useState(false);
  const [preferenceId, setPreferenceId] = useState<string | null>(null);
  const [orderAmount, setOrderAmount] = useState<number>(DEFAULT_PLATFORM_CREDIT_PRICE);

  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }),
    []
  );
  const formattedOrderAmount = useMemo(
    () => currencyFormatter.format(orderAmount),
    [currencyFormatter, orderAmount]
  );

  const createOrderMutation = useMutation({
    mutationFn: createOrder,
    onSuccess: (data) => {
      if (data.preference_id) {
        setPreferenceId(data.preference_id);
        if (typeof data.amount === "number") {
          setOrderAmount(data.amount);
        } else {
          setOrderAmount(DEFAULT_PLATFORM_CREDIT_PRICE);
        }
      } else {
        alert("Não foi possível iniciar o checkout. Tente novamente em instantes.");
      }
    },
    onError: (error) => {
      // Idealmente, mostrar um toast/modal de erro para o usuário
      alert(extractErrorMessage(error));
    },
  });

  const {
    mutate: triggerCreateOrder,
    reset: resetCreateOrder,
    isPending,
    isError,
    error,
  } = createOrderMutation;

  const handleBuyCredits = () => {
    setPreferenceId(null);
    setOrderAmount(DEFAULT_PLATFORM_CREDIT_PRICE);
    resetCreateOrder();
    triggerCreateOrder();
  };

  const closePaymentCard = () => {
    setIsPaymentCardOpen(false);
    setPreferenceId(null);
    setOrderAmount(DEFAULT_PLATFORM_CREDIT_PRICE);
    resetCreateOrder();
  };

  const handlePaymentSuccess = async () => {
    setPreferenceId(null);
    setIsPaymentCardOpen(false);
    await refresh();
    router.replace("/platform", { scroll: false });
  };

  useEffect(() => {
    if (searchParams.get("new_user") === "true") {
      setIsPaymentCardOpen(true);
      setPreferenceId(null);
      setOrderAmount(DEFAULT_PLATFORM_CREDIT_PRICE);
      resetCreateOrder();
      // Limpa a URL para não mostrar o modal novamente em um refresh
      router.replace("/platform", { scroll: false });
    }
  }, [resetCreateOrder, router, searchParams]);

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

  return (
    <>
      <Calculator />

      {isPaymentCardOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <button
              type="button"
              onClick={closePaymentCard}
              className="absolute right-5 top-5 text-slate-400 hover:text-slate-600"
              title="Fechar"
            >
              <LucideIcon name="X" className="h-5 w-5" />
            </button>
            <div className="pr-8">
              <h3 className="text-xl font-semibold text-slate-900">Gerar pagamento PIX</h3>
              <p className="mt-1 text-sm text-slate-600">Valor único de {formattedOrderAmount}.</p>
            </div>
            {isError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {extractErrorMessage(error)}
              </div>
            )}
            <div className="mt-6">
              {preferenceId ? (
                <MercadoPagoBrick
                  preferenceId={preferenceId}
                  onPaymentCreated={() => void refresh()}
                  onPaymentSuccess={handlePaymentSuccess}
                />
              ) : (
                <div className="space-y-4">
                  <button
                    type="button"
                    className="w-full rounded-xl bg-green-600 px-4 py-3 text-base font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-70"
                    onClick={handleBuyCredits}
                    disabled={isPending}
                  >
                    {isPending ? "Gerando PIX..." : `Gerar PIX de ${formattedOrderAmount}`}
                  </button>
                  <p className="text-center text-xs text-slate-500">
                    O QR Code oficial do Mercado Pago aparecerá em instantes.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function PlatformPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-4 text-center text-sm text-white/80 shadow-2xl">
          Carregando...
        </div>
      </div>
    }>
      <PlatformContent />
    </Suspense>
  );
}
