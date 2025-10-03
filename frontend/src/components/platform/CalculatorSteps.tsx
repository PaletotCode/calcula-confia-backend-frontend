"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState, type ChangeEvent, type FC, type ReactNode } from "react";
import clsx from "clsx";
import Flatpickr from "react-flatpickr";
import "flatpickr/dist/flatpickr.css";
import { Portuguese } from "flatpickr/dist/l10n/pt";
import { ArrowLeft, Calendar, CheckCircle2, Info, Loader2, Minus, Plus } from "lucide-react";

export interface BillFormViewModel {
  issueDateValue: string;
  issueDateLabel: string;
  icmsValue: string;
}

export interface TimelineItem {
  title: string;
  description: string;
}

export interface WelcomeStepProps {
  isActive: boolean;
  onStart: () => void;
}

export const WelcomeStep: FC<WelcomeStepProps> = ({ isActive, onStart }) => {
  const particles = useMemo(
    () =>
      Array.from({ length: 16 }, (_, index) => ({
        id: index,
        left: `${Math.random() * 100}%`,
        delay: `${Math.random() * 5}s`,
        duration: `${8 + Math.random() * 6}s`,
        size: `${6 + Math.random() * 10}px`,
      })),
    [],
  );

  return (
    <div id="welcome-step" className={clsx("calculator-step", isActive && "active")}>
      <div id="welcome-bg" className="absolute inset-0">
        {particles.map((particle) => (
          <span
            key={particle.id}
            className="particle"
            style={{
              left: particle.left,
              animationDelay: particle.delay,
              animationDuration: particle.duration,
              width: particle.size,
              height: particle.size,
            }}
          />
        ))}
      </div>

      <div className="welcome-content relative z-10 flex flex-col items-center text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-white drop-shadow-[0_0_15px_rgba(13,148,136,0.7)]">
          É um prazer tê-lo aqui.
        </h1>
        <p className="mt-4 max-w-md text-base text-slate-300">
          Vamos descobrir juntos o valor estimado que você pode ter a receber.
        </p>
        <button type="button" className="start-btn mt-8" onClick={onStart}>
          Vamos começar
        </button>
      </div>
    </div>
  );
};

export interface SelectionStepProps {
  isActive: boolean;
  onContinue: (quantity: number) => void;
}

export const SelectionStep: FC<SelectionStepProps> = ({ isActive, onContinue }) => {
  const [quantity, setQuantity] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const MAX_BILLS = 12;

  // Função para acionar a animação do nÃºmero ao mudar de valor
  const triggerAnimation = () => {
    setIsAnimating(false);
    setTimeout(() => {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 300); // Deve corresponder Ã  duração da animação em CSS
    }, 10);
  };

  const updateQuantity = (newVal: number) => {
    // Garante que o valor esteja sempre entre 0 e MAX_BILLS
    const value = Math.max(0, Math.min(newVal, MAX_BILLS));
    if (value !== quantity) {
      setQuantity(value);
      triggerAnimation();
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    updateQuantity(Number.isNaN(value) ? 0 : value);
  };

  // LÃ³gica para a transição de cor do nÃºmero com base na quantidade
  const getQuantityColor = () => {
    const START_HUE = 158, START_SATURATION = 95, START_LIGHTNESS = 30, END_LIGHTNESS = 45;
    const percentage = quantity / MAX_BILLS;
    const newLightness = START_LIGHTNESS + (END_LIGHTNESS - START_LIGHTNESS) * percentage;
    return `hsl(${START_HUE}, ${START_SATURATION}%, ${newLightness}%)`;
  };

  return (
    <div id="selection-step" className={clsx("calculator-step flex flex-col justify-between p-4", isActive && "active")} style={{ background: 'linear-gradient(180deg, #f8fafc 0%, #eef2f5 100%)' }}>
      <header className="flex-shrink-0 h-10">
        {/* Header vazio para manter alinhamento vertical */}
      </header>

      <main className="flex-grow flex flex-col items-center justify-center text-center px-4">
        <div className="w-full max-w-sm" style={{ animation: isActive ? 'fadeIn 0.6s ease-out forwards' : 'none' }}>
          <h2 className="text-2xl font-bold leading-tight text-slate-900 sm:text-3xl">
            Você tem quantas contas em mÃ£os?
          </h2>
          <p className="mt-3 text-sm text-slate-500 md:text-base">
            Insira o nÃºmero de faturas que você usará para a simulação.
          </p>

          <div className="mt-8 bg-white/70 backdrop-blur-sm p-6 rounded-3xl shadow-lg shadow-slate-200/80 border border-slate-200/80">
            <div className="flex items-center justify-center gap-4">
              <button onClick={() => updateQuantity(quantity - 1)} disabled={quantity <= 0} className="quantity-btn rounded-full bg-white border border-slate-200 shadow-sm p-3 text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none active:scale-95 transition-all" aria-label="Diminuir quantidade">
                <Minus className="h-8 w-8" />
              </button>

              <input
                type="number"
                value={quantity.toString()}
                onChange={handleInputChange}
                onBlur={(e) => { if (e.target.value === '') setQuantity(0); }}
                min="0"
                max="12"
                style={{ color: getQuantityColor(), width: '120px', textAlign: 'center', transition: 'color 0.3s ease-in-out' }}
                className={clsx("border-none bg-transparent text-8xl font-extrabold outline-none p-0", isAnimating && "number-pop-animation")}
                aria-live="polite"
              />

              <button onClick={() => updateQuantity(quantity + 1)} disabled={quantity >= MAX_BILLS} className="quantity-btn rounded-full bg-white border border-slate-200 shadow-sm p-3 text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none active:scale-95 transition-all" aria-label="Aumentar quantidade">
                <Plus className="h-8 w-8" />
              </button>
            </div>
            <p className="mt-4 text-xs text-slate-400 font-medium">
              Máximo de 12 contas.
            </p>
            <button
                type="button"
                onClick={() => onContinue(quantity)}
                disabled={quantity <= 0}
                className="mt-6 w-full rounded-full py-3.5 text-sm font-semibold text-white shadow-lg transition start-btn disabled:bg-slate-400 disabled:cursor-not-allowed disabled:shadow-none"
            >
                Confirmar e seguir
            </button>
          </div>
        </div>
      </main>

      <footer className="flex-shrink-0 h-10">
        {/* Footer vazio para manter espaÃ§amento simÃ©trico */}
      </footer>
    </div>
  );
};

export interface FormStepProps {
  isActive: boolean;
  index: number;
  total: number;
  form: BillFormViewModel;
  onDateChange: (value: Date[]) => void;
  onIcmsChange: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
  errorMessage?: string | null;
  isLast: boolean;
}

const carouselSlides = [
  {
    title: "Onde encontrar o ICMS?",
    description: "Procure na seção 'Detalhes de Faturamento' ou 'Tributos' da sua conta de energia.",
    image: "https://placehold.co/400x300/e2e8f0/64748b?text=Onde+encontrar+o+ICMS%3F",
  },
  {
    title: "Preencha o valor exato",
    description: "Use vírgula para centavos, por exemplo: 45,78.",
    image: "https://placehold.co/400x300/e2e8f0/64748b?text=Preencha+o+valor+exato",
  },
  {
    title: "Use a data da fatura",
    description: "A data de vencimento ou de emissão pode ser usada como referência.",
    image: "https://placehold.co/400x300/e2e8f0/64748b?text=Data+da+fatura",
  },
];

export const FormStep: FC<FormStepProps> = ({
  isActive,
  index,
  total,
  form,
  onDateChange,
  onIcmsChange,
  onNext,
  onBack,
  errorMessage,
  isLast,
}) => {
  const [activeSlide, setActiveSlide] = useState(0);

  const dateLimits = useMemo(() => {
    const max = new Date();
    max.setHours(0, 0, 0, 0);
    const min = new Date(max);
    min.setFullYear(min.getFullYear() - 10);
    return { min, max };
  }, []);

  useEffect(() => {
    if (!isActive) {
      return;
    }
    const interval = window.setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % carouselSlides.length);
    }, 5000);
    return () => window.clearInterval(interval);
  }, [isActive]);

  useEffect(() => {
    if (!isActive) {
      setActiveSlide(0);
    }
  }, [isActive]);

  return (
    <div className={clsx("calculator-step form-step bg-white", isActive && "active")}>
      <button type="button" className="back-btn" onClick={onBack} aria-label="Voltar">
        <ArrowLeft className="h-6 w-6 text-slate-600" />
      </button>

      <div className="flex h-full w-full flex-col items-center justify-center overflow-y-auto px-4 pb-24">
        <div className="flex w-full max-w-4xl flex-col items-center justify-center gap-12 md:flex-row">
          <div className="order-2 w-full text-center md:order-1 md:w-1/2 md:text-left">
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              Fatura {index + 1} de {total}
            </h2>
            <p className="mt-2 mb-6 text-sm text-slate-500 sm:text-base">
              Preencha os dados desta fatura. As informações são salvas automaticamente.
            </p>

            <div className="input-group">
              <Calendar className="input-icon" />
              {/* Mantém o calendário bonito sem duplicar o input */}
              <Flatpickr
                value={form.issueDateValue}
                options={{
                  altInput: false,
                  altFormat: "d 'de' F, Y",
                  dateFormat: "Y-m-d",
                  locale: Portuguese,
                  minDate: dateLimits.min,
                  maxDate: dateLimits.max,
                }}
                className="input-field"
                onChange={onDateChange}
                placeholder="Data da fatura"
              />
            </div>

            <div className="input-group mt-4">
              <Info className="input-icon" />
              <input
                type="text"
                value={form.icmsValue}
                onChange={(event) => onIcmsChange(event.target.value)}
                className="input-field"
                placeholder="Valor do ICMS (R$)"
                inputMode="decimal"
                aria-label="Valor do ICMS"
              />
            </div>

            <button
              type="button"
              className="calculate-btn-premium mt-6 w-full rounded-lg py-3 text-lg font-semibold"
              onClick={onNext}
            >
              {isLast ? "Finalizar e Confirmar" : "Próxima Fatura"}
            </button>

            <div className="form-error-message mt-4 h-5 text-sm text-red-600">
              {errorMessage ?? ""}
            </div>
          </div>

          <div className="order-1 w-full md:order-2 md:w-1/2">
            <p className="mb-2 text-center text-sm font-semibold text-slate-600 md:hidden">
              Dicas rápidas:
            </p>
            <div className="carousel-container aspect-video md:aspect-square">
              <div
                className="carousel-track"
                style={{ transform: `translateX(-${activeSlide * 100}%)` }}
              >
                {carouselSlides.map((slide) => (
                  <div key={slide.title} className="carousel-slide">
                    <img src={slide.image} alt={slide.title} className="mx-auto mb-3 max-h-40 w-full object-cover" />
                    <p className="text-sm font-semibold text-slate-700 sm:text-base">{slide.title}</p>
                    <p className="mt-1 text-xs text-slate-500 sm:text-sm">{slide.description}</p>
                  </div>
                ))}
              </div>
              <div className="carousel-dots">
                {carouselSlides.map((slide, slideIndex) => (
                  <button
                    key={slide.title}
                    type="button"
                    className={clsx("carousel-dot", activeSlide === slideIndex && "active")}
                    onClick={() => setActiveSlide(slideIndex)}
                    aria-label={`Ir para dica ${slideIndex + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export interface ConfirmationStepProps {
  isActive: boolean;
  forms: BillFormViewModel[];
  onBack: () => void;
  onConfirm: () => void;
}

export const ConfirmationStep: FC<ConfirmationStepProps> = ({
  isActive,
  forms,
  onBack,
  onConfirm,
}) => (
  <div id="confirmation-step" className={clsx("calculator-step bg-slate-100 !pb-24", isActive && "active")}> 
    <button type="button" className="back-btn" onClick={onBack} aria-label="Voltar">
      <ArrowLeft className="h-6 w-6 text-slate-600" />
    </button>

    <div className="w-full max-w-lg rounded-2xl bg-white p-6 text-center shadow-lg md:p-8">
      <h2 className="text-2xl font-bold text-slate-900">Resumo da Simulação</h2>
      <p className="mt-2 mb-6 text-slate-500">
        Confira os dados das faturas que você inseriu. Se tudo estiver correto, podemos prosseguir.
      </p>

      <div className="summary-cards-container max-h-60 space-y-4 overflow-y-auto rounded-lg border bg-slate-50 p-4 text-left">
        {forms.map((form, index) => (
          <div key={`summary-${index}`} className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm">
            <div>
              <p className="text-sm font-semibold text-slate-700">Fatura {index + 1}</p>
              <p className="text-xs text-slate-500">Data: {form.issueDateLabel || "—"}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-emerald-600">ICMS</p>
              <p className="text-xs text-slate-500">R$ {form.icmsValue || "0,00"}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-3 rounded-lg bg-blue-100 p-4 text-sm text-blue-800">
        <Info className="h-5 w-5 flex-shrink-0" />
        <span>Esta simulação consumirá <strong>1 crédito</strong> do seu saldo.</span>
      </div>

      <button
        type="button"
        className="calculate-btn-premium mt-6 w-full rounded-lg py-3 text-lg font-semibold"
        onClick={onConfirm}
      >
        Confirmar e Calcular
      </button>
    </div>
  </div>
);
export interface LoadingStepProps {
  isActive: boolean;
  activeIndex: number;
  items: TimelineItem[];
}

export const LoadingStep: FC<LoadingStepProps> = ({ isActive, activeIndex, items }) => (
  <div id="loading-step" className={clsx("calculator-step", isActive && "active")}>
    <div className="mx-auto flex w full max-w-md flex-col items-start justify-center gap-8 p-6 text-left">
      <h2 className="text-3xl font-bold text-white">Processando sua simulação...</h2>
      <div className="timeline w-full">
        {items.map((item, index) => (
          <div
            key={item.title}
            className={clsx(
              "timeline-item",
              index < activeIndex && "completed",
              index === activeIndex && "active",
            )}
          >
            <div className="timeline-content">
              <h3 className="text-base font-semibold text-slate-100">{item.title}</h3>
              <p className="mt-1 text-sm text-slate-400">{item.description}</p>
            </div>
            <div className="loader-icon absolute left-[-2.05rem] top-[0.25rem] flex h-6 w-6 items-center justify-center text-emerald-500">
              {index < activeIndex ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : index === activeIndex ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export interface ResultStepProps {
  isActive: boolean;
  amount: string;
  onRestart: () => void;
  onViewSummary: () => void;
}

export const ResultStep: FC<ResultStepProps> = ({ isActive, amount, onRestart, onViewSummary }) => (
  <div id="result-step" className={clsx("calculator-step", isActive && "active")}>
    <div className="result-content text-center pb-24">
      <p className="mb-2 text-2xl text-slate-300">Seu valor estimado de restituição Ã© de</p>
      <h2 className="result-value text-6xl font-bold md:text-7xl">{amount}</h2>
      <div className="mt-12 flex flex-col gap-4 sm:flex-row sm:justify-center">
        <button
          type="button"
          className="rounded-full bg-slate-200 px-6 py-3 font-semibold text-slate-800 transition hover:bg-slate-300"
          onClick={onRestart}
        >
          Começar de novo
        </button>
        <button type="button" className="start-btn" onClick={onViewSummary}>
          Ver o resumo
        </button>
      </div>
    </div>
  </div>
);

export interface ErrorOverlayProps {
  title: string;
  messages: string[];
  primaryActionLabel: string;
  onPrimaryAction: () => void;
}

export const ErrorOverlay: FC<ErrorOverlayProps> = ({
  title,
  messages,
  primaryActionLabel,
  onPrimaryAction,
}) => (
  <div className="error-overlay">
    <div className="error-modal">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <div className="mt-4 space-y-2 text-sm text-slate-600">
        {messages.map((message, index) => (
          <p key={`${message}-${index}`}>{message}</p>
        ))}
      </div>
      <button type="button" className="start-btn mt-6 w-full" onClick={onPrimaryAction}>
        {primaryActionLabel}
      </button>
    </div>
  </div>
);

export interface BottomHintProps {
  children: ReactNode;
}

export const BottomHint: FC<BottomHintProps> = ({ children }) => (
  <div className="pointer-events-none absolute inset-x-0 bottom-10 flex justify-center px-4">
    <div className="pointer-events-auto rounded-2xl bg-white/80 px-4 py-2 text-xs font-medium text-emerald-600 shadow-lg backdrop-blur">
      {children}
    </div>
  </div>
);

