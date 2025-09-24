"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import clsx from "clsx";

import MercadoPagoBrick from "@/components/MercadoPagoBrick";
import { LucideIcon } from "@/components/LucideIcon";
import useAuth from "@/hooks/useAuth";
import {
  createOrder,
  extractErrorMessage,
  getPaymentState,
  type PaymentStateResponse,
} from "@/lib/api";

const DEFAULT_CREDIT_PRICE = 5;

export type SessionStatus =
  | "LOADING"
  | "LOGGED_OUT"
  | "READY_FOR_PLATFORM"
  | "AWAITING_PAYMENT"
  | "NEEDS_PAYMENT"
  | "PAYMENT_FAILED";

interface SessionManagerContextValue {
  status: SessionStatus;
  paymentState: PaymentStateResponse | null;
  isPaymentModalOpen: boolean;
  openPaymentModal: () => boolean;
  closePaymentModal: () => void;
  refetchPaymentState: () => Promise<PaymentStateResponse | undefined>;
  isFetchingPaymentState: boolean;
}

const SessionManagerContext = createContext<
  SessionManagerContextValue | undefined
>(undefined);

export function useSessionManager() {
  const context = useContext(SessionManagerContext);
  if (!context) {
    throw new Error("useSessionManager must be used within SessionManager");
  }
  return context;
}

export default function SessionManager({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, refresh } = useAuth();

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [preferenceId, setPreferenceId] = useState<string | null>(null);
  const [orderAmount, setOrderAmount] = useState<number>(DEFAULT_CREDIT_PRICE);
  const readyRefreshTriggeredRef = useRef(false);
  const autoOpenTriggeredRef = useRef(false);

  const paymentStateQuery = useQuery({
    queryKey: ["payment-status"],
    queryFn: getPaymentState,
    enabled: isAuthenticated,
    refetchInterval: (query) =>
      query.state.data?.state === "awaiting_payment" ? 5000 : false,
  });

  const paymentState = paymentStateQuery.data ?? null;

  const status = useMemo<SessionStatus>(() => {
    if (isLoading) {
      return "LOADING";
    }
    if (!isAuthenticated) {
      return "LOGGED_OUT";
    }
    if (paymentStateQuery.isLoading) {
      return "LOADING";
    }

    switch (paymentState?.state) {
      case "ready_for_platform":
        return "READY_FOR_PLATFORM";
      case "awaiting_payment":
        return "AWAITING_PAYMENT";
      case "payment_failed":
        return "PAYMENT_FAILED";
      case "needs_payment":
      default:
        return "NEEDS_PAYMENT";
    }
  }, [
    isAuthenticated,
    isLoading,
    paymentState?.state,
    paymentStateQuery.isLoading,
  ]);

  const {
    mutate: triggerCreateOrder,
    reset: resetCreateOrder,
    isPending: isCreatingOrder,
    isError: isCreateOrderError,
    error: createOrderError,
  } = useMutation({
    mutationFn: createOrder,
    onSuccess: (data) => {
      if (data.preference_id) {
        setPreferenceId(data.preference_id);
        if (typeof data.amount === "number") {
          setOrderAmount(data.amount);
        } else {
          setOrderAmount(DEFAULT_CREDIT_PRICE);
        }
      } else {
        setPreferenceId(null);
        setOrderAmount(DEFAULT_CREDIT_PRICE);
      }
    },
    onError: () => {
      setPreferenceId(null);
      setOrderAmount(DEFAULT_CREDIT_PRICE);
    },
  });

  const refetchPaymentState = useCallback(async () => {
    const result = await paymentStateQuery.refetch();
    return result.data;
  }, [paymentStateQuery]);

  const openPaymentModal = useCallback(() => {
    if (!isAuthenticated) {
      return false;
    }
    setIsPaymentModalOpen(true);
    return true;
  }, [isAuthenticated]);

  const closePaymentModal = useCallback(() => {
    setIsPaymentModalOpen(false);
    setPreferenceId(null);
    setOrderAmount(DEFAULT_CREDIT_PRICE);
    resetCreateOrder();
  }, [resetCreateOrder]);

  const handleGeneratePix = useCallback(() => {
    resetCreateOrder();
    setPreferenceId(null);
    setOrderAmount(DEFAULT_CREDIT_PRICE);
    triggerCreateOrder();
  }, [resetCreateOrder, triggerCreateOrder]);

  const handlePaymentCreated = useCallback(() => {
    void refetchPaymentState();
  }, [refetchPaymentState]);

  const handleCheckPayment = useCallback(async () => {
    await refetchPaymentState();
    if (isAuthenticated) {
      await refresh();
    }
  }, [isAuthenticated, refetchPaymentState, refresh]);

  useEffect(() => {
    if (!isAuthenticated) {
      setIsPaymentModalOpen(false);
      setPreferenceId(null);
      setOrderAmount(DEFAULT_CREDIT_PRICE);
      resetCreateOrder();
      if (!isLoading) {
      readyRefreshTriggeredRef.current = false;
    }
      autoOpenTriggeredRef.current = false;
      return;
    }

    if (status === "READY_FOR_PLATFORM") {
      if (!readyRefreshTriggeredRef.current) {
        readyRefreshTriggeredRef.current = true;
        void refresh();
      }
      if (isPaymentModalOpen) {
        setIsPaymentModalOpen(false);
        setPreferenceId(null);
      }
      if (pathname && !pathname.startsWith("/platform")) {
        router.replace("/platform");
      }
      return;
    }

    readyRefreshTriggeredRef.current = false;

    if (
      status === "NEEDS_PAYMENT" &&
      isAuthenticated &&
      !isPaymentModalOpen &&
      pathname &&
      !pathname.startsWith("/platform") &&
      !autoOpenTriggeredRef.current
    ) {
      autoOpenTriggeredRef.current = true;
      setIsPaymentModalOpen(true);
    }

    if (status === "AWAITING_PAYMENT") {
      autoOpenTriggeredRef.current = true;
    }
  }, [
    isAuthenticated,
    isLoading,
    isPaymentModalOpen,
    pathname,
    refresh,
    router,
    status,
    resetCreateOrder,
  ]);

  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }),
    [],
  );

  const formattedOrderAmount = useMemo(
    () => currencyFormatter.format(orderAmount),
    [currencyFormatter, orderAmount],
  );

  const contextValue = useMemo<SessionManagerContextValue>(
    () => ({
      status,
      paymentState,
      isPaymentModalOpen,
      openPaymentModal,
      closePaymentModal,
      refetchPaymentState,
      isFetchingPaymentState: paymentStateQuery.isFetching,
    }),
    [
      closePaymentModal,
      isPaymentModalOpen,
      openPaymentModal,
      paymentState,
      paymentStateQuery.isFetching,
      refetchPaymentState,
      status,
    ],
  );

  return (
    <SessionManagerContext.Provider value={contextValue}>
      {children}

      {isPaymentModalOpen ? (
        <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/60 px-3 py-6 sm:px-4 sm:py-8 md:items-center">
          <div className="relative flex w-full max-w-sm flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:max-w-md sm:p-6">
            <button
              type="button"
              onClick={closePaymentModal}
              className="absolute right-4 top-4 text-slate-400 transition hover:text-slate-600"
              title="Fechar"
            >
              <LucideIcon name="X" className="h-5 w-5" />
            </button>
            <div className="flex-shrink-0 pr-5 sm:pr-7">
              <h3 className="text-lg font-semibold text-slate-900 sm:text-xl">
                Gerar pagamento PIX
              </h3>
              <p className="mt-1 text-xs text-slate-600 sm:text-sm">
                Valor único de {formattedOrderAmount}.
              </p>
            </div>
            {isCreateOrderError ? (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {extractErrorMessage(createOrderError)}
              </div>
            ) : null}
            <div className="mt-5 flex-1">
              {preferenceId ? (
                <MercadoPagoBrick
                  preferenceId={preferenceId}
                  onPaymentCreated={handlePaymentCreated}
                  formattedAmount={formattedOrderAmount}
                />
              ) : (
                <div className="flex h-full flex-col justify-center gap-4">
                  <button
                    type="button"
                    className="w-full rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 sm:text-base disabled:cursor-not-allowed disabled:opacity-70"
                    onClick={handleGeneratePix}
                    disabled={isCreatingOrder}
                  >
                    {isCreatingOrder
                      ? "Gerando PIX..."
                      : `Gerar PIX de ${formattedOrderAmount}`}
                  </button>
                  <p className="text-center text-xs text-slate-500">
                    Você verá o QR Code oficial do Mercado Pago em seguida.
                  </p>
                </div>
              )}
            </div>
            <div className="mt-5 flex flex-col gap-2 border-t border-slate-100 pt-4 text-xs text-slate-600 sm:text-sm">
              {status === "AWAITING_PAYMENT" ? (
                <p className="text-center text-slate-600">
                  Pagamento criado. Estamos aguardando a confirmação do Mercado Pago.
                </p>
              ) : null}
              {status === "PAYMENT_FAILED" ? (
                <p className="text-center text-red-600">
                  O pagamento foi recusado ou expirou. Gere um novo PIX para tentar novamente.
                </p>
              ) : null}
              <button
                type="button"
                className={clsx(
                  "text-center font-semibold text-green-700 transition hover:text-green-800",
                  paymentStateQuery.isFetching && "opacity-60",
                )}
                onClick={handleCheckPayment}
                disabled={paymentStateQuery.isFetching}
              >
                Já paguei, verificar status
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </SessionManagerContext.Provider>
  );
}