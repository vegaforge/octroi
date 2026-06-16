'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'crawlpay_api_key';
const EVENT = 'crawlpay:apikey';

/**
 * API-key session. Key comes from onboarding (POST /publishers), lives in
 * localStorage, sent as a Bearer token on the probe and publisher mutations.
 * Custom event syncs hooks in this tab; `storage` event syncs other tabs.
 */
export interface ApiKeyState {
  apiKey: string | null;
  /** True until localStorage has been read on mount. */
  hydrated: boolean;
  setApiKey: (key: string) => void;
  clearApiKey: () => void;
}

function read(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function useApiKey(): ApiKeyState {
  const [apiKey, setKey] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setKey(read());
    setHydrated(true);

    function sync() {
      setKey(read());
    }
    window.addEventListener('storage', sync);
    window.addEventListener(EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(EVENT, sync);
    };
  }, []);

  const setApiKey = useCallback((key: string) => {
    window.localStorage.setItem(STORAGE_KEY, key);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const clearApiKey = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { apiKey, hydrated, setApiKey, clearApiKey };
}

/** Non-reactive read for fetch helpers that need the current key. */
export function getStoredApiKey(): string | null {
  return read();
}
