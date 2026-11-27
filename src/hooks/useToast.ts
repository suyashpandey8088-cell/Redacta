import { useCallback, useEffect, useRef, useState } from 'react';

export interface Toast {
  id: number;
  message: string;
}

/** A single transient status message that replaces the previous one and clears itself. */
export function useToast(durationMs = 3000) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<number | null>(null);
  const counter = useRef(0);

  const showToast = useCallback(
    (message: string) => {
      if (timer.current) window.clearTimeout(timer.current);
      setToast({ id: ++counter.current, message });
      timer.current = window.setTimeout(() => setToast(null), durationMs);
    },
    [durationMs],
  );

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  return { toast, showToast };
}
