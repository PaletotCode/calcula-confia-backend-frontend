"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import {
  BottomHint,
  BillFormViewModel,
  ConfirmationStep,
  ErrorOverlay,
  FormStep,
  LoadingStep,
  ResultStep,
  SelectionStep,
  TimelineItem,
  WelcomeStep,
} from "./CalculatorSteps";

interface MainCalculatorProps {
  onRequestBuyCredits?: () => void;
  onNavigateToHistory?: () => void;
  isVisible?: boolean;
}

type FlowStep = "welcome" | "selection" | "form" | "confirmation" | "loading" | "result";

type BillPayload = {
  icms_value: number;
  issue_date: string;
};

interface FormState extends BillFormViewModel {
  issueDateIso: string;
}

interface OverlayState {
  title: string;
  messages: string[];
  retryStep: FlowStep;
}

const TIMELINE_ITEMS: TimelineItem[] = [
  {
    title: "Validando parâmetros",
    description: "Confirmando dados das faturas e autenticação da sessão.",
  },
  {
    title: "Consultando legislação",
    description: "Buscando referências IPCA e regras fiscais mais recentes.",
  },
  {
    title: "Calculando créditos",
    description: "Aplicando fórmulas avançadas para estimar o valor de restituição.",
  },
  {
    title: "Preparando resumo",
    description: "Gerando seu relatório com indicadores e próximos passos.",
  },
];

const BILL_TOTAL = 12;

const DEFAULT_FORM_STATE: FormState = {
  issueDateValue: "",
  issueDateLabel: "",
  issueDateIso: "",
  icmsValue: "",
};

const formatCurrencyInput = (rawValue: string) => {
  const trimmed = rawValue.replace(/\s/g, '');
  if (!trimmed) {
    return '';
  }

  const endsWithSeparator = /[.,]$/.test(trimmed);
  const hasComma = trimmed.includes(',');
  let decimalIndex = -1;

  if (hasComma) {
    decimalIndex = trimmed.lastIndexOf(',');
  } else {
    const lastDotIndex = trimmed.lastIndexOf('.');
    if (lastDotIndex !== -1) {
      const digitsAfterDot = trimmed.slice(lastDotIndex + 1).replace(/[^0-9]/g, '');
      if (digitsAfterDot.length === 0 && endsWithSeparator) {
        decimalIndex = lastDotIndex;
      } else if (digitsAfterDot.length > 0 && digitsAfterDot.length <= 2) {
        decimalIndex = lastDotIndex;
      }
    }
  }

  let integerRaw = decimalIndex === -1 ? trimmed : trimmed.slice(0, decimalIndex);
  let decimalRaw = decimalIndex === -1 ? '' : trimmed.slice(decimalIndex + 1);

  integerRaw = integerRaw.replace(/[^0-9]/g, '');
  decimalRaw = decimalRaw.replace(/[^0-9]/g, '');

  if (!integerRaw && !decimalRaw) {
    return endsWithSeparator ? '0,' : '';
  }

  const sanitizedInteger = integerRaw.replace(/^0+(?!$)/, '') || '0';
  const integerWithThousands = sanitizedInteger.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  if (decimalIndex === -1) {
    return endsWithSeparator ? `${integerWithThousands},` : integerWithThousands;
  }

  const trimmedDecimals = decimalRaw.slice(0, 2);
  if (!trimmedDecimals && endsWithSeparator) {
    return `${integerWithThousands},`;
  }

  return trimmedDecimals ? `${integerWithThousands},${trimmedDecimals}` : `${integerWithThousands},`;
};

const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const toMonthIso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const toInputValue = (date: Date) => date.toISOString().slice(0, 10);

const toFriendlyLabel = (date: Date) =>
  date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

const parseCurrency = (value: string) => {
  if (!value) {
    return 0;
  }
  const normalized = value.replace(/\./g, "").replace(/,/g, ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const DATE_LIMITS = (() => {
  const maxDate = new Date();
  maxDate.setHours(0, 0, 0, 0);
  const minDate = new Date(maxDate);
  minDate.setFullYear(minDate.getFullYear() - 10);
  return { minDate, maxDate };
})();

const MainCalculator = ({
  onRequestBuyCredits,
  onNavigateToHistory,
  isVisible = true,
}: MainCalculatorProps) => {
  const queryClient = useQueryClient();
  const [flowStep, setFlowStep] = useState<FlowStep>("welcome");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [formStateByBill, setFormStateByBill] = useState<Record<number, FormState>>({});
  const [currentFormIndex, setCurrentFormIndex] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [loadingIndex, setLoadingIndex] = useState(0);
  const [isRequesting, setIsRequesting] = useState(false);
  const [resultAmount, setResultAmount] = useState<string>(formatBRL(0));
  const [overlay, setOverlay] = useState<OverlayState | null>(null);
  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(null);
  const [calculationId, setCalculationId] = useState<number | null>(null);
  const [processingTimeMs, setProcessingTimeMs] = useState<number | null>(null);

  const pendingPayloadRef = useRef<BillPayload[] | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const timelineIntervalRef = useRef<number | null>(null);
  const autoTransitionTimeoutRef = useRef<number | null>(null);

  const orderedFormStates: FormState[] = useMemo(
    () => selectedIds.map((id) => formStateByBill[id] ?? { ...DEFAULT_FORM_STATE }),
    [formStateByBill, selectedIds],
  );

  useEffect(() => {
    if (selectedIds.length === 0) {
      setCurrentFormIndex(0);
      return;
    }
    setCurrentFormIndex((previous) => Math.min(previous, selectedIds.length - 1));
  }, [selectedIds.length]);

  useEffect(() => {
    if (flowStep === "form" && selectedIds.length === 0) {
      setFlowStep("selection");
    }
  }, [flowStep, selectedIds.length]);

  const currentFormId = selectedIds[currentFormIndex];

  const handleStart = useCallback(() => {
    setOverlay(null);
    setFlowStep("selection");
  }, []);



  const prepareFormStates = useCallback((ids: number[]) => {
    setFormStateByBill((previous) => {
      const next = { ...previous };
      ids.forEach((id) => {
        if (!next[id]) {
          next[id] = { ...DEFAULT_FORM_STATE };
        }
      });
      return next;
    });
  }, []);

  const proceedToForms = useCallback(
    (ids: number[]) => {
      if (ids.length === 0) {
        setOverlay({
          title: "Selecione faturas",
          messages: ["Escolha pelo menos uma fatura para continuar."],
          retryStep: "selection",
        });
        return;
      }
      prepareFormStates(ids);
      setCurrentFormIndex(0);
      setFormError(null);
      setFlowStep("form");
    },
    [prepareFormStates],
  );

  const handleContinueSelection = useCallback(
    (quantity: number) => {
      const clampedQuantity = Math.max(0, Math.min(quantity, BILL_TOTAL));

      if (clampedQuantity <= 0) {
        setOverlay({
          title: "Selecione faturas",
          messages: ["Escolha pelo menos uma fatura para continuar."],
          retryStep: "selection",
        });
        return;
      }

      const ids = Array.from({ length: clampedQuantity }, (_, index) => index + 1);
      setSelectedIds(ids);
      proceedToForms(ids);
    },
    [proceedToForms],
  );

  const handleDateChange = useCallback(
    (dates: Date[]) => {
      if (!currentFormId) {
        return;
      }

      const date = dates[0];
      if (!date) {
        setFormStateByBill((prev) => ({
          ...prev,
          [currentFormId]: {
            ...(prev[currentFormId] ?? { ...DEFAULT_FORM_STATE }),
            issueDateIso: "",
            issueDateValue: "",
            issueDateLabel: "",
          },
        }));
        setFormError(null);
        return;
      }

      const normalizedDate = new Date(date);
      normalizedDate.setHours(0, 0, 0, 0);
      const { minDate, maxDate } = DATE_LIMITS;
      if (normalizedDate < minDate || normalizedDate > maxDate) {
        setFormStateByBill((prev) => ({
          ...prev,
          [currentFormId]: {
            ...(prev[currentFormId] ?? { ...DEFAULT_FORM_STATE }),
            issueDateIso: "",
            issueDateValue: "",
            issueDateLabel: "",
          },
        }));
        const minLabel = minDate.toLocaleDateString('pt-BR');
        const maxLabel = maxDate.toLocaleDateString('pt-BR');
        setFormError(`Informe uma data entre ${minLabel} e ${maxLabel}.`);
        return;
      }

      setFormError(null);
      setFormStateByBill((prev) => ({
        ...prev,
        [currentFormId]: {
          ...(prev[currentFormId] ?? { ...DEFAULT_FORM_STATE }),
          issueDateIso: toMonthIso(normalizedDate),
          issueDateValue: toInputValue(normalizedDate),
          issueDateLabel: toFriendlyLabel(normalizedDate),
        },
      }));
    },
    [currentFormId, setFormError],
  );

  const handleIcmsChange = useCallback(
    (rawValue: string) => {
      if (!currentFormId) {
        return;
      }
      const formatted = formatCurrencyInput(rawValue);
      setFormStateByBill((prev) => ({
        ...prev,
        [currentFormId]: {
          ...(prev[currentFormId] ?? { ...DEFAULT_FORM_STATE }),
          icmsValue: formatted,
        },
      }));
    },
    [currentFormId],
  );

  const handleNextForm = useCallback(() => {
    if (!currentFormId) {
      return;
    }

    const form = formStateByBill[currentFormId] ?? { ...DEFAULT_FORM_STATE };
    if (!form.issueDateIso || !form.icmsValue || parseCurrency(form.icmsValue) <= 0) {
      setFormError("Preencha a data e o valor de ICMS para continuar.");
      return;
    }

    setFormError(null);
    if (currentFormIndex >= selectedIds.length - 1) {
      setFlowStep("confirmation");
      return;
    }

    setCurrentFormIndex((prev) => prev + 1);
  }, [currentFormId, currentFormIndex, formStateByBill, selectedIds.length]);

  const handleBackFromForm = useCallback(() => {
    if (currentFormIndex > 0) {
      setCurrentFormIndex((prev) => prev - 1);
      setFormError(null);
      return;
    }
    setFlowStep("selection");
  }, [currentFormIndex]);

  const handleBackFromConfirmation = useCallback(() => {
    if (selectedIds.length === 0) {
      setFlowStep("selection");
      return;
    }
    setFlowStep("form");
  }, [selectedIds.length]);

  const ensureFormsAreValid = useCallback(() => {
    for (let index = 0; index < selectedIds.length; index += 1) {
      const id = selectedIds[index];
      const form = formStateByBill[id] ?? { ...DEFAULT_FORM_STATE };
      if (!form.issueDateIso || !form.icmsValue || parseCurrency(form.icmsValue) <= 0) {
        setOverlay({
          title: "Validação necessária",
          messages: [
            `Preencha completamente a fatura ${index + 1} antes de continuar.`,
          ],
          retryStep: "form",
        });
        setCurrentFormIndex(index);
        setFlowStep("form");
        return false;
      }
    }
    return true;
  }, [formStateByBill, selectedIds]);

  const handleConfirm = useCallback(() => {
    if (!ensureFormsAreValid()) {
      return;
    }

    const payload = selectedIds.map((id) => {
      const form = formStateByBill[id] ?? { ...DEFAULT_FORM_STATE };
      return {
        icms_value: parseCurrency(form.icmsValue),
        issue_date: form.issueDateIso,
      } satisfies BillPayload;
    });

    pendingPayloadRef.current = payload;
    setLoadingIndex(0);
    setCreditsRemaining(null);
    setCalculationId(null);
    setProcessingTimeMs(null);
    setFlowStep("loading");
  }, [ensureFormsAreValid, formStateByBill, selectedIds]);

  const resetLoadingSideEffects = useCallback(() => {
    if (timelineIntervalRef.current) {
      window.clearInterval(timelineIntervalRef.current);
      timelineIntervalRef.current = null;
    }
    if (autoTransitionTimeoutRef.current) {
      window.clearTimeout(autoTransitionTimeoutRef.current);
      autoTransitionTimeoutRef.current = null;
    }
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (flowStep !== "loading") {
      resetLoadingSideEffects();
      setIsRequesting(false);
      pendingPayloadRef.current = null;
      return;
    }

    const payload = pendingPayloadRef.current;
    if (!payload || payload.length === 0) {
      setOverlay({
        title: "Dados insuficientes",
        messages: ["Volte e selecione novamente as faturas."],
        retryStep: "selection",
      });
      setFlowStep("selection");
      return;
    }

    setLoadingIndex(0);
    setIsRequesting(true);

    timelineIntervalRef.current = window.setInterval(() => {
      setLoadingIndex((previous) =>
        previous >= TIMELINE_ITEMS.length - 1 ? TIMELINE_ITEMS.length - 1 : previous + 1,
      );
    }, 900);

    const controller = new AbortController();
    controllerRef.current = controller;

    const resolveErrorMessage = (status: number, detail?: string) => {
      const defaults: Record<number, string> = {
        400: "Verifique os dados informados e tente novamente.",
        401: "Sessão expirada. Faça login novamente para continuar.",
        402: "Créditos insuficientes para realizar este cálculo.",
        404: "Dados IPCA não encontrados para o período selecionado.",
        500: "Erro interno no servidor. Tente novamente em instantes.",
      };
      return detail ?? defaults[status] ?? "Não foi possível concluir o cálculo.";
    };

    const performRequest = async () => {
      try {
        const response = await fetch("/api/v1/calcular", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ bills: payload }),
          signal: controller.signal,
        });

        if (!response.ok) {
          let detail: string | undefined;
          try {
            const data = await response.json();
            detail = typeof data?.detail === "string" ? data.detail : undefined;
          } catch {
            detail = undefined;
          }
          throw new Error(resolveErrorMessage(response.status, detail));
        }

        const data = await response.json();
        const calculatedValue = Number(data?.valor_calculado ?? 0);
        setResultAmount(formatBRL(Number.isFinite(calculatedValue) ? calculatedValue : 0));
        setCreditsRemaining(
          Number.isFinite(Number(data?.creditos_restantes))
            ? Number(data.creditos_restantes)
            : null,
        );
        setCalculationId(
          Number.isFinite(Number(data?.calculation_id)) ? Number(data.calculation_id) : null,
        );
        setProcessingTimeMs(
          Number.isFinite(Number(data?.processing_time_ms))
            ? Number(data.processing_time_ms)
            : null,
        );

        void queryClient.invalidateQueries({ queryKey: ["credits", "balance"] });
        void queryClient.invalidateQueries({ queryKey: ["credits", "history"] });
        void queryClient.invalidateQueries({ queryKey: ["detailed-history"] });

        setIsRequesting(false);
        setLoadingIndex(TIMELINE_ITEMS.length - 1);
        pendingPayloadRef.current = null;

        autoTransitionTimeoutRef.current = window.setTimeout(() => {
          setFlowStep("result");
        }, 500);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setIsRequesting(false);
        pendingPayloadRef.current = null;
        const message =
          error instanceof Error
            ? error.message
            : "Não foi possível concluir o cálculo. Tente novamente.";
        const retryStep: FlowStep = /crédito/i.test(message) ? "selection" : "confirmation";
        setOverlay({
          title: "Erro no cálculo",
          messages: [message],
          retryStep,
        });
        setFlowStep("confirmation");
      }
    };

    void performRequest();

    return () => {
      resetLoadingSideEffects();
    };
  }, [flowStep, queryClient, resetLoadingSideEffects]);

  const handleRestart = useCallback(() => {
    resetLoadingSideEffects();
    setSelectedIds([]);
    setFormStateByBill({});
    setCurrentFormIndex(0);
    setFormError(null);
    setOverlay(null);
    setLoadingIndex(0);
    setIsRequesting(false);
    setResultAmount(formatBRL(0));
    setCreditsRemaining(null);
    setCalculationId(null);
    setProcessingTimeMs(null);
    pendingPayloadRef.current = null;
    setFlowStep("welcome");
  }, [resetLoadingSideEffects]);

  const handleViewSummary = useCallback(() => {
    onNavigateToHistory?.();
  }, [onNavigateToHistory]);

  const handleCloseOverlay = useCallback(
    (retryStep: FlowStep, message: string) => {
      setOverlay(null);
      setFlowStep(retryStep);
      if (retryStep === "form" && selectedIds.length > 0) {
        const firstInvalidIndex = selectedIds.findIndex((id) => {
          const form = formStateByBill[id] ?? { ...DEFAULT_FORM_STATE };
          return !form.issueDateIso || !form.icmsValue || parseCurrency(form.icmsValue) <= 0;
        });
        setCurrentFormIndex(firstInvalidIndex >= 0 ? firstInvalidIndex : 0);
      }
      if (retryStep === "selection" && /crédito/i.test(message) && onRequestBuyCredits) {
        onRequestBuyCredits();
      }
    },
    [formStateByBill, onRequestBuyCredits, selectedIds],
  );

  const billCount = selectedIds.length;

  return (
    <div
      className={clsx(
        "relative flex h-full w-full items-center justify-center overflow-hidden",
        !isVisible && "pointer-events-none opacity-90",
      )}
      style={{ minHeight: "100vh", height: "100%", width: "100%" }}
      aria-hidden={!isVisible}
    >
      <div id="calculate-container" className="relative h-full w-full">
        <WelcomeStep isActive={flowStep === "welcome"} onStart={handleStart} />

        <SelectionStep
          isActive={flowStep === "selection"}
          onContinue={handleContinueSelection}
        />

        {selectedIds.map((id, index) => (
          <FormStep
            key={`form-step-${id}`}
            isActive={flowStep === "form" && currentFormIndex === index}
            index={index}
            total={billCount}
            form={orderedFormStates[index] ?? { ...DEFAULT_FORM_STATE }}
            onDateChange={handleDateChange}
            onIcmsChange={handleIcmsChange}
            onNext={handleNextForm}
            onBack={handleBackFromForm}
            errorMessage={flowStep === "form" && currentFormIndex === index ? formError : null}
            isLast={index === billCount - 1}
          />
        ))}

        <ConfirmationStep
          isActive={flowStep === "confirmation"}
          forms={orderedFormStates}
          onBack={handleBackFromConfirmation}
          onConfirm={handleConfirm}
        />

        <LoadingStep
          isActive={flowStep === "loading"}
          activeIndex={loadingIndex}
          items={TIMELINE_ITEMS}
        />

        <ResultStep
          isActive={flowStep === "result"}
          amount={resultAmount}
          onRestart={handleRestart}
          onViewSummary={handleViewSummary}
        />

        {flowStep === "result" && (creditsRemaining != null || calculationId != null) ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-12 flex justify-center px-4">
            <div className="pointer-events-auto w-full max-w-xs rounded-2xl bg-white/90 p-4 text-sm text-slate-600 shadow-lg backdrop-blur">
              {calculationId != null ? (
                <p className="font-semibold text-slate-700">Protocolo #{calculationId}</p>
              ) : null}
              {creditsRemaining != null ? (
                <p className="mt-2">Créditos disponíveis: {creditsRemaining}</p>
              ) : null}
              {processingTimeMs != null ? (
                <p className="mt-1 text-xs text-slate-400">
                  Tempo de processamento: {processingTimeMs} ms
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {flowStep === "loading" && isRequesting ? (
          <BottomHint>Calculando... aguarde um instante</BottomHint>
        ) : null}

        {overlay ? (
          <ErrorOverlay
            title={overlay.title}
            messages={overlay.messages}
            primaryActionLabel={
              overlay.retryStep === "selection" && onRequestBuyCredits
                ? "Adicionar créditos"
                : "Corrigir dados"
            }
            onPrimaryAction={() => handleCloseOverlay(overlay.retryStep, overlay.messages.join(" "))}
          />
        ) : null}
      </div>

      <style jsx global>{`
        #calculate-container {
          width: 100%;
          height: 100%;
          min-height: 100vh;
          position: relative;
        }

        .calculator-step {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
          opacity: 0;
          visibility: hidden;
          transform: scale(0.98);
          transition:
            opacity 0.4s ease,
            visibility 0.4s ease,
            transform 0.4s ease;
        }

        .calculator-step.active {
          opacity: 1;
          visibility: visible;
          transform: scale(1);
          z-index: 5;
        }

        #welcome-step {
          background-color: #0f172a;
          overflow: hidden;
          z-index: 6;
        }

        .welcome-content {
          animation: welcome-fade-in 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.2s forwards;
          opacity: 0;
        }

        @keyframes welcome-fade-in {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .particle {
          position: absolute;
          bottom: -2rem;
          width: 12px;
          height: 12px;
          border-radius: 999px;
          background: linear-gradient(180deg, rgba(13, 148, 136, 0.7), rgba(13, 148, 136, 0));
          opacity: 0;
          animation: rise 10s linear infinite;
        }

        @keyframes rise {
          0% {
            opacity: 0;
            transform: translateY(0) scale(0.6);
          }
          20% {
            opacity: 1;
          }
          80% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translateY(-120vh) scale(1.2);
          }
        }

        .start-btn {
          background: linear-gradient(135deg, #0d9488, #3b82f6);
          color: #ffffff;
          padding: 0.75rem 2.2rem;
          border-radius: 999px;
          font-weight: 600;
          box-shadow: 0 8px 25px rgba(13, 148, 136, 0.45);
          transition: transform 0.3s ease, box-shadow 0.3s ease;
          animation: pulse-glow 2.5s infinite;
        }

        .start-btn:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 30px rgba(13, 148, 136, 0.6);
        }

        @keyframes pulse-glow {
          0% {
            box-shadow: 0 8px 25px rgba(13, 148, 136, 0.4);
          }
          50% {
            box-shadow: 0 8px 35px rgba(13, 148, 136, 0.7);
          }
          100% {
            box-shadow: 0 8px 25px rgba(13, 148, 136, 0.4);
          }
        }

        .back-btn {
          position: absolute;
          left: 1.5rem;
          top: 1.5rem;
          display: inline-flex;
          height: 3rem;
          width: 3rem;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          background-color: rgba(255, 255, 255, 0.8);
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.1);
          transition: transform 0.3s ease;
        }

        .back-btn:hover {
          transform: translateY(-2px);
        }

        .input-group {
          position: relative;
        }

        .input-icon {
          position: absolute;
          left: 1rem;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
          width: 1.25rem;
          height: 1.25rem;
        }

        .input-field {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid #e2e8f0;
          padding: 0.75rem 1rem 0.75rem 3rem;
          font-size: 1rem;
          transition: border-color 0.3s ease;
        }

        .input-field:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
        }

        .alert-banner {
          animation: alert-fade-in 0.35s ease;
        }

        @keyframes alert-fade-in {
          from {
            opacity: 0;
            transform: translateY(-6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .bill-option.selected::after {
          content: "";
          position: absolute;
          inset: -4px;
          border-radius: 1.5rem;
          border: 2px solid rgba(13, 148, 136, 0.4);
          box-shadow: 0 0 18px rgba(13, 148, 136, 0.35);
          pointer-events: none;
        }

        .calculate-btn-premium {
          background: linear-gradient(135deg, #0d9488, #3b82f6);
          color: #ffffff;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .calculate-btn-premium:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 32px rgba(59, 130, 246, 0.35);
        }

        .carousel-container {
          position: relative;
          overflow: hidden;
          border-radius: 1rem;
          background-color: #e2e8f0;
          box-shadow: inset 0 2px 4px rgba(15, 23, 42, 0.08);
        }

        .carousel-track {
          display: flex;
          transition: transform 0.5s ease-in-out;
        }

        .carousel-slide {
          flex: 0 0 100%;
          padding: 1.25rem;
          text-align: center;
        }

        .carousel-dots {
          position: absolute;
          bottom: 0.75rem;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 0.5rem;
        }

        .carousel-dot {
          width: 0.5rem;
          height: 0.5rem;
          border-radius: 50%;
          background-color: rgba(15, 23, 42, 0.25);
          transition: background-color 0.3s ease;
        }

        .carousel-dot.active {
          background-color: #3b82f6;
        }

        .summary-cards-container {
          scrollbar-width: thin;
          scrollbar-color: #3b82f6 #e2e8f0;
        }

        .summary-cards-container::-webkit-scrollbar {
          width: 6px;
        }

        .summary-cards-container::-webkit-scrollbar-thumb {
          background-color: #3b82f6;
          border-radius: 999px;
        }

        #loading-step {
          background-color: #0f172a;
          color: #e2e8f0;
        }

        .timeline {
          position: relative;
          padding-left: 2.5rem;
          text-align: left;
        }

        .timeline-item {
          position: relative;
          padding-bottom: 2rem;
        }

        .timeline-item::before {
          content: "";
          position: absolute;
          left: -2.05rem;
          top: 0.25rem;
          width: 1.5rem;
          height: 1.5rem;
          border-radius: 50%;
          background-color: #1e293b;
          border: 3px solid #334155;
          transition: all 0.5s ease;
        }

        .timeline-item.completed::before {
          background-color: #0d9488;
          border-color: #0d9488;
          box-shadow: 0 0 12px rgba(13, 148, 136, 0.9);
        }

        .timeline-item:not(:last-child)::after {
          content: "";
          position: absolute;
          left: -1.4rem;
          top: 1.75rem;
          bottom: -0.5rem;
          width: 3px;
          background-color: #334155;
        }

        .timeline-content {
          opacity: 0.5;
          transition: opacity 0.5s ease;
        }

        .timeline-item.active .timeline-content,
        .timeline-item.completed .timeline-content {
          opacity: 1;
        }

        #result-step {
          background: radial-gradient(circle, #1e293b, #0f172a);
        }

        .result-content {
          opacity: 0;
          transform: scale(0.85);
          animation: result-reveal 1s cubic-bezier(0.165, 0.84, 0.44, 1) forwards;
        }

        @keyframes result-reveal {
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .result-value {
          color: #0d9488;
          text-shadow: 0 0 25px rgba(13, 148, 136, 0.8), 0 0 12px rgba(13, 148, 136, 0.6);
          animation: result-glow 3s infinite alternate;
        }

        @keyframes result-glow {
          from {
            text-shadow: 0 0 25px rgba(13, 148, 136, 0.7);
          }
          to {
            text-shadow: 0 0 40px rgba(13, 148, 136, 1);
          }
        }

        .error-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: rgba(15, 23, 42, 0.6);
          padding: 1.5rem;
          z-index: 30;
        }

        .error-modal {
          width: 100%;
          max-width: 24rem;
          background-color: #ffffff;
          border-radius: 1.5rem;
          padding: 1.75rem;
          text-align: center;
          box-shadow: 0 25px 60px rgba(15, 23, 42, 0.25);
        }
      `}</style>
    </div>
  );
};

export default MainCalculator;

