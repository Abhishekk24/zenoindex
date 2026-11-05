import { useCallback, useEffect, useState } from 'react';

export type Loadable<T> = {
  data?: T;
  error?: string;
  loading: boolean;
  reload: () => void;
};

/**
 * Runs `load` on mount and whenever `key` changes. While a reload is in
 * flight the previous data stays visible.
 */
export function useLoad<T>(load: () => Promise<T>, key: string): Loadable<T> {
  const [attempt, setAttempt] = useState(0);
  const request = `${key}#${attempt}`;
  // Each result remembers the request it answers; `loading` means there is
  // no result for the current request yet.
  const [result, setResult] = useState<{
    request?: string;
    data?: T;
    error?: string;
  }>({});
  useEffect(() => {
    let live = true;
    load().then(
      data => {
        if (live) setResult({ request, data });
      },
      (error: unknown) => {
        if (live) {
          setResult(previous => ({
            request,
            data: previous.data,
            error:
              error instanceof Error ? error.message : 'Something went wrong.',
          }));
        }
      },
    );
    return () => {
      live = false;
    };
    // `request` says when the inputs really changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  const reload = useCallback(() => setAttempt(n => n + 1), []);
  const answered = result.request === request;
  return {
    data: result.data,
    error: answered ? result.error : undefined,
    loading: !answered,
    reload,
  };
}
