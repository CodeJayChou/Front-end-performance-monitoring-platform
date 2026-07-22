// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useApiData } from "./useApiData";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("useApiData", () => {
  it("separates initial loading from background refresh", async () => {
    const next = deferred<string>();
    const { result, rerender } = renderHook(
      ({ version }) => useApiData(() => version === 1 ? Promise.resolve("first") : next.promise, [version]),
      { initialProps: { version: 1 } },
    );

    await waitFor(() => expect(result.current.data).toBe("first"));
    rerender({ version: 2 });

    await waitFor(() => expect(result.current.refreshing).toBe(true));
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBe("first");

    await act(async () => next.resolve("second"));
    await waitFor(() => expect(result.current.data).toBe("second"));
    expect(result.current.refreshing).toBe(false);
  });

  it("preserves the last successful result when a refresh fails", async () => {
    const next = deferred<string>();
    const { result, rerender } = renderHook(
      ({ version }) => useApiData(() => version === 1 ? Promise.resolve("stable") : next.promise, [version]),
      { initialProps: { version: 1 } },
    );

    await waitFor(() => expect(result.current.data).toBe("stable"));
    rerender({ version: 2 });
    await act(async () => next.reject(new Error("network unavailable")));

    await waitFor(() => expect(result.current.error?.message).toBe("network unavailable"));
    expect(result.current.data).toBe("stable");
    expect(result.current.loading).toBe(false);
    expect(result.current.refreshing).toBe(false);
  });
});
