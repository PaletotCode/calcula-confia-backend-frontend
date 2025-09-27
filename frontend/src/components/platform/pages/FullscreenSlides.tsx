"use client";

import type { ReactNode, TouchEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";

export type Slide = {
  id: string;
  content: ReactNode;
  ariaLabel?: string;
};

export interface FullscreenSlidesProps {
  slides: Slide[];
  initial?: number;
  onChange?(index: number): void;
}

const SWIPE_THRESHOLD = 48;

// Fullscreen vertical carousel used to replace native scrolling.
export default function FullscreenSlides({ slides, initial = 0, onChange }: FullscreenSlidesProps) {
  const sanitizedSlides = useMemo(() => slides.filter(Boolean), [slides]);
  const [activeIndex, setActiveIndex] = useState(() => {
    if (sanitizedSlides.length === 0) return 0;
    return Math.min(Math.max(initial, 0), sanitizedSlides.length - 1);
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);
  const slideRefs = useRef<Array<HTMLDivElement | null>>([]);

  const goToIndex = useCallback(
    (index: number) => {
      if (sanitizedSlides.length === 0) {
        return;
      }
      setActiveIndex((previous) => {
        const clamped = Math.min(Math.max(index, 0), sanitizedSlides.length - 1);
        return clamped === previous ? previous : clamped;
      });
    },
    [sanitizedSlides.length],
  );

  const goToNext = useCallback(() => {
    goToIndex(activeIndex + 1);
  }, [activeIndex, goToIndex]);

  const goToPrevious = useCallback(() => {
    goToIndex(activeIndex - 1);
  }, [activeIndex, goToIndex]);

  useEffect(() => {
    if (sanitizedSlides.length === 0) {
      return;
    }
    const clamped = Math.min(Math.max(activeIndex, 0), sanitizedSlides.length - 1);
    if (clamped !== activeIndex) {
      setActiveIndex(clamped);
      return;
    }
    const activeSlide = slideRefs.current[clamped];
    activeSlide?.focus({ preventScroll: true });
    onChange?.(clamped);
  }, [activeIndex, sanitizedSlides.length, onChange]);

  useEffect(() => {
    if (sanitizedSlides.length === 0) {
      return;
    }
    setActiveIndex((previous) => Math.min(previous, sanitizedSlides.length - 1));
  }, [sanitizedSlides.length]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (sanitizedSlides.length === 0) {
        return;
      }
      if (event.key === "ArrowDown" || event.key === "PageDown") {
        event.preventDefault();
        goToNext();
      }
      if (event.key === "ArrowUp" || event.key === "PageUp") {
        event.preventDefault();
        goToPrevious();
      }
      if (event.key === "Home") {
        event.preventDefault();
        goToIndex(0);
      }
      if (event.key === "End") {
        event.preventDefault();
        goToIndex(sanitizedSlides.length - 1);
      }
    },
    [goToIndex, goToNext, goToPrevious, sanitizedSlides.length],
  );

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const listener = (event: KeyboardEvent) => handleKeyDown(event);
    node.addEventListener("keydown", listener);
    return () => node.removeEventListener("keydown", listener);
  }, [handleKeyDown]);

  const handleTouchStart = useCallback((event: TouchEvent<HTMLDivElement>) => {
    const firstTouch = event.touches[0];
    touchStartY.current = firstTouch?.clientY ?? null;
  }, []);

  const handleTouchEnd = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      if (touchStartY.current == null) {
        return;
      }
      const lastTouch = event.changedTouches[0];
      if (!lastTouch) {
        touchStartY.current = null;
        return;
      }
      const deltaY = lastTouch.clientY - touchStartY.current;
      if (Math.abs(deltaY) > SWIPE_THRESHOLD) {
        if (deltaY > 0) {
          goToPrevious();
        } else {
          goToNext();
        }
      }
      touchStartY.current = null;
    },
    [goToNext, goToPrevious],
  );

  if (sanitizedSlides.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="relative flex h-full w-full flex-col"
      role="group"
      aria-roledescription="carousel"
      aria-live="polite"
      tabIndex={0}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="relative h-full w-full overflow-hidden" aria-atomic="true">
        {sanitizedSlides.map((slide, index) => {
          const isActive = index === activeIndex;
          return (
            <div
              key={slide.id}
              ref={(element) => {
                slideRefs.current[index] = element;
              }}
              className={clsx(
                "absolute inset-0 flex h-full w-full flex-col items-center justify-center p-6 text-center transition-all duration-[350ms] ease-out",
                isActive ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
              )}
              style={{ transform: `translateY(${(index - activeIndex) * 100}%)` }}
              role="group"
              aria-roledescription="slide"
              aria-label={slide.ariaLabel}
              id={slide.id}
              tabIndex={-1}
            >
              <div className="flex h-full w-full max-w-3xl flex-col items-center justify-center gap-6 text-slate-900">
                {slide.content}
              </div>
            </div>
          );
        })}
      </div>

      <div className="pointer-events-none absolute right-6 top-1/2 hidden -translate-y-1/2 flex-col items-center gap-3 md:flex">
        {sanitizedSlides.map((slide, index) => {
          const isActive = index === activeIndex;
          return (
            <button
              key={slide.id}
              type="button"
              className={clsx(
                "pointer-events-auto h-3 w-3 rounded-full border border-slate-500/40 transition",
                isActive ? "scale-110 border-slate-700 bg-slate-800" : "bg-white/70 hover:bg-slate-300",
              )}
              onClick={() => goToIndex(index)}
              aria-label={`Ir para o slide ${index + 1}`}
              aria-controls={slide.id}
            />
          );
        })}
      </div>

      <div className="pointer-events-none absolute bottom-8 left-1/2 flex -translate-x-1/2 gap-3">
        <button
          type="button"
          className="pointer-events-auto rounded-full bg-slate-900/70 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200"
          onClick={goToPrevious}
          aria-label="Slide anterior"
          disabled={activeIndex === 0}
        >
          Anterior
        </button>
        <button
          type="button"
          className="pointer-events-auto rounded-full bg-slate-900/70 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200"
          onClick={goToNext}
          aria-label="Próximo slide"
          disabled={activeIndex === sanitizedSlides.length - 1}
        >
          Próximo
        </button>
      </div>

      <style jsx>{`
        div[aria-roledescription="carousel"] {
          touch-action: none;
        }
      `}</style>
    </div>
  );
}