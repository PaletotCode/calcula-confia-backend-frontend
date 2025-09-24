"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { initMercadoPago } from "@mercadopago/sdk-react";

import {
  extractErrorMessage,
  processPixPayment,
  type PixPaymentResponse,
} from "@/lib/api";
import { LucideIcon } from "@/components/LucideIcon";

interface MercadoPagoBrickProps {
  preferenceId: string;
  onPaymentCreated?: (paymentId: string | number) => void;
  onPaymentSuccess?: () => void;
  formattedAmount?: string;
}

type CheckoutStep = "idle" | "processing" | "status";

type PixPaymentStatus = PixPaymentResponse & {
  id: string | number;
};


let isMercadoPagoInitialized = false;

export default function MercadoPagoBrick({
  preferenceId,
  onPaymentCreated,
  onPaymentSuccess,
  formattedAmount,
}: MercadoPagoBrickProps) {
  const publicKey = process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY ?? "";
  const autoStartRef = useRef<string | null>(null);
  const copyFeedbackTimerRef = useRef<number | null>(null);
  const [step, setStep] = useState<CheckoutStep>("idle");
  const [paymentInfo, setPaymentInfo] = useState<PixPaymentStatus | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">(
    "idle",
  );

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
    autoStartRef.current = null;
    setIsProcessing(false);
    setCopyStatus("idle");

    if (copyFeedbackTimerRef.current) {
      window.clearTimeout(copyFeedbackTimerRef.current);
      copyFeedbackTimerRef.current = null;
    }

  }, [preferenceId]);

  useEffect(() => {
    return () => {
      if (copyFeedbackTimerRef.current) {
        window.clearTimeout(copyFeedbackTimerRef.current);
        copyFeedbackTimerRef.current = null;
      }
    };
  }, []);

  const handleGeneratePix = useCallback(async () => {
    if (!preferenceId || isProcessing) {
      return;
    }

    setErrorMessage(null);
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

      if (info.status === "approved") {
        onPaymentSuccess?.();
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
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 sm:text-sm">
      Gerando pagamento PIX seguro...
    </div>
  );

  const renderRetry = () => (
    <div className="space-y-2 text-center">
      <p className="text-xs text-slate-600 sm:text-sm">
        Não foi possível gerar o PIX. Tente novamente.
      </p>
      <button
        type="button"
        className="inline-flex w-full items-center justify-center rounded-xl bg-green-600 px-4 py-2.5 text-xs font-semibold sm:text-sm text-white transition hover:bg-green-700 disabled:opacity-60"
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

    const transactionData =
      paymentInfo.point_of_interaction?.transaction_data ?? {};
    const qrCodeBase64 =
      typeof transactionData.qr_code_base64 === "string"
        ? transactionData.qr_code_base64
        : null;
    const qrCodeImageSrc = qrCodeBase64
      ? qrCodeBase64.startsWith("data:image")
        ? qrCodeBase64
        : `data:image/png;base64,${qrCodeBase64}`
      : null;
    const pixCode =
      typeof transactionData.qr_code === "string"
        ? transactionData.qr_code
        : "";
    const ticketUrl =
      typeof transactionData.ticket_url === "string"
        ? transactionData.ticket_url
        : "";

    return (
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100 text-green-600">
              <LucideIcon name="QrCode" className="h-5 w-5" />
            </span>
            <div className="space-y-1">
              <h4 className="text-base font-semibold text-slate-900 sm:text-lg">
                Falta pouco!
              </h4>
              <p className="text-xs text-slate-600 sm:text-sm">
                {formattedAmount
                  ? `Conclua o pagamento do PIX de ${formattedAmount} para liberar seu acesso.`
                  : "Conclua o pagamento do PIX para liberar seu acesso."}
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-600 sm:text-sm">
            Use o aplicativo do seu banco para escanear o QR Code ou copie o código PIX abaixo.
          </p>
        </div>

        {qrCodeImageSrc ? (
          <div className="flex justify-center">
            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrCodeImageSrc}
                alt="QR Code do pagamento PIX"
                className="h-44 w-44 max-w-full object-contain sm:h-52 sm:w-52"
              />
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 sm:text-sm">
            Não foi possível carregar o QR Code automaticamente. Utilize o código PIX abaixo para concluir o pagamento.
          </div>
        )}

        {pixCode ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={async () => {
                if (!pixCode) {
                  return;
                }
                if (typeof window === "undefined") {
                  return;
                }

                if (copyFeedbackTimerRef.current) {
                  window.clearTimeout(copyFeedbackTimerRef.current);
                  copyFeedbackTimerRef.current = null;
                }

                try {
                  if (
                    typeof navigator !== "undefined" &&
                    navigator.clipboard &&
                    typeof navigator.clipboard.writeText === "function"
                  ) {
                    await navigator.clipboard.writeText(pixCode);
                  } else if (typeof document !== "undefined") {
                    const textarea = document.createElement("textarea");
                    textarea.value = pixCode;
                    textarea.style.position = "fixed";
                    textarea.style.opacity = "0";
                    textarea.setAttribute("readonly", "readonly");
                    document.body.appendChild(textarea);
                    textarea.focus();
                    textarea.select();
                    const successful = document.execCommand("copy");
                    document.body.removeChild(textarea);
                    if (!successful) {
                      throw new Error("copy command was not successful");
                    }
                  }

                  setCopyStatus("copied");
                  copyFeedbackTimerRef.current = window.setTimeout(() => {
                    setCopyStatus("idle");
                    copyFeedbackTimerRef.current = null;
                  }, 3000);
                } catch (error) {
                  console.error("Erro ao copiar código PIX", error);
                  setCopyStatus("error");
                  copyFeedbackTimerRef.current = window.setTimeout(() => {
                    setCopyStatus("idle");
                    copyFeedbackTimerRef.current = null;
                  }, 4000);
                }
              }}
              className={clsx(
                "inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition sm:text-sm",
                copyStatus === "copied"
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "bg-slate-900 text-white hover:bg-slate-800",
              )}
            >
              <LucideIcon
                name={copyStatus === "copied" ? "Check" : "Copy"}
                className="h-4 w-4"
              />
              {copyStatus === "copied" ? "Código PIX copiado" : "Copiar código PIX"}
            </button>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="max-h-32 overflow-y-auto break-all font-mono text-[11px] text-slate-800 sm:text-xs">
                {pixCode}
              </p>
            </div>
            <p
              role="status"
              className={clsx(
                "text-center text-[11px] sm:text-xs",
                copyStatus === "copied"
                  ? "font-medium text-green-600"
                  : copyStatus === "error"
                    ? "font-medium text-red-600"
                    : "text-slate-500",
              )}
            >
              {copyStatus === "copied"
                ? "Código copiado! Abra o aplicativo do seu banco e cole na opção PIX Copia e Cola."
                : copyStatus === "error"
                  ? "Não foi possível copiar automaticamente. Selecione o código acima e copie manualmente."
                  : "Se preferir, selecione o código acima e copie manualmente."}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 sm:text-sm">
            Não conseguimos carregar o código PIX. Feche o modal e gere um novo pagamento.
          </div>
        )}

        {ticketUrl ? (
          <a
            href={ticketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 sm:text-sm"
          >
            Abrir comprovante no Mercado Pago
          </a>
        ) : null}
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
    <div className="space-y-3">
      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 sm:text-sm">
          {errorMessage}
        </div>
      )}
      {content}
    </div>
  );
}
