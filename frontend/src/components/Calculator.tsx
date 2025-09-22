"use client";

import { useMutation } from "@tanstack/react-query";
import Image from "next/image";
import clsx from "clsx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Flatpickr from "react-flatpickr";
import "flatpickr/dist/flatpickr.min.css";
import { Portuguese } from "flatpickr/dist/l10n/pt.js";
import IMask, { type InputMask } from "imask";
import { LucideIcon, type IconName } from "@/components/LucideIcon";
import useAuth from "@/hooks/useAuth";
import {
  calcular,
  type CalcularResponse,
  type BillPayload,
  extractErrorMessage,
} from "@/lib/api";

interface BillInput {
  date: Date | null;
  icms: string;
}

const navLinks: Array<{ id: string; label: string; icon: IconName; color: string }> = [
  { id: "Home", label: "Início", icon: "House", color: "#0d9488" },
  { id: "calculate", label: "Calcular", icon: "Calculator", color: "#3b82f6" },
  { id: "history", label: "Histórico", icon: "History", color: "#8b5cf6" },
  { id: "credits", label: "Créditos", icon: "Wallet", color: "#ca8a04" },
];

const timelineItems: Array<{ text: string; icon: IconName }> = [
  { text: "Analisando padrões de tributação...", icon: "FileSearch2" },
  { text: "Cruzando dados com a legislação vigente...", icon: "Scale" },
  { text: "Calculando correção monetária retroativa...", icon: "CalendarClock" },
  { text: "Estimando juros da taxa Selic...", icon: "TrendingUp" },
  { text: "Compilando seu relatório final...", icon: "CircleCheck" },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatMonthYear(date: Date | null) {
  if (!date) return "N/A";
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function normalizeICMS(value: string): number {
  if (!value) return 0;
  return Number(value.replace(/\./g, "").replace(",", "."));
}

function toIssueDate(date: Date | null) {
  if (!date) return "";
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return `${year}-${month.toString().padStart(2, "0")}`;
}

export function Calculator() {
  const router = useRouter();
  const { logout } = useAuth();
  const [activeNavIndex, setActiveNavIndex] = useState(0);
  const pageContainerRef = useRef<HTMLDivElement>(null);
  const navIndicatorRef = useRef<HTMLDivElement>(null);
  const navLinkRefs = useRef<Array<HTMLAnchorElement | null>>([]);

  const [currentStep, setCurrentStep] = useState(0);
  const [billCount, setBillCount] = useState(0);
  const [bills, setBills] = useState<BillInput[]>([]);
  const [showRecommendation, setShowRecommendation] = useState(false);
  const [timelineIndex, setTimelineIndex] = useState(0);
  const [timelineFinished, setTimelineFinished] = useState(false);
  const [isTimelineRunning, setIsTimelineRunning] = useState(false);
  const [resultData, setResultData] = useState<CalcularResponse | null>(null);
  const [resultValueDisplay, setResultValueDisplay] = useState("R$ 0,00");
  const [loadingError, setLoadingError] = useState("");

  const [isLeavingPlatform, setIsLeavingPlatform] = useState(false);

  const particles = useMemo(
    () =>
      Array.from({ length: 25 }, () => {
        const size = Math.random() * 3 + 1;
        return {
          size,
          left: Math.random() * 100,
          duration: Math.random() * 5 + 8,
          delay: Math.random() * 5,
        };
      }),
    []
  );

  const firstFormStepIndex = 2;
  const confirmationStepIndex = firstFormStepIndex + billCount;
  const loadingStepIndex = confirmationStepIndex + 1;
  const resultStepIndex = loadingStepIndex + 1;

  const calcularMutation = useMutation({
    mutationFn: async () => {
      const payloadBills: BillPayload[] = bills.map((bill) => ({
        icms_value: normalizeICMS(bill.icms),
        issue_date: toIssueDate(bill.date),
      }));
      return calcular({ bills: payloadBills });
    },
    onSuccess: (data) => {
      setResultData(data);
      setResultValueDisplay(formatCurrency(data.valor_calculado));
      setLoadingError("");
    },
    onError: (error: unknown) => {
      setLoadingError(extractErrorMessage(error));
      setResultData(null);
      setIsTimelineRunning(false);
    },
  });

  const totalSteps = useMemo(() => resultStepIndex + 1, [resultStepIndex]);

  useEffect(() => {
    const container = pageContainerRef.current;
    if (!container) return;
    container.style.transform = `translateX(${activeNavIndex * -25}%)`;
  }, [activeNavIndex]);

  const updateIndicator = useCallback(
    (index: number) => {
      const indicator = navIndicatorRef.current;
      const link = navLinkRefs.current[index];
      if (!indicator || !link) return;
      const width = link.offsetWidth - 16;
      const left = link.offsetLeft + 8;
      indicator.style.width = `${width}px`;
      indicator.style.left = `${left}px`;
      const color = navLinks[index]?.color ?? "#0d9488";
      document.documentElement.style.setProperty("--active-indicator-color", color);
    },
    []
  );

  useEffect(() => {
    updateIndicator(activeNavIndex);
  }, [activeNavIndex, updateIndicator]);

  useEffect(() => {
    const handleResize = () => {
      updateIndicator(activeNavIndex);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [activeNavIndex, updateIndicator]);

  const goToStep = useCallback(
    (nextStep: number) => {
      const clamped = Math.max(0, Math.min(nextStep, totalSteps - 1));
      setCurrentStep(clamped);
    },
    [totalSteps]
  );

  const resetCalculator = useCallback(() => {
    setCurrentStep(1);
    setBillCount(0);
    setBills([]);
    setShowRecommendation(false);
    setTimelineIndex(0);
    setTimelineFinished(false);
    setIsTimelineRunning(false);
    setResultData(null);
    setResultValueDisplay("R$ 0,00");
    setLoadingError("");
  }, []);

  const ensureBills = useCallback(
    (count: number) => {
      setBills((prev) => {
        const next = Array.from({ length: count }, (_, index) => prev[index] ?? { date: null, icms: "" });
        return next;
      });
    },
    []
  );

  const handleSelectBillCount = (count: number) => {
    setBillCount(count);
    ensureBills(count);
    if (count <= 2) {
      setShowRecommendation(true);
    } else {
      setShowRecommendation(false);
      goToStep(firstFormStepIndex);
    }
  };

  const startWithRecommended = () => {
    const recommended = 3;
    setBillCount(recommended);
    ensureBills(recommended);
    setShowRecommendation(false);
    goToStep(firstFormStepIndex);
  };

  const continueWithSelection = () => {
    if (billCount === 0) return;
    setShowRecommendation(false);
    goToStep(firstFormStepIndex);
  };

  const updateBill = (index: number, bill: Partial<BillInput>) => {
    setBills((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...bill } as BillInput;
      return next;
    });
  };

  const validateBill = (bill: BillInput) => {
    return !!bill.date && normalizeICMS(bill.icms) > 0;
  };

  const handleNextForm = (index: number) => {
    const bill = bills[index];
    if (!bill || !validateBill(bill)) {
      return false;
    }
    if (index === billCount - 1) {
      goToStep(confirmationStepIndex);
    } else {
      goToStep(firstFormStepIndex + index + 1);
    }
    return true;
  };

  const handlePreviousForm = (index: number) => {
    if (index === 0) {
      goToStep(1);
    } else {
      goToStep(firstFormStepIndex + index - 1);
    }
  };

  const startCalculation = () => {
    if (billCount === 0) return;
    if (bills.some((bill) => !validateBill(bill))) {
      setLoadingError("Preencha todas as faturas antes de continuar.");
      return;
    }
    setTimelineIndex(0);
    setTimelineFinished(false);
    setIsTimelineRunning(true);
    setLoadingError("");
    setResultData(null);
    goToStep(loadingStepIndex);
    calcularMutation.mutate();
  };

  useEffect(() => {
    if (!isTimelineRunning) return;
    if (timelineIndex >= timelineItems.length) {
      setIsTimelineRunning(false);
      setTimelineFinished(true);
      return;
    }
    const timeout = window.setTimeout(() => {
      setTimelineIndex((prev) => prev + 1);
    }, 1500 + Math.random() * 500);
    return () => window.clearTimeout(timeout);
  }, [timelineIndex, isTimelineRunning]);

  useEffect(() => {
    if (timelineFinished) {
      if (resultData) {
        goToStep(resultStepIndex);
      } else if (loadingError) {
        setCurrentStep(confirmationStepIndex);
      }
    }
  }, [timelineFinished, resultData, loadingError, confirmationStepIndex, resultStepIndex, goToStep]);

  const handleLeavePlatform = useCallback(() => {
    setIsLeavingPlatform(true);
    void (async () => {
      try {
        await logout();
      } catch (error) {
        console.error("Falha ao encerrar sessao", error);
      } finally {
        router.replace("/");
      }
    })();
  }, [logout, router]);

  const isStepActive = useCallback(
    (stepIndex: number) => currentStep === stepIndex,
    [currentStep]
  );

  const renderFormStep = (index: number) => {
    const bill = bills[index] ?? { date: null, icms: "" };
    return (
      <div key={index} className={clsx("calculator-step bg-white form-step", isStepActive(firstFormStepIndex + index) && "active") }>
        <button
          className="back-btn"
          type="button"
          onClick={() => handlePreviousForm(index)}
        >
          <LucideIcon name="ArrowLeft" className="h-6 w-6 text-slate-600" />
        </button>
        <div className="flex h-full w-full max-w-4xl flex-col items-center justify-center overflow-y-auto pb-24 pt-10 md:flex-row md:gap-12">
          <div className="order-2 flex w-full flex-col items-center text-center md:order-1 md:w-1/2 md:items-start md:text-left">
            <h2 className="text-2xl font-bold text-text-dark sm:text-3xl">Fatura {index + 1} de {billCount}</h2>
            <p className="mt-2 mb-6 text-sm text-slate-500 sm:text-base">
              Preencha os dados desta fatura. As informações são salvas automaticamente.
            </p>
            <div className="input-group">
              <LucideIcon name="Calendar" className="input-icon" />
              <Flatpickr
                value={bill.date ? [bill.date] : []}
                onChange={(dates) => updateBill(index, { date: dates[0] ?? null })}
                options={{
                  dateFormat: "Y-m-d",
                  altInput: true,
                  altFormat: "d 'de' F, Y",
                  locale: Portuguese,
                }}
                className="input-field"
                placeholder="Data da Fatura"
              />
            </div>
            <div className="input-group mt-4">
              <LucideIcon name="Receipt" className="input-icon" />
              <CurrencyInput
                value={bill.icms}
                onValueChange={(value) => updateBill(index, { icms: value })}
                placeholder="Valor do ICMS (R$)"
              />
            </div>
            <button
              type="button"
              className="calculate-btn-premium mt-6 w-full rounded-lg py-3 text-lg font-semibold"
              onClick={() => handleNextForm(index)}
            >
              {index === billCount - 1 ? "Finalizar e Confirmar" : "Próxima Fatura"}
            </button>
          </div>
          <div className="order-1 mt-8 w-full md:order-2 md:mt-0 md:w-1/2">
            <p className="mb-2 text-center text-sm font-semibold text-slate-600 md:hidden">
              Dicas Rápidas:
            </p>
            <div className="carousel-container">
              <div className="carousel-track">
                <div className="carousel-slide">
                  <Image
                    src="https://placehold.co/400x300/e2e8f0/64748b?text=Onde+encontrar+o+ICMS%3F"
                    alt="Onde encontrar o ICMS na fatura"
                    width={400}
                    height={300}
                  />
                  <p className="mt-2 text-sm font-semibold sm:text-base">Onde encontrar o ICMS?</p>
                  <p className="text-xs text-slate-600 sm:text-sm">
                    Procure na seção “Detalhes de Faturamento” ou “Tributos” da sua conta de luz.
                  </p>
                </div>
                <div className="carousel-slide">
                  <Image
                    src="https://placehold.co/400x300/e2e8f0/64748b?text=Preencha+o+valor+exato"
                    alt="Preencha o valor exato"
                    width={400}
                    height={300}
                  />
                  <p className="mt-2 text-sm font-semibold sm:text-base">Preencha o valor exato</p>
                  <p className="text-xs text-slate-600 sm:text-sm">
                    Use a vírgula para centavos, como no exemplo: 45,78.
                  </p>
                </div>
                <div className="carousel-slide">
                  <Image
                    src="https://placehold.co/400x300/e2e8f0/64748b?text=Data+de+Vencimento"
                    alt="Data de vencimento"
                    width={400}
                    height={300}
                  />
                  <p className="mt-2 text-sm font-semibold sm:text-base">Use a data de vencimento</p>
                  <p className="text-xs text-slate-600 sm:text-sm">
                    A data de vencimento ou de emissão pode ser usada como referência.
                  </p>
                </div>
              </div>
              <div className="carousel-dots">
                <span className="carousel-dot active" />
                <span className="carousel-dot" />
                <span className="carousel-dot" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTimeline = () => {
    return (
      <div id="loading-timeline" className="timeline w-full">
        {timelineItems.map((item, index) => {
          const isActive = timelineIndex === index;
          const isCompleted = timelineIndex > index;
          return (
            <div
              key={item.text}
              className={clsx(
                "timeline-item",
                isActive && "active",
                isCompleted && "completed"
              )}
            >
              <div className="timeline-content flex items-center gap-3">
                <LucideIcon
                  name={isCompleted ? "CircleCheck" : isActive ? "LoaderCircle" : item.icon}
                  className={clsx("loader-icon h-6 w-6", isCompleted ? "text-green-500" : "text-slate-400")}
                />
                <span className="text-lg text-slate-200">{item.text}</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="calculator-root flex min-h-screen flex-col bg-slate-100">
      <main className="flex-grow w-full overflow-hidden">
        <div id="page-container" ref={pageContainerRef} className="flex h-full w-[400%] transition-transform duration-500 ease-out">
          <section id="Home" className="page text-center">
            <p className="text-2xl text-slate-600">Página Inicial</p>
          </section>
          <section id="calculate" className="page !p-0 overflow-hidden">
            <div id="calculate-container" className="h-full w-full">
              <div id="welcome-step" className={clsx("calculator-step", currentStep === 0 ? "active" : "", "bg-slate-900") }>
                <div id="welcome-bg" className="absolute inset-0" aria-hidden="true">
                  {particles.map((particle, index) => (
                    <div
                      key={index}
                      className="particle"
                      style={{
                        width: `${particle.size}px`,
                        height: `${particle.size}px`,
                        left: `${particle.left}%`,
                        animationDuration: `${particle.duration}s`,
                        animationDelay: `${particle.delay}s`,
                      }}
                    />
                  ))}
                </div>
                <div className="welcome-content z-10 p-4 text-center">
                  <h1 className="text-4xl font-bold text-white md:text-5xl" style={{ textShadow: "0 0 15px rgba(13, 148, 136, 0.7)" }}>
                    É um prazer tê-lo aqui.
                  </h1>
                  <p className="mx-auto mt-4 max-w-md text-slate-300">
                    Vamos descobrir juntos o valor estimado que você pode ter a receber.
                  </p>
                  <button
                    type="button"
                    className="start-btn mt-8"
                    onClick={() => goToStep(1)}
                  >
                    Vamos começar
                  </button>
                </div>
              </div>

              <div id="selection-step" className={clsx("calculator-step bg-white", currentStep === 1 && "active") }>
                <button
                  type="button"
                  className="back-btn"
                  onClick={() => goToStep(0)}
                >
                  <LucideIcon name="ArrowLeft" className="h-6 w-6 text-slate-600" />
                </button>
                <div className="flex h-full w-full max-w-3xl flex-col justify-center overflow-y-auto px-4 pb-24 text-center">
                  <h2 className="text-3xl font-bold text-text-dark">Você tem quantas contas em mãos?</h2>
                  <p className="mt-2 text-slate-500">Selecione o número de faturas que você usará para a simulação.</p>
                  <div className="mt-8 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 sm:gap-4" id="bill-options-grid">
                    {Array.from({ length: 12 }, (_, index) => (
                      <button
                        key={index}
                        type="button"
                        className={clsx(
                          "bill-option-card flex flex-col items-center justify-center gap-2 rounded-xl p-3 sm:p-4",
                          billCount === index + 1 && "selected"
                        )}
                        onClick={() => handleSelectBillCount(index + 1)}
                      >
                        <LucideIcon name="FileText" className="h-6 w-6 sm:h-8 sm:w-8" />
                        <span className="text-lg font-bold sm:text-xl">{index + 1}</span>
                      </button>
                    ))}
                  </div>
                  {showRecommendation && (
                    <div
                      id="recommendation-alert"
                      className="mt-6 animate-[alert-fade-in_.5s_ease-out] rounded-lg border-l-4 border-red-500 bg-red-100 p-4 text-left text-red-800"
                    >
                      <div className="flex items-start gap-3">
                        <LucideIcon name="TriangleAlert" className="mt-1 h-6 w-6 flex-shrink-0 text-red-600" />
                        <div>
                          <p className="font-bold">Recomendação</p>
                          <p className="text-sm">Para uma melhor estimativa, recomendamos iniciar com pelo menos três contas.</p>
                          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:justify-center">
                            <button
                              type="button"
                              className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-600"
                              onClick={startWithRecommended}
                            >
                              Usar 3 faturas
                            </button>
                            <button
                              type="button"
                              className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-300"
                              onClick={continueWithSelection}
                            >
                              Continuar mesmo assim
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {Array.from({ length: billCount }, (_, index) => renderFormStep(index))}

              <div
                id="confirmation-step"
                className={clsx("calculator-step bg-slate-100 !pb-24", currentStep === confirmationStepIndex && "active")}
              >
                <button type="button" className="back-btn" onClick={() => goToStep(firstFormStepIndex + billCount - 1)}>
                  <LucideIcon name="ArrowLeft" className="h-6 w-6 text-slate-600" />
                </button>
                <div className="mx-auto w-full max-w-lg rounded-2xl bg-white p-6 text-center shadow-lg md:p-8">
                  <h2 className="text-2xl font-bold text-text-dark">Resumo da Simulação</h2>
                  <p className="mt-2 mb-6 text-slate-500">
                    Confira os dados das faturas que você inseriu. Se tudo estiver correto, podemos prosseguir.
                  </p>
                  <div id="summary-details" className="summary-cards-container max-h-60 space-y-4 overflow-y-auto rounded-lg border bg-slate-50 p-4 text-left">
                    {bills.length === 0 && <p className="text-center text-slate-500">Nenhum dado de fatura encontrado.</p>}
                    {bills.map((bill, index) => (
                      <div
                        key={index}
                        className="summary-item border-b border-slate-200 pb-3 last:border-0 last:pb-0"
                      >
                        <p className="text-md font-bold text-slate-700">Fatura {index + 1}</p>
                        <div className="mt-1 flex items-center justify-between text-sm text-slate-600">
                          <span>Data da Fatura:</span>
                          <strong className="font-medium text-slate-800">{formatMonthYear(bill.date)}</strong>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-sm text-slate-600">
                          <span>Valor do ICMS:</span>
                          <strong className="font-medium text-slate-800">{bill.icms ? `R$ ${bill.icms}` : "N/A"}</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 flex items-center gap-3 rounded-lg bg-blue-100 p-4 text-sm text-blue-800">
                    <LucideIcon name="Info" className="h-5 w-5 flex-shrink-0" />
                    <span>Esta simulação consumirá <strong>1 crédito</strong> do seu saldo.</span>
                  </div>
                  {loadingError && (
                    <p className="mt-4 text-sm font-medium text-red-500" aria-live="polite">
                      {loadingError}
                    </p>
                  )}
                  <button
                    type="button"
                    className="calculate-btn-premium mt-6 w-full rounded-lg py-3 text-lg font-semibold"
                    onClick={startCalculation}
                    disabled={calcularMutation.isPending}
                  >
                    {calcularMutation.isPending ? "Enviando..." : "Confirmar e Calcular"}
                  </button>
                </div>
              </div>

              <div id="loading-step" className={clsx("calculator-step", currentStep === loadingStepIndex && "active") }>
                <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center p-4 text-center">
                  <h2 className="mb-8 text-3xl font-bold text-white">Processando sua simulação...</h2>
                  {renderTimeline()}
                  {loadingError && (
                    <p className="mt-6 text-sm text-red-300">{loadingError}</p>
                  )}
                </div>
              </div>

              <div id="result-step" className={clsx("calculator-step", currentStep === resultStepIndex && "active") }>
                <div className="result-content pb-24 text-center">
                  <p className="mb-2 text-2xl text-slate-300">Seu valor estimado de restituição é de</p>
                  <h2 className="result-value text-6xl font-bold md:text-7xl">{resultValueDisplay}</h2>
                  {resultData && (
                    <p className="mt-4 text-sm text-slate-300">
                      Créditos restantes: <strong>{resultData.creditos_restantes}</strong>
                    </p>
                  )}
                  <div className="mt-12 flex flex-col justify-center gap-4 sm:flex-row">
                    <button
                      type="button"
                      className="rounded-full bg-slate-200 px-6 py-3 font-semibold text-slate-800 transition hover:bg-slate-300"
                      onClick={resetCalculator}
                    >
                      Começar de novo
                    </button>
                    <button
                      type="button"
                      className="start-btn"
                      onClick={() => setActiveNavIndex(2)}
                    >
                      Ver o resumo
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
          <section id="history" className="page text-center">
            <p className="text-2xl text-slate-600">Histórico de Cálculos</p>
          </section>
          <section id="credits" className="page text-center">
            <p className="text-2xl text-slate-600">Gestão de Créditos</p>
          </section>
        </div>
      </main>

      <div className="nav-container fixed bottom-5 left-1/2 z-10 -translate-x-1/2">
        <nav className="nav-enter max-w-[95vw] rounded-3xl bg-[rgba(30,41,59,0.9)] px-3 py-1 text-white shadow-2xl">
          <div className="flex items-center justify-center gap-2 sm:gap-3" id="nav-links">
            <div id="nav-indicator" ref={navIndicatorRef}></div>
            {navLinks.map((link, index) => {
              const isActive = index === activeNavIndex;
              return (
              <a
                key={link.id}
                href={`#${link.id}`}
                ref={(element) => {
                  navLinkRefs.current[index] = element;
                }}
                data-index={index}
                className="nav-link rounded-lg p-2"
                onClick={(event) => {
                  event.preventDefault();
                  setActiveNavIndex(index);
                }}
              >
                <div
                  className={clsx(
                    "flex flex-col items-center gap-1",
                    isActive ? "text-primary-accent" : "text-slate-300"
                  )}
                  style={isActive ? { color: link.color } : undefined}
                >
                  <LucideIcon name={link.icon} className="h-6 w-6" />
                  <span className="text-xs font-medium">{link.label}</span>
                </div>
              </a>
              );
            })}
            <div className="h-8 w-px bg-slate-700" />
            <button
              type="button"
              className="nav-link rounded-lg p-2"
              onClick={handleLeavePlatform}
              disabled={isLeavingPlatform}
            >
              <div className="flex flex-col items-center gap-1 text-slate-300">
                <LucideIcon name="LogOut" className="h-6 w-6" />
                <span className="text-xs font-medium">{isLeavingPlatform ? "Voltando..." : "Sair"}</span>
              </div>
            </button>
          </div>
        </nav>
      </div>
      <style jsx global>{`
        .calculator-root {
          overflow: hidden;
        }
        .calculator-root .nav-container {
          perspective: 800px;
        }
        .calculator-root .nav-enter {
          animation: slideUp 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
          position: relative;
          overflow: hidden;
        }
        .calculator-root .nav-enter::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at 10% 20%, rgba(13, 148, 136, 0.2), transparent 25%),
            radial-gradient(circle at 80% 30%, rgba(59, 130, 246, 0.2), transparent 25%),
            radial-gradient(circle at 30% 80%, rgba(139, 92, 246, 0.2), transparent 25%),
            radial-gradient(circle at 90% 90%, rgba(202, 138, 4, 0.2), transparent 25%);
          background-size: 200% 200%;
          animation: liquid-aurora 15s linear infinite;
          z-index: 0;
        }
        .calculator-root #nav-links {
          position: relative;
          z-index: 1;
        }
        @keyframes liquid-aurora {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(50px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .calculator-root #page-container {
          display: flex;
          width: 400%;
          height: 100%;
          transition: transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
        .calculator-root .page {
          width: 25%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
          flex-shrink: 0;
        }
        .calculator-root #nav-indicator {
          position: absolute;
          bottom: 4px;
          height: 3px;
          background-color: var(--active-indicator-color, #0d9488);
          border-radius: 999px;
          box-shadow: 0 0 10px 0 var(--active-indicator-color, #0d9488);
          transition: left 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94), width 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94), background-color 0.3s ease;
          z-index: 2;
        }
        .calculator-root #calculate {
          position: relative;
        }
        .calculator-root #calculate-container {
          width: 100%;
          height: 100%;
          position: relative;
        }
        .calculator-root .calculator-step {
          width: 100%;
          height: 100%;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          position: absolute;
          top: 0;
          left: 0;
          padding: 1.5rem;
          opacity: 0;
          visibility: hidden;
          transition: opacity 0.4s ease-in-out, transform 0.4s ease-in-out, visibility 0.4s ease-in-out;
          transform: scale(0.98);
        }
        .calculator-root .calculator-step.active {
          opacity: 1;
          visibility: visible;
          z-index: 5;
          transform: scale(1);
        }
        .calculator-root #welcome-step {
          background-color: #0f172a;
          overflow: hidden;
          z-index: 6;
        }
        .calculator-root .particle {
          position: absolute;
          background-color: #0d9488;
          border-radius: 50%;
          opacity: 0;
          animation: rise 10s infinite linear;
        }
        @keyframes rise {
          0% { transform: translateY(100vh) scale(0); opacity: 1; }
          100% { transform: translateY(-10vh) scale(1); opacity: 0; }
        }
        .calculator-root .welcome-content {
          animation: welcome-fade-in 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.2s forwards;
          opacity: 0;
        }
        @keyframes welcome-fade-in {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        .calculator-root .start-btn {
          background-color: #0d9488;
          color: white;
          padding: 0.75rem 2rem;
          border-radius: 999px;
          font-weight: 600;
          box-shadow: 0 5px 20px rgba(13, 148, 136, 0.4);
          transition: all 0.3s ease;
          animation: pulse-glow 2.5s infinite;
        }
        .calculator-root .start-btn:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 25px rgba(13, 148, 136, 0.6);
          animation-play-state: paused;
        }
        @keyframes pulse-glow {
          0% { box-shadow: 0 5px 20px rgba(13, 148, 136, 0.4); }
          50% { box-shadow: 0 5px 30px rgba(13, 148, 136, 0.6); }
          100% { box-shadow: 0 5px 20px rgba(13, 148, 136, 0.4); }
        }
        .calculator-root .back-btn {
          position: absolute;
          top: 1.5rem;
          left: 1.5rem;
          background-color: #e2e8f0;
          border-radius: 50%;
          padding: 0.5rem;
          transition: background-color 0.2s;
          z-index: 10;
        }
        .calculator-root .back-btn:hover {
          background-color: #cbd5e1;
        }
        .calculator-root .bill-option-card {
          border: 2px solid #e2e8f0;
          transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
        .calculator-root .bill-option-card:hover {
          transform: translateY(-4px);
          border-color: #0d9488;
          box-shadow: 0 10px 20px -5px rgba(13, 148, 136, 0.2);
        }
        .calculator-root .bill-option-card.selected {
          background-color: #0d9488;
          color: white;
          border-color: #0d9488;
        }
        .calculator-root .input-field {
          font-size: 1rem;
          padding: 0.75rem 1rem 0.75rem 3rem;
          border-radius: 0.5rem;
          border: 1px solid #e2e8f0;
          width: 100%;
          transition: border-color 0.3s;
        }
        .calculator-root .input-group {
          position: relative;
        }
        .calculator-root .input-icon {
          position: absolute;
          left: 1rem;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
        }
        .calculator-root .input-field:focus {
          border-color: #3b82f6;
          outline: none;
        }
        .flatpickr-calendar {
          font-family: 'Inter', sans-serif;
          background: #ffffff;
          border-radius: 0.75rem;
          box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
          border: 1px solid #e2e8f0;
        }
        .flatpickr-day.selected {
          background: #0d9488;
          border-color: #0d9488;
          color: #fff;
        }
        .flatpickr-day:hover {
          background: #ccfbf1;
        }
        .calculator-root .carousel-container {
          position: relative;
          overflow: hidden;
          border-radius: 1rem;
          background-color: #e2e8f0;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.06);
        }
        .calculator-root .carousel-track {
          display: flex;
          transition: transform 0.5s ease-in-out;
        }
        .calculator-root .carousel-slide {
          flex-shrink: 0;
          width: 100%;
          padding: 1rem;
          text-align: center;
        }
        .calculator-root .carousel-slide img {
          max-width: 100%;
          height: auto;
          max-height: 150px;
          margin: 0 auto 0.5rem;
          object-fit: contain;
        }
        .calculator-root .carousel-dots {
          position: absolute;
          bottom: 0.75rem;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 0.5rem;
        }
        .calculator-root .carousel-dot {
          width: 0.5rem;
          height: 0.5rem;
          border-radius: 50%;
          background-color: rgba(0,0,0,0.2);
          transition: background-color 0.3s;
        }
        .calculator-root .carousel-dot.active {
          background-color: #3b82f6;
        }
        .calculator-root .summary-cards-container {
          scrollbar-width: thin;
          scrollbar-color: #3b82f6 #e2e8f0;
        }
        .calculator-root .calculate-btn-premium {
          background: linear-gradient(45deg, #0d9488, #3b82f6);
          color: white;
          transition: all 0.3s ease;
        }
        .calculator-root .calculate-btn-premium:hover {
          transform: translateY(-2px);
          box-shadow: 0 7px 20px -5px rgba(13, 148, 136, 0.5);
        }
        .calculator-root #loading-step {
          background-color: #0f172a;
          color: #e2e8f0;
        }
        .calculator-root .timeline {
          position: relative;
          padding-left: 2.5rem;
          text-align: left;
        }
        .calculator-root .timeline-item {
          position: relative;
          padding-bottom: 2rem;
        }
        .calculator-root .timeline-item::before {
          content: '';
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
        .calculator-root .timeline-item.completed::before {
          background-color: #0d9488;
          border-color: #0d9488;
          box-shadow: 0 0 10px #0d9488;
        }
        .calculator-root .timeline-item:not(:last-child)::after {
          content: '';
          position: absolute;
          left: -1.4rem;
          top: 1.75rem;
          bottom: -0.5rem;
          width: 3px;
          background-color: #334155;
        }
        .calculator-root .timeline-content {
          opacity: 0.5;
          transition: opacity 0.5s ease;
        }
        .calculator-root .timeline-item.active .timeline-content,
        .calculator-root .timeline-item.completed .timeline-content {
          opacity: 1;
        }
        .calculator-root .loader-icon {
          transition: all 0.5s ease;
        }
        .calculator-root .timeline-item.active .loader-icon {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .calculator-root #result-step {
          background: radial-gradient(circle, #1e293b, #0f172a);
        }
        .calculator-root .result-content {
          opacity: 0;
          transform: scale(0.8);
          animation: result-reveal 1s cubic-bezier(0.165, 0.84, 0.44, 1) forwards;
        }
        .calculator-root .result-value {
          color: #0d9488;
          text-shadow: 0 0 25px rgba(13, 148, 136, 0.8), 0 0 10px rgba(13, 148, 136, 0.6);
          animation: result-glow 3s infinite alternate;
        }
        @keyframes result-reveal {
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes result-glow {
          from { text-shadow: 0 0 25px rgba(13, 148, 136, 0.8); }
          to { text-shadow: 0 0 40px rgba(13, 148, 136, 1); }
        }
      `}</style>
    </div>
  );
}

interface CurrencyInputProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}

function CurrencyInput({ value, onValueChange, placeholder }: CurrencyInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const maskRef = useRef<InputMask<any> | null>(null);

  useEffect(() => {
    if (!inputRef.current) return;
    const mask = IMask(inputRef.current, {
      mask: Number,
      scale: 2,
      thousandsSeparator: ".",
      normalizeZeros: true,
      radix: ",",
      padFractionalZeros: true,
    });
    maskRef.current = mask;
    mask.on("accept", () => {
      onValueChange(mask.value);
    });
    return () => {
      mask.destroy();
      maskRef.current = null;
    };
  }, [onValueChange]);

  useEffect(() => {
    const mask = maskRef.current;
    if (mask) {
      if (mask.value !== value) {
        mask.value = value;
      }
    } else if (inputRef.current && inputRef.current.value !== value) {
      inputRef.current.value = value;
    }
  }, [value]);

  return (
    <input
      ref={inputRef}
      type="text"
      className="input-field"
      placeholder={placeholder}
    />
  );
}

export default Calculator;
