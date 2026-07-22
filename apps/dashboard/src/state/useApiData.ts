import { useEffect, useRef, useState } from "react";

interface AsyncState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  refreshing: boolean;
}

export function useApiData<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  dependencies: readonly unknown[],
): AsyncState<T> {
  const requestIdRef = useRef(0);
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    error: null,
    loading: true,
    refreshing: false,
  });

  useEffect(() => {
    const controller = new AbortController();
    const requestId = ++requestIdRef.current;
    setState((current) => ({
      ...current,
      error: null,
      loading: current.data === null,
      refreshing: current.data !== null,
    }));
    void loader(controller.signal).then(
      (data) => {
        if (controller.signal.aborted || requestId !== requestIdRef.current) return;
        setState({ data, error: null, loading: false, refreshing: false });
      },
      (error: unknown) => {
        if (controller.signal.aborted || requestId !== requestIdRef.current) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState((current) => ({
          data: current.data,
          error: error instanceof Error ? error : new Error("未知查询错误"),
          loading: false,
          refreshing: false,
        }));
      },
    );
    return () => controller.abort();
  }, dependencies);

  return state;
}
