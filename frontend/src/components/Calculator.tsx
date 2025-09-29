"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LucideIcon, type IconName } from "@/components/LucideIcon";
import MainCalculator from "@/components/platform/MainCalculator";
import HomePage from "@/components/platform/pages/HomePage";
import HistoryPage from "@/components/platform/pages/HistoryPage";
import CreditsPage from "@/components/platform/pages/CreditsPage";
import useAuth from "@/hooks/useAuth";

interface CalculatorProps {
  onRequestBuyCredits?: () => void;
}

const navLinks: Array<{ id: string; label: string; icon: IconName; color: string }> = [
  { id: "home", label: "Iní­cio", icon: "House", color: "#0d9488" },
  { id: "calculate", label: "Calcular", icon: "Calculator", color: "#3b82f6" },
  { id: "history", label: "HistÃ³rico", icon: "History", color: "#8b5cf6" },
  { id: "credits", label: "CrÃ©ditos", icon: "Wallet", color: "#ca8a04" },
];

const CALCULATE_INDEX = navLinks.findIndex((link) => link.id === "calculate");

type CalculatorSection = (typeof navLinks)[number]["id"];

export function Calculator({ onRequestBuyCredits }: CalculatorProps) {
  const router = useRouter();
  const { logout } = useAuth();

  const [activeNavIndex, setActiveNavIndex] = useState(0);
  const [isLeaving, setIsLeaving] = useState(false);
  const pageContainerRef = useRef<HTMLDivElement>(null);
  const navIndicatorRef = useRef<HTMLDivElement>(null);
  const navLinkRefs = useRef<Array<HTMLAnchorElement | null>>([]);

  const navigateToSection = useCallback((section: CalculatorSection) => {
    const index = navLinks.findIndex((link) => link.id === section);
    if (index !== -1) {
      setActiveNavIndex(index);
    }
  }, []);

  useEffect(() => {
    const container = pageContainerRef.current;
    if (!container) {
      return;
    }
    container.style.transform = `translateX(${activeNavIndex * -25}%)`;
  }, [activeNavIndex]);

  const updateIndicator = useCallback(
    (index: number) => {
      const indicator = navIndicatorRef.current;
      const link = navLinkRefs.current[index];
      if (!indicator || !link) {
        return;
      }

      indicator.style.width = `${link.offsetWidth - 16}px`;
      indicator.style.left = `${link.offsetLeft + 8}px`;

      const color = navLinks[index]?.color ?? "#0d9488";
      document.documentElement.style.setProperty("--active-indicator-color", color);
    },
    [],
  );

  useEffect(() => {
    updateIndicator(activeNavIndex);
  }, [activeNavIndex, updateIndicator]);

  useEffect(() => {
    const handleResize = () => updateIndicator(activeNavIndex);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [activeNavIndex, updateIndicator]);

  const handleLogout = useCallback(async () => {
    if (isLeaving) {
      return;
    }
    setIsLeaving(true);
    try {
      await logout();
      router.replace('/');
    } finally {
      setIsLeaving(false);
    }
  }, [isLeaving, logout, router]);

  const handleNavigateToHistory = useCallback(() => {
    navigateToSection("history");
  }, [navigateToSection]);

  const handleNavigateToCredits = useCallback(() => {
    navigateToSection("credits");
  }, [navigateToSection]);

  const isCalculateVisible = activeNavIndex === CALCULATE_INDEX;

  return (
    <div className="calculator-root flex h-full min-h-screen w-full flex-col">
      <main className="flex-grow w-full overflow-hidden pb-24 lg:pb-32">
        <div
          id="page-container"
          ref={pageContainerRef}
          className="flex h-full transition-transform duration-500 ease-out"
        >
          <section id="home" className="page">
            <HomePage
              onNavigateToHistory={handleNavigateToHistory}
              onNavigateToCredits={handleNavigateToCredits}
            />
          </section>
          <section id="calculate" className="page calculate-page overflow-hidden">
            <MainCalculator
              onRequestBuyCredits={onRequestBuyCredits}
              onNavigateToHistory={handleNavigateToHistory}
              isVisible={isCalculateVisible}
            />
          </section>
          <section id="history" className="page">
            <HistoryPage />
          </section>
          <section id="credits" className="page">
            <CreditsPage onRequestBuyCredits={onRequestBuyCredits} />
          </section>
        </div>
      </main>

      <div className="nav-container fixed bottom-5 left-1/2 z-10 -translate-x-1/2">
        <nav className="nav-enter max-w-[95vw] rounded-3xl bg-[rgba(30,41,59,0.9)] px-3 py-1 text-white shadow-2xl">
          <div className="flex items-center justify-center gap-2 sm:gap-3" id="nav-links">
            <div id="nav-indicator" ref={navIndicatorRef}></div>
            {navLinks.map((link, index) => {
              const isActive = index === activeNavIndex;
              const itemClasses = `flex flex-col items-center gap-1 transition-colors ${
                isActive ? "" : "text-slate-300"
              }`;

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
                  <div className={itemClasses} style={isActive ? { color: link.color } : undefined}>
                    <LucideIcon name={link.icon} className="h-6 w-6" />
                    <span className="text-xs font-medium">{link.label}</span>
                  </div>
                </a>
              );
            })}
            <div className="hidden h-8 w-px bg-slate-700/60 sm:block" />
            <button
              type="button"
              className="nav-link rounded-lg p-2"
              onClick={handleLogout}
              disabled={isLeaving}
            >
              <div
                className={`flex flex-col items-center gap-1 ${
                  isLeaving ? "text-slate-400" : "text-slate-300"
                }`}
              >
                <LucideIcon name="LogOut" className="h-6 w-6" />
                <span className="text-xs font-medium">{isLeaving ? "Saindo..." : "Sair"}</span>
              </div>
            </button>
          </div>
        </nav>
      </div>

      <style jsx global>{`
        html,
        body,
        #__next {
          height: 100%;
        }
        body {
          margin: 0;
          overflow: hidden;
          background: linear-gradient(180deg, #f8fafc 0%, #eef2f7 60%, #e2e8f0 100%);
          font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          color: #0f172a;
        }
        #page-container {
          width: 400%;
          height: 100vh;
          display: flex;
        }
        #page-container > .page {
          width: 25%;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          flex-shrink: 0;
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
        @keyframes liquid-aurora {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(50px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .calculator-root #calculate.calculate-page {
          display: block;
          padding: 0;
        }
        .calculator-root #calculate.calculate-page > * {
          height: 100%;
          width: 100%;
        }
      `}</style>
    </div>
  );
}

export default Calculator;

