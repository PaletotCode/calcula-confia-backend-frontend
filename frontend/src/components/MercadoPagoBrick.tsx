"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { initMercadoPago, StatusScreen } from "@mercadopago/sdk-react";
import {
  confirmPayment,
  extractErrorMessage,
  processPixPayment,
  type PixPaymentResponse,
} from "@/lib/api";

interface MercadoPagoBrickProps {
  preferenceId: string;
  onPaymentCreated?: (paymentId: string | number) => void;
  onPaymentSuccess: () => void;
}

type CheckoutStep = "idle" | "processing" | "status";

type PixPaymentStatus = PixPaymentResponse & {
  id: string | number;
};

const PIX_POLLING_INTERVAL_MS = 5000;

let isMercadoPagoInitialized = false;

export default function MercadoPagoBrick({
  preferenceId,
  onPaymentCreated,
  onPaymentSuccess,
}: MercadoPagoBrickProps) {
  const publicKey = process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY ?? "";
  const hasReportedSuccess = useRef(false);
  const pollingTimerRef = useRef<number | null>(null);
  const autoStartRef = useRef<string | null>(null);
  const [step, setStep] = useState<CheckoutStep>("idle");
  const [paymentInfo, setPaymentInfo] = useState<PixPaymentStatus | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusScreenFailed, setStatusScreenFailed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!publicKey) {
      setErrorMessage(
        "Não foi possível inicializar o checkout. Configure a chave pública do Mercado Pago."
      );
      return;
    }

    if (isMercadoPagoInitialized) {
      return;
    }

    initMercadoPago(publicKey, { locale: "pt-BR" });
    isMercadoPagoInitialized = true;
  }, [publicKey]);

  useEffect(() => {
    setStep("idle");
    setPaymentInfo(null);
    setErrorMessage(null);
    setStatusScreenFailed(false);
    hasReportedSuccess.current = false;
    autoStartRef.current = null;
    setIsProcessing(false);

    if (pollingTimerRef.current) {
      window.clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  }, [preferenceId]);

  useEffect(() => {
    if (!paymentInfo?.id || hasReportedSuccess.current) {
      return;
    }

    const poll = async () => {
      try {
        const response = await confirmPayment({
          payment_id: String(paymentInfo.id),
          preference_id: preferenceId,
        });

        if (response.credits_added && !hasReportedSuccess.current) {
          hasReportedSuccess.current = true;
          if (pollingTimerRef.current) {
            window.clearInterval(pollingTimerRef.current);
            pollingTimerRef.current = null;
          }
          onPaymentSuccess();
        }
      } catch (error) {
        console.error("Erro ao verificar status do pagamento PIX", error);
      }
    };

    void poll();
    pollingTimerRef.current = window.setInterval(poll, PIX_POLLING_INTERVAL_MS);

    return () => {
      if (pollingTimerRef.current) {
        window.clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
    };
  }, [paymentInfo?.id, preferenceId, onPaymentSuccess]);

  const statusCustomization = useMemo(
    () => ({
      ...(typeof window !== "undefined"
        ? {
            backUrls: {
              return: `${window.location.origin}/platform`,
            },
          }
        : {}),
      visual: {
        hideStatusDetails: false,
        hideTransactionDate: false,
        showExternalReference: false,
      },
    }),
    []
  );

  const handleGeneratePix = useCallback(async () => {
    if (!preferenceId || isProcessing) {
      return;
    }

    setErrorMessage(null);
    setStatusScreenFailed(false);
    setStep("processing");
    setIsProcessing(true);

    try {
      const response = await processPixPayment({
        preference_id: preferenceId,
      });

      const info: PixPaymentStatus = { ...response, id: response.id };
      setPaymentInfo(info);
      setStep("status");
      onPaymentCreated?.(info.id);

      if (info.status === "approved" && !hasReportedSuccess.current) {
        hasReportedSuccess.current = true;
        if (pollingTimerRef.current) {
          window.clearInterval(pollingTimerRef.current);
          pollingTimerRef.current = null;
        }
        onPaymentSuccess();
      }
    } catch (error) {
      console.error("Erro ao gerar PIX", error);
      setErrorMessage(extractErrorMessage(error));
      setStep("idle");
    } finally {
      setIsProcessing(false);
    }
  }, [preferenceId, isProcessing, onPaymentCreated, onPaymentSuccess]);

  useEffect(() => {
    if (!preferenceId) {
      return;
    }

    if (autoStartRef.current === preferenceId) {
      return;
    }

    autoStartRef.current = preferenceId;
    void handleGeneratePix();
  }, [preferenceId, handleGeneratePix]);

  const renderProcessing = () => (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
      Gerando pagamento PIX seguro...
    </div>
  );

  const renderRetry = () => (
    <div className="space-y-3 text-center">
      <p className="text-sm text-slate-600">
        Não foi possível gerar o PIX. Tente novamente.
      </p>
      <button
        type="button"
        className="inline-flex w-full items-center justify-center rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-60"
        onClick={() => {
          autoStartRef.current = null;
          void handleGeneratePix();
        }}
        disabled={isProcessing}
      >
        {isProcessing ? "Recriando PIX..." : "Gerar PIX novamente"}
      </button>
    </div>
  );

  const renderStatusStep = () => {
    if (!paymentInfo) {
      return renderProcessing();
    }

    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        {!statusScreenFailed ? (
          <StatusScreen
            key={paymentInfo.id}
            id="mercado-pago-status-brick"
            locale="pt-BR"
            initialization={{
              paymentId: String(paymentInfo.id),
            }}
            customization={statusCustomization}
            onError={(error) => {
              console.error("Mercado Pago Status Screen", error);
              setStatusScreenFailed(true);
              setErrorMessage(
                "Não foi possível carregar a tela do Mercado Pago. Feche o modal e gere um novo PIX."
              );
            }}
          />
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
            Não foi possível exibir o painel do Mercado Pago. Feche o modal e gere um novo pagamento.
          </div>
        )}
      </div>
    );
  };

  if (!publicKey) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Não foi possível carregar o pagamento. Verifique sua chave pública do Mercado Pago.
      </div>
    );
  }

  let content: JSX.Element;

  switch (step) {
    case "status":
      content = renderStatusStep();
      break;
    case "processing":
      content = renderProcessing();
      break;
    default:
      content = renderRetry();
      break;
  }

  return (
    <div className="space-y-4">
      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}
      {content}
    </div>
  );
}
