import { useCallback, useEffect, useRef, useState } from "react";

export function usePillIndicator<T extends string>(active: T) {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttons = useRef(new Map<T, HTMLButtonElement>());
  const [pill, setPill] = useState({ left: 0, width: 0 });

  const measure = useCallback(() => {
    const button = buttons.current.get(active);
    if (!button || !containerRef.current) return;
    // Offset coordinates stay correct when the filter strip scrolls horizontally.
    const next = { left: button.offsetLeft, width: button.offsetWidth };
    setPill((previous) =>
      previous.left === next.left && previous.width === next.width
        ? previous
        : next,
    );
  }, [active]);

  useEffect(() => {
    measure();
    const observer = new ResizeObserver(measure);
    if (containerRef.current) observer.observe(containerRef.current);
    for (const button of buttons.current.values()) observer.observe(button);
    return () => observer.disconnect();
  }, [measure]);

  const setRef = useCallback((key: T, button: HTMLButtonElement | null) => {
    if (button) buttons.current.set(key, button);
    else buttons.current.delete(key);
  }, []);

  return { containerRef, setRef, pill };
}
