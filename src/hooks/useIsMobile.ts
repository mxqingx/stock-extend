import { useEffect, useState } from 'react';

const MOBILE_QUERY = '(max-width: 767px)';

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(MOBILE_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const m = window.matchMedia(MOBILE_QUERY);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    // modern addEventListener
    if (m.addEventListener) m.addEventListener('change', handler);
    else m.addListener(handler as unknown as EventListener);
    return () => {
      if (m.removeEventListener) m.removeEventListener('change', handler);
      else m.removeListener(handler as unknown as EventListener);
    };
  }, []);

  return isMobile;
}

export default useIsMobile;
