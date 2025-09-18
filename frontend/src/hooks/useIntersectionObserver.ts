
import { useState, useEffect, useRef, type RefObject } from 'react';

interface UseIntersectionObserverOptions {
  threshold?: number;
  root?: Element | null;
  rootMargin?: string;
}

// Este hook retorna uma 'ref' para você colocar em um elemento, e um booleano 'isIntersecting'
// que se torna 'true' quando o elemento aparece na tela.
export function useIntersectionObserver(
  options: UseIntersectionObserverOptions = {}
): [RefObject<HTMLDivElement>, boolean] {
  const [isIntersecting, setIntersecting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Se o elemento estiver visível, atualiza o estado
        if (entry.isIntersecting) {
          setIntersecting(true);
          // Para a observação depois da primeira vez para economizar recursos
          if (ref.current) {
            observer.unobserve(ref.current);
          }
        }
      },
      {
        threshold: 0.1, // A animação dispara quando 10% do elemento estiver visível
        ...options,
      }
    );

    const currentRef = ref.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [options]);

  return [ref, isIntersecting];
}
