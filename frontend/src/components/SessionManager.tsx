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
import { useMutation } from "@tanstack/react-query";
import clsx from "clsx";

import MercadoPagoBrick from "@/components/MercadoPagoBrick";
import { LucideIcon } from "@/components/LucideIcon";
import useAuth from "@/hooks/useAuth";
import {
  createOrder,
  extractErrorMessage,
  getCreditsBalance,
  type User,
} from "@/lib/api";
import {
  extractCreditsFromBalanceResponse,
  extractCreditsFromUser,
  inferPurchaseFromUser,
} from "@/utils/user-credits";

type SessionStatus =
  | "LOADING"
  | "LOGGED_OUT"
  | "READY_FOR_PLATFORM"
  | "NEEDS_PAYMENT"
  | "PAYMENT_IN_PROGRESS";

type PaymentStatus = {
  title: string;
  message: string;
  type: "Info" | "success" | "error";
};

interface SessionManagerContextValue {
  status: SessionStatus;
  isPaymentModalOpen: boolean;
  isPaymentStatusOpen: boolean;
  paymentStatus: PaymentStatus | null;
  openPaymentModal: () => boolean;
  closePaymentModal: () => void;
  showPaymentStatus: (status: PaymentStatus) => void;
  hidePaymentStatus: () => void;
}

const SessionManagerContext = createContext<
  SessionManagerContextValue | undefined
>(undefined);

const DEFAULT_CREDIT_PRICE = 5;

declare global {
  interface Window {
    __SESSION_MANAGER_DEBUG__?: boolean;
  }
}

type DebugPayload = Record<string, unknown>;

const isDebugEnabled = () =>
  typeof window !== "undefined" && Boolean(window.__SESSION_MANAGER_DEBUG__);

const debugLog = (event: string, payload: DebugPayload = {}) => {
  if (!isDebugEnabled()) {
    return;
  }
  const timestamp = new Date().toISOString();
  console.log(`[SessionManager][${timestamp}] ${event}`, payload);
};

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
  const { user, isAuthenticated, isLoading, refresh, setUser } = useAuth();

  const [status, setStatus] = useState<SessionStatus>("LOADING");
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isPaymentStatusOpen, setIsPaymentStatusOpen] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(
    null,
  );
  const [preferenceId, setPreferenceId] = useState<string | null>(null);
  const [orderAmount, setOrderAmount] = useState<number>(DEFAULT_CREDIT_PRICE);
  const [isPollingCredits, setIsPollingCredits] = useState(false);
  const [hasPromptedPayment, setHasPromptedPayment] = useState(false);
  const [hasShownSuccess, setHasShownSuccess] = useState(false);
  const [hasConfirmedCredits, setHasConfirmedCredits] = useState(false);
  const [latestBalanceCredits, setLatestBalanceCredits] = useState(0);
  const [isAwaitingConfirmation, setIsAwaitingConfirmation] = useState(false);
  const isPollingCreditsRef = useRef(false);
  

  const latestBalanceCreditsRef = useRef(0);
  const isBalanceCheckInFlightRef = useRef(false);

  const balancePollingIntervalRef = useRef<number | null>(null);
  const balancePollingTimeoutRef = useRef<number | null>(null);
  const redirectDelayTimeoutRef = useRef<number | null>(null);
  const lastConfirmedUserRef = useRef<User | null>(null);

  const prevStatusRef = useRef<SessionStatus>(status);
  const prevModalOpenRef = useRef(isPaymentModalOpen);
  const prevPreferenceRef = useRef<string | null>(preferenceId);
  const prevAuthRef = useRef<boolean | null>(null);

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }),
    [],
  );

  const stopBalancePolling = useCallback((reason: string = "cleanup") => {
    const hadInterval = Boolean(balancePollingIntervalRef.current);
    const hadTimeout = Boolean(balancePollingTimeoutRef.current);
    const wasPolling = isPollingCreditsRef.current;

    if (hadInterval) {
      window.clearInterval(balancePollingIntervalRef.current!);
      balancePollingIntervalRef.current = null;
    }
    if (hadTimeout) {
      window.clearTimeout(balancePollingTimeoutRef.current!);
      balancePollingTimeoutRef.current = null;
    }

    if (hadInterval || hadTimeout || wasPolling) {
      debugLog("stopBalancePolling", { reason, hadInterval, hadTimeout });
    }

    isPollingCreditsRef.current = false;
  }, []);

  const resetBalanceTracking = useCallback(
    (reason: string) => {
      const previous = latestBalanceCreditsRef.current;
      if (previous !== 0) {
        debugLog("balance:reset", { reason, previous });
      }

      latestBalanceCreditsRef.current = 0;
      setLatestBalanceCredits(0);
    },
    [],
  );

  const showPaymentStatus = useCallback((info: PaymentStatus) => {
    debugLog("paymentStatus:show", info);

    setPaymentStatus(info);

    setIsPaymentStatusOpen(true);
  }, []);

  const hidePaymentStatus = useCallback(() => {
    debugLog("paymentStatus:hide", { wasOpen: isPaymentStatusOpen });

    setIsPaymentStatusOpen(false);
  }, [isPaymentStatusOpen]);

  const finalizeAccessReadyState = useCallback(() => {
    stopBalancePolling("credits-detected");
    resetBalanceTracking("finalizeAccessReadyState");
    setPreferenceId(null);
    setOrderAmount(DEFAULT_CREDIT_PRICE);
    if (isPaymentModalOpen) {
      setIsPaymentModalOpen(false);
    }
    if (hasPromptedPayment) {
      setHasPromptedPayment(false);
    }
    if (isPaymentStatusOpen) {
      hidePaymentStatus();
    }
    if (hasShownSuccess) {
      setHasShownSuccess(false);
    }
    if (isAwaitingConfirmation) {
      setIsAwaitingConfirmation(false);
    }
    if (status !== "READY_FOR_PLATFORM") {
      setStatus("READY_FOR_PLATFORM");
    }
  }, [
    isAwaitingConfirmation,
    hasPromptedPayment,
    hasShownSuccess,
    hidePaymentStatus,
    isPaymentModalOpen,
    isPaymentStatusOpen,
    resetBalanceTracking,
    status,
    stopBalancePolling,
  ]);

  const checkCreditsBalance = useCallback(
    async (context: string) => {
      if (!isAuthenticated) {
        debugLog("balance:check:skipped", {
          context,
          reason: "not_authenticated",
        });
        return null;
      }

      if (isBalanceCheckInFlightRef.current) {
        debugLog("balance:check:skipped", {
          context,
          reason: "in_flight",
        });
        return null;
      }

      isBalanceCheckInFlightRef.current = true;

      try {
        const response = await getCreditsBalance();
        const credits = extractCreditsFromBalanceResponse(response);
        const previous = latestBalanceCreditsRef.current;

        if (previous !== credits) {
          latestBalanceCreditsRef.current = credits;
          setLatestBalanceCredits(credits);
          debugLog("balance:update", { context, previous, next: credits });
        } else {
          debugLog("balance:update:noop", { context, value: credits });
        }

        if (credits > 0 && previous <= 0) {
          debugLog("balance:detected", { context, credits });
        }

        if (credits > 0 && extractCreditsFromUser(user) <= 0) {
          debugLog("balance:triggerRefresh", { context });
          void refresh();
        }

        return credits;
      } catch (error) {
        const message = extractErrorMessage(error);
        console.error("Erro ao verificar saldo de créditos", error);
        debugLog("balance:check:error", { context, message });
        return null;
      } finally {
        isBalanceCheckInFlightRef.current = false;
      }
    },
    [isAuthenticated, refresh, user],
  );

  const startBalancePolling = useCallback(
    (options?: { immediate?: boolean }) => {
      if (isPollingCreditsRef.current) {
        debugLog("startBalancePolling:skipped", { reason: "already_polling" });
        return;
      }

      const immediate = options?.immediate ?? true;

      debugLog("startBalancePolling:start", {
        intervalMs: 4000,
        timeoutMs: 120000,
      });
      stopBalancePolling("restart");
      isPollingCreditsRef.current = true;
      setIsAwaitingConfirmation(true);
      void refresh();
      if (immediate) {
        void checkCreditsBalance("polling:start");
      }

      balancePollingIntervalRef.current = window.setInterval(() => {
        debugLog("startBalancePolling:tick", {});
        void refresh();
        void checkCreditsBalance("polling:tick");
      }, 4000);

      balancePollingTimeoutRef.current = window.setTimeout(
        () => {
          debugLog("startBalancePolling:timeout", {});
          stopBalancePolling("timeout");
          showPaymentStatus({
            title: "Pagamento em processamento",
            message:
              "Ainda não recebemos a confirmação do pagamento. Assim que o Mercado Pago aprovar, vamos atualizar seus créditos automaticamente.",
            type: "Info",
          });
        },
        2 * 60 * 1000,
      );
    },
    [checkCreditsBalance, refresh, showPaymentStatus, stopBalancePolling],
  );

  const clearConfirmationState = useCallback(
    (reason: string) => {
      const hadTimer = Boolean(redirectDelayTimeoutRef.current);
      if (hadTimer) {
        window.clearTimeout(redirectDelayTimeoutRef.current!);
        redirectDelayTimeoutRef.current = null;
      }
      const hadSnapshot = Boolean(lastConfirmedUserRef.current);
      if (hasConfirmedCredits || hadTimer || hadSnapshot) {
        debugLog("confirmation:clear", {
          reason,
          hadTimer,
          hadSnapshot,
          wasConfirmed: hasConfirmedCredits,
        });
      }
      if (hasConfirmedCredits) {
        setHasConfirmedCredits(false);
      }
      if (isAwaitingConfirmation) {
        setIsAwaitingConfirmation(false);
      }
      resetBalanceTracking(reason);
      lastConfirmedUserRef.current = null;
    },
    [hasConfirmedCredits, isAwaitingConfirmation, resetBalanceTracking],
  );

  const scheduleRedirectAfterConfirmation = useCallback(() => {
    if (redirectDelayTimeoutRef.current) {
      return;
    }
    // Hold the success modal visible for a short time before redirecting.
    debugLog("confirmation:scheduleRedirect", { delayMs: 2000 });
    redirectDelayTimeoutRef.current = window.setTimeout(() => {
      redirectDelayTimeoutRef.current = null;
      debugLog("confirmation:redirect", {});
      finalizeAccessReadyState();
    }, 2000);
  }, [finalizeAccessReadyState]);

  const {
    mutate: triggerCreateOrder,
    reset: resetCreateOrder,
    isPending: isCreatingOrder,
    isError: isCreateOrderError,
    error: createOrderError,
  } = useMutation({
    mutationFn: createOrder,
    onSuccess: (data) => {
      debugLog("createOrder:success", {
        hasPreference: Boolean(data.preference_id),
        amount:
          typeof data.amount === "number" ? data.amount : DEFAULT_CREDIT_PRICE,
      });
      if (data.preference_id) {
        setPreferenceId(data.preference_id);
        if (typeof data.amount === "number") {
          setOrderAmount(data.amount);
        } else {
          setOrderAmount(DEFAULT_CREDIT_PRICE);
        }
      } else {
        debugLog("createOrder:missingPreferenceId", { data });
        setPreferenceId(null);
        setOrderAmount(DEFAULT_CREDIT_PRICE);
        setStatus("NEEDS_PAYMENT");
        showPaymentStatus({
          title: "Erro ao iniciar pagamento",
          message:
            "Não foi possível obter as informações de pagamento. Tente novamente.",
          type: "error",
        });
      }
    },
    onError: (error) => {
      const message = extractErrorMessage(error);
      debugLog("createOrder:error", { message });
      setPreferenceId(null);
      setOrderAmount(DEFAULT_CREDIT_PRICE);
      setStatus("NEEDS_PAYMENT");
      showPaymentStatus({
        title: "N?o foi poss?vel iniciar",
        message,
        type: "error",
      });
    },
  });

  const resetPaymentFlow = useCallback(
    (reason: string) => {
      debugLog("resetPaymentFlow", {
        reason,
        status,
        preferenceId,
        isPaymentModalOpen,
        hasPromptedPayment,
      });
      setPreferenceId(null);
      setOrderAmount(DEFAULT_CREDIT_PRICE);
      setIsPaymentModalOpen(false);
      setIsPaymentStatusOpen(false);
      setPaymentStatus(null);
      setHasPromptedPayment(false);
      setHasShownSuccess(false);
      clearConfirmationState(reason);
      stopBalancePolling("reset");
      resetCreateOrder();
    },
    [
      hasPromptedPayment,
      isPaymentModalOpen,
      preferenceId,
      resetCreateOrder,
      status,
      stopBalancePolling,
      clearConfirmationState,
    ],
  );

  const openPaymentModal = useCallback(() => {
    const allowed = Boolean(isAuthenticated);
    debugLog("openPaymentModal", { allowed, status, isPaymentModalOpen });
    if (!allowed) {
      return false;
    }

    setIsPaymentModalOpen(true);
    setHasPromptedPayment(true);
    if (status === "LOGGED_OUT" || status === "LOADING") {
      setStatus("NEEDS_PAYMENT");
    }
    return true;
  }, [isAuthenticated, isPaymentModalOpen, status]);

  const closePaymentModal = useCallback(() => {
    debugLog("closePaymentModal", { status, preferenceId, isPaymentModalOpen });
    setIsPaymentModalOpen(false);
    setPreferenceId(null);
    setOrderAmount(DEFAULT_CREDIT_PRICE);
    if (!hasConfirmedCredits) {
      clearConfirmationState("closePaymentModal");
    }
    stopBalancePolling("closeModal");
    resetCreateOrder();
    if (status === "PAYMENT_IN_PROGRESS") {
      setStatus("NEEDS_PAYMENT");
    }
  }, [
    clearConfirmationState,
    hasConfirmedCredits,
    isPaymentModalOpen,
    preferenceId,
    resetCreateOrder,
    status,
    stopBalancePolling,
  ]);

  const handleGeneratePix = useCallback(() => {
    if (isCreatingOrder) {
      debugLog("handleGeneratePix:blocked", { reason: "pending_request" });
      return;
    }

    debugLog("handleGeneratePix:start", { status, preferenceId });
    clearConfirmationState("generatePix");
    setPreferenceId(null);
    setOrderAmount(DEFAULT_CREDIT_PRICE);
    setPaymentStatus(null);
    resetCreateOrder();
    setStatus("PAYMENT_IN_PROGRESS");
    triggerCreateOrder();
  }, [
    clearConfirmationState,
    isCreatingOrder,
    preferenceId,
    resetCreateOrder,
    status,
    triggerCreateOrder,
  ]);

  const handleCheckBalance = useCallback(async () => {
    debugLog("handleCheckBalance", {});
    showPaymentStatus({
      title: "Estamos verificando",
      message:
        "Atualizamos suas informações. Assim que novos créditos forem detectados, você será redirecionado automaticamente para a plataforma.",
      type: "Info",
    });
    startBalancePolling({ immediate: false });
    await refresh();
    await checkCreditsBalance("manual-check");
  }, [
    checkCreditsBalance,
    refresh,
    startBalancePolling,
    showPaymentStatus,
  ]);

  const handlePaymentSuccess = useCallback(async () => {
    debugLog("handlePaymentSuccess", { status, preferenceId });
    startBalancePolling({ immediate: false });
    showPaymentStatus({
      title: "Confirmando pagamento",
      message:
        "Estamos verificando o crédito do seu PIX. Assim que o saldo for liberado, você será redirecionado automaticamente para a plataforma.",
      type: "Info",
    });
    await refresh();
    await checkCreditsBalance("payment-success");
  }, [
    checkCreditsBalance,
    preferenceId,
    refresh,
    showPaymentStatus,
    startBalancePolling,
    status,
  ]);

  useEffect(() => {
    if (prevStatusRef.current !== status) {
      debugLog("status:transition", {
        from: prevStatusRef.current,
        to: status,
      });
      prevStatusRef.current = status;
    }
  }, [status]);

  useEffect(() => {
    if (prevModalOpenRef.current !== isPaymentModalOpen) {
      debugLog("modal:visibility", { open: isPaymentModalOpen, status });
      prevModalOpenRef.current = isPaymentModalOpen;
    }
  }, [isPaymentModalOpen, status]);

  useEffect(() => {
    if (prevPreferenceRef.current !== preferenceId) {
      debugLog("preference:change", {
        from: prevPreferenceRef.current,
        to: preferenceId,
      });
      prevPreferenceRef.current = preferenceId;
    }
  }, [preferenceId]);

  useEffect(() => {
    if (prevAuthRef.current !== isAuthenticated) {
      debugLog("auth:change", { isAuthenticated, status });
      prevAuthRef.current = isAuthenticated;
    }
  }, [isAuthenticated, status]);

  useEffect(() => {
    return () => {
      stopBalancePolling("unmount");
      if (redirectDelayTimeoutRef.current) {
        window.clearTimeout(redirectDelayTimeoutRef.current);
        redirectDelayTimeoutRef.current = null;
      }
    };
  }, [stopBalancePolling]);

  useEffect(() => {
    if (isLoading) {
      if (status !== "LOADING") {
        debugLog("status:update", { to: "LOADING", reason: "auth-loading" });
        setStatus("LOADING");
      }
      return;
    }

    if (!isAuthenticated) {
      if (status === "PAYMENT_IN_PROGRESS") {
        debugLog("auth:missingWhilePayment", {
          isLoading,
          preferenceId,
          isPaymentModalOpen,
        });
        return;
      }

      if (status !== "LOGGED_OUT") {
        debugLog("status:update", { to: "LOGGED_OUT", reason: "auth-missing" });
        setStatus("LOGGED_OUT");
      }
      resetPaymentFlow("auth-missing");
      return;
    }

    const credits = extractCreditsFromUser(user);
    const hasPurchase = inferPurchaseFromUser(user);
    const balanceCredits = latestBalanceCredits;
    const hasBalanceCredits = balanceCredits > 0;
    const detectedCredits = credits > 0 || hasPurchase || hasBalanceCredits;

    if (detectedCredits) {
      lastConfirmedUserRef.current = user;
      if (!hasConfirmedCredits) {
        debugLog("credits:confirmed", {
          credits,
          balanceCredits,
          hasPurchase,
          source:
            credits > 0 || hasPurchase ? "session" : "balance-api",
        });
        setHasConfirmedCredits(true);
        stopBalancePolling("credits-detected");
      }

      if (isAwaitingConfirmation) {
        if (!hasShownSuccess) {
          setHasShownSuccess(true);
        }

        if (!paymentStatus || paymentStatus.type !== "success") {
          showPaymentStatus({
            title: "Pagamento aprovado",
            message: "Atualizando seu acesso para a plataforma...",
            type: "success",
          });
        }
      } else if (
        isPaymentStatusOpen &&
        paymentStatus &&
        paymentStatus.type === "Info"
      ) {
        hidePaymentStatus();
      }

      scheduleRedirectAfterConfirmation();
      return;
    }

    if (!hasShownSuccess) {
        setHasShownSuccess(true);
      }

      if (!paymentStatus || paymentStatus.type !== "success") {
        showPaymentStatus({
          title: "Pagamento aprovado",
          message: "Atualizando seu acesso para a plataforma...",
          type: "success",
        });
      }

    if (hasConfirmedCredits) {
      if (lastConfirmedUserRef.current && user !== lastConfirmedUserRef.current) {
        // Protect against stale polling responses overwriting the confirmed snapshot.
        debugLog("credits:restoreSnapshot", {});
        setUser(lastConfirmedUserRef.current);
      }
      scheduleRedirectAfterConfirmation();
      return;
    }

    if (status === "PAYMENT_IN_PROGRESS") {
      return;
    }

    if (status !== "NEEDS_PAYMENT") {
      setStatus("NEEDS_PAYMENT");
    }

    if (!hasPromptedPayment) {
      setIsPaymentModalOpen(true);
      setHasPromptedPayment(true);
    }
  }, [
    hasConfirmedCredits,
    hasPromptedPayment,
    hasShownSuccess,
    hidePaymentStatus,
    isAuthenticated,
    isAwaitingConfirmation,
    isLoading,
    isPaymentModalOpen,
    isPaymentStatusOpen,
    latestBalanceCredits,
    paymentStatus,
    preferenceId,
    resetPaymentFlow,
    scheduleRedirectAfterConfirmation,
    setUser,
    showPaymentStatus,
    status,
    stopBalancePolling,
    user,
  ]);

  useEffect(() => {
    if (status !== "READY_FOR_PLATFORM" || !isAuthenticated) {
      return;
    }
    if (pathname && pathname.startsWith("/platform")) {
      return;
    }
    debugLog("navigation:redirect-platform", {
      from: pathname ?? null,
      status,
    });
    router.replace("/platform");
  }, [isAuthenticated, pathname, router, status]);

  useEffect(() => {
    if (!pathname) {
      return;
    }
    if (pathname.startsWith("/platform")) {
      return;
    }
    if (status === "PAYMENT_IN_PROGRESS" && !isPaymentModalOpen) {
      debugLog("modal:forceOpen", { pathname, status });
      setIsPaymentModalOpen(true);
    }
  }, [isPaymentModalOpen, pathname, status]);

  const formattedOrderAmount = useMemo(
    () => currencyFormatter.format(orderAmount),
    [currencyFormatter, orderAmount],
  );

  const contextValue = useMemo<SessionManagerContextValue>(
    () => ({
      status,
      isPaymentModalOpen,
      isPaymentStatusOpen,
      paymentStatus,
      openPaymentModal,
      closePaymentModal,
      showPaymentStatus,
      hidePaymentStatus,
    }),
    [
      hidePaymentStatus,
      isPaymentModalOpen,
      isPaymentStatusOpen,
      openPaymentModal,
      closePaymentModal,
      paymentStatus,
      showPaymentStatus,
      status,
    ],
  );

  return (
    <SessionManagerContext.Provider value={contextValue}>
      {children}

      {isPaymentStatusOpen && paymentStatus ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/70 px-3 sm:px-4">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-5 text-center shadow-2xl sm:p-6 md:p-7">
            <button
              type="button"
              onClick={hidePaymentStatus}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
              title="Fechar aviso"
            >
              <LucideIcon name="X" className="h-5 w-5" />
            </button>
            <LucideIcon
              name={
                paymentStatus.type === "success"
                  ? "CircleCheckBig"
                  : paymentStatus.type === "error"
                    ? "TriangleAlert"
                    : "Info"
              }
              className={clsx(
                "mx-auto mb-4 h-12 w-12",
                paymentStatus.type === "success"
                  ? "text-green-500"
                  : paymentStatus.type === "error"
                    ? "text-red-500"
                    : "text-slate-500",
              )}
            />
            <h2 className="mb-2 text-xl font-bold text-slate-800">
              {paymentStatus.title}
            </h2>
            <p className="text-slate-700">{paymentStatus.message}</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                className="flex-1 rounded-lg bg-green-600 py-2.5 font-semibold text-white hover:bg-green-700"
                onClick={hidePaymentStatus}
              >
                Continuar
              </button>
              <button
                type="button"
                className="flex-1 rounded-lg bg-slate-200 py-2.5 font-semibold text-slate-800 hover:bg-slate-300"
                onClick={hidePaymentStatus}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
            {isCreateOrderError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {extractErrorMessage(createOrderError)}
              </div>
            )}
            <div className="mt-5 flex-1">
              {preferenceId ? (
                <MercadoPagoBrick
                  preferenceId={preferenceId}
                  onPaymentCreated={() => startBalancePolling()}
                  onPaymentSuccess={handlePaymentSuccess}
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
            <div className="mt-5 flex-shrink-0 border-t border-slate-100 pt-4 text-center">
              <button
                type="button"
                className="text-xs font-medium text-green-700 hover:text-green-800 sm:text-sm"
                onClick={handleCheckBalance}
              >
                Já paguei, verificar saldo
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </SessionManagerContext.Provider>
  );
}
