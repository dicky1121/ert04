import React from 'react';

/**
 * Returns true if the viewport is ≥ 768 px (Tailwind's `md` breakpoint).
 * Uses matchMedia so only ONE of the desktop/mobile render branches is mounted
 * at a time — halving the DOM node count on each viewport size.
 */
export const useIsDesktop = (): boolean => {
  const [isDesktop, setIsDesktop] = React.useState(
    () => window.matchMedia('(min-width: 768px)').matches
  );

  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return isDesktop;
};
