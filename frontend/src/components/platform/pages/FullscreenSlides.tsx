"use client";

import type { ReactNode, TouchEvent, WheelEvent } from "react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import clsx from "clsx";
import type { SlidesNavigationState, SlidesNavigationStateChange } from "./slides-navigation";
import { useSlidesOrientation } from "../mobile";

export type Slide = {
  id: string;
  content: ReactNode;
  ariaLabel?: string;
};

export interface FullscreenSlidesProps {
  slides: Slide[];
  initial?: number;
  onChange?(index: number): void;
  onSlideStateChange?: SlidesNavigationStateChange;
}

const SWIPE_THRESHOLD = 48;
const WHEEL_THRESHOLD = 48;
const WHEEL_COOLDOWN_MS = 400;

// Fullscreen vertical carousel used to replace native scrolling.
export interface FullscreenSlidesHandle {
  goToIndex(index: number): void;
  goToNext(): void;
  goToPrevious(): void;
  getActiveIndex(): number;
}

const FullscreenSlides = forwardRef<FullscreenSlidesHandle, FullscreenSlidesProps>(
  ({ slides, initial = 0, onChange, onSlideStateChange }, ref) => {
    const sanitizedSlides = useMemo(() => slides.filter(Boolean), [slides]);
    const [activeIndex, setActiveIndex] = useState(() => {
      if (sanitizedSlides.length === 0) return 0;
      return Math.min(Math.max(initial, 0), sanitizedSlides.length - 1);
    });
    const containerRef = useRef<HTMLDivElement>(null);
    const touchStartAxis = useRef<number | null>(null);
    const slideRefs = useRef<Array<HTMLDivElement | null>>([]);
    const lastWheelAt = useRef(0);
    const isWheelLocked = useRef(false);
    const wheelUnlockTimeout = useRef<NodeJS.Timeout | null>(null);
    const orientation = useSlidesOrientation();
    const isHorizontal = orientation === "horizontal";  
    const progress = sanitizedSlides.length > 0 ? (activeIndex + 1) / sanitizedSlides.length : 0;
    const progressPercentage = Math.max(0, Math.min(1, progress)) * 100;

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
        onSlideStateChange?.(null);
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
    
      const navigationState: SlidesNavigationState = {
        goToNext,
        goToPrevious,
        canGoNext: clamped < sanitizedSlides.length - 1,
        canGoPrevious: clamped > 0,
        activeIndex: clamped,
        totalSlides: sanitizedSlides.length,
      };

      onSlideStateChange?.(navigationState);
    }, [
      activeIndex,
      goToNext,
      goToPrevious,
      onChange,
      onSlideStateChange,
      sanitizedSlides.length,
    ]);

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
        if (isHorizontal) {
          if (event.key === "ArrowRight" || event.key === "PageDown") {
            event.preventDefault();
            goToNext();
          }
          if (event.key === "ArrowLeft" || event.key === "PageUp") {
            event.preventDefault();
            goToPrevious();
          }
        } else {
          if (event.key === "ArrowDown" || event.key === "PageDown") {
            event.preventDefault();
            goToNext();
          }
          if (event.key === "ArrowUp" || event.key === "PageUp") {
            event.preventDefault();
            goToPrevious();
          }
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
      [goToIndex, goToNext, goToPrevious, isHorizontal, sanitizedSlides.length],
    );

    useEffect(() => {
      const node = containerRef.current;
      if (!node) return;

      const listener = (event: KeyboardEvent) => handleKeyDown(event);
      node.addEventListener("keydown", listener);
      return () => node.removeEventListener("keydown", listener);
    }, [handleKeyDown]);

    const handleTouchStart = useCallback(
      (event: TouchEvent<HTMLDivElement>) => {
        const firstTouch = event.touches[0];
        if (!firstTouch) {
          touchStartAxis.current = null;
          return;
        }
        touchStartAxis.current = isHorizontal ? firstTouch.clientX : firstTouch.clientY;
      },
      [isHorizontal],
    );

    const handleTouchEnd = useCallback(
      (event: TouchEvent<HTMLDivElement>) => {
        if (touchStartAxis.current == null) {
          return;
        }
        const lastTouch = event.changedTouches[0];
        if (!lastTouch) {
          touchStartAxis.current = null;
          return;
        }
        const delta = (isHorizontal ? lastTouch.clientX : lastTouch.clientY) - touchStartAxis.current;
        if (Math.abs(delta) > SWIPE_THRESHOLD) {
          if (delta > 0) {
            goToPrevious();
          } else {
            goToNext();
          }
        }
        touchStartAxis.current = null;
      },
      [goToNext, goToPrevious, isHorizontal],
    );

    const handleWheel = useCallback(
      (event: WheelEvent<HTMLDivElement>) => {
        if (sanitizedSlides.length === 0) {
          return;
        }

        const normalizationFactor =
          event.deltaMode === 1
            ? 16
            : event.deltaMode === 2
            ? isHorizontal
              ? window.innerWidth || 1
              : window.innerHeight || 1
            : 1;
        const deltaRaw = (isHorizontal ? event.deltaX : event.deltaY) * normalizationFactor;

        if (Math.abs(deltaRaw) < WHEEL_THRESHOLD) {
          return;
        }

        const now = Date.now();
        const elapsed = now - lastWheelAt.current;

        if (isWheelLocked.current && elapsed < WHEEL_COOLDOWN_MS) {
          event.preventDefault();
          return;
        }

        event.preventDefault();

        if (deltaRaw > 0) {
          goToNext();
        } else {
          goToPrevious();
        }

        isWheelLocked.current = true;
        lastWheelAt.current = now;

        if (wheelUnlockTimeout.current) {
          clearTimeout(wheelUnlockTimeout.current);
        }

        wheelUnlockTimeout.current = setTimeout(() => {
          isWheelLocked.current = false;
        }, WHEEL_COOLDOWN_MS);
      },
      [goToNext, goToPrevious, isHorizontal, sanitizedSlides.length],
    );

    useEffect(() => {
      return () => {
        if (wheelUnlockTimeout.current) {
          clearTimeout(wheelUnlockTimeout.current);
        }
        onSlideStateChange?.(null);
      };
    }, [onSlideStateChange]);

    useImperativeHandle(
      ref,
      () => ({
        goToIndex,
        goToNext,
        goToPrevious,
        getActiveIndex: () => activeIndex,
      }),
      [activeIndex, goToIndex, goToNext, goToPrevious],
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
        data-orientation={orientation}
        tabIndex={0}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >

        <div className="pointer-events-none absolute left-1/2 top-4 w-full max-w-[min(420px,92vw)] -translate-x-1/2 px-6 sm:max-w-3xl">
          <div className="h-1.5 w-full rounded-full bg-slate-200/70">
            <div
              className="h-full rounded-full bg-slate-900 transition-all duration-300 ease-out"
              style={{ width: `${progressPercentage}%` }}
            >
              <span className="sr-only">{`Slide ${activeIndex + 1} de ${sanitizedSlides.length}`}</span>
            </div>
          </div>
        </div>
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
                  "absolute inset-0 flex h-full w-full flex-col items-center justify-center p-4 text-center transition-all duration-[350ms] ease-out sm:p-6",
                  isActive ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
                )}
                style={{
                  transform: isHorizontal
                    ? `translateX(${(index - activeIndex) * 100}%)`
                    : `translateY(${(index - activeIndex) * 100}%)`,
                }}
                role="group"
                aria-roledescription="slide"
                aria-label={slide.ariaLabel}
                id={slide.id}
                tabIndex={-1}
              >
                <div className="flex h-full w-full max-w-[min(420px,92vw)] flex-col items-center justify-center gap-5 text-slate-900 sm:max-w-3xl sm:gap-6">
                  {slide.content}
                </div>
              </div>
            );
          })}
        </div>

        <div
          className={clsx(
            "pointer-events-none absolute hidden items-center gap-3 md:flex",
            isHorizontal
              ? "bottom-6 left-1/2 -translate-x-1/2"
              : "right-6 top-1/2 -translate-y-1/2 flex-col",
          )}
        >
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

        <style jsx>{`
          div[aria-roledescription="carousel"] {
            touch-action: none;
          }
            div[aria-roledescription="carousel"][data-orientation="horizontal"] {
            touch-action: pan-y;
          }
        `}</style>
      </div>
    );
  },
);

FullscreenSlides.displayName = "FullscreenSlides";

export default FullscreenSlides;