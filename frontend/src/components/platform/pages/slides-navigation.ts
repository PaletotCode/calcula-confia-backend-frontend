export interface SlidesNavigationState {
  goToNext(): void;
  goToPrevious(): void;
  canGoNext: boolean;
  canGoPrevious: boolean;
  activeIndex: number;
  totalSlides: number;
}

export type SlidesNavigationStateChange = (state: SlidesNavigationState | null) => void;