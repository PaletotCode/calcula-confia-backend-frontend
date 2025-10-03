import { useEffect, useState } from "react";

export type SlidesOrientation = "horizontal" | "vertical";

const MOBILE_MAX_WIDTH = 768;

function getOrientation(): SlidesOrientation {
  if (typeof window === "undefined") {
    return "vertical";
  }
  return window.innerWidth <= MOBILE_MAX_WIDTH ? "horizontal" : "vertical";
}

export function useSlidesOrientation() {
  const [orientation, setOrientation] = useState<SlidesOrientation>(getOrientation);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleResize = () => {
      setOrientation(getOrientation());
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return orientation;
}