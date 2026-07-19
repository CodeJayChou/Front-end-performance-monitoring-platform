import { useEffect, useState } from "react";

interface AsyncState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
}

export function useApiData<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  dependencies: readonly unknown[],
): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    const controller = new AbortController();
    setState((current) => ({ ...current, loading: true, error: null }));
    void loader(controller.signal).then(
      (data) => setState({ data, error: null, loading: false }),
      (error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({
          data: null,
          error: error instanceof Error ? error : new Error("未知查询错误"),
          loading: false,
        });
      },
    );
    return () => controller.abort();
  }, dependencies);

  return state;
}
