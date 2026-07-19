import { describe, expect, it, vi } from "vitest";
import type { BaseEvent } from "@monitor/event-contract";
import type { Client } from "@monitor/sdk-core";

const onINP = vi.hoisted(() => vi.fn());
vi.mock("web-vitals", () => ({ onINP }));

import { INPIntegration } from "./INP";

describe("INPIntegration", () => {
  it("registers onINP and emits the measured value with its rating", () => {
    vi.useFakeTimers();
    const previousWindow = (globalThis as { window?: unknown }).window;
    (globalThis as { window?: unknown }).window = {};
    const capture = vi.fn<(event: BaseEvent) => void>();
    const integration = new INPIntegration();

    try {
      integration.setup({ capture } as unknown as Client);

      expect(onINP).toHaveBeenCalledTimes(1);
      expect(onINP.mock.calls[0]![1]).toEqual({
        reportAllChanges: true,
        durationThreshold: 0,
      });
      const report = onINP.mock.calls[0]![0] as (metric: { value: number }) => void;
      report({ value: 240 });

      expect(capture).toHaveBeenCalledTimes(1);
      expect(capture.mock.calls[0]![0].type).toBe("performance");
      expect((capture.mock.calls[0]![0] as BaseEvent).payload).toEqual({
        metric: "INP",
        value: 240,
        rating: "needs-improvement",
      });

      vi.advanceTimersByTime(60_000);
      expect(capture).toHaveBeenCalledTimes(2);
      expect((capture.mock.calls[1]![0] as BaseEvent).payload).toEqual({
        metric: "INP",
        value: 240,
        rating: "needs-improvement",
      });

      integration.teardown();
      vi.advanceTimersByTime(60_000);
      expect(capture).toHaveBeenCalledTimes(2);
    } finally {
      integration.teardown();
      vi.useRealTimers();
      onINP.mockClear();
      if (previousWindow === undefined) delete (globalThis as { window?: unknown }).window;
      else (globalThis as { window?: unknown }).window = previousWindow;
    }
  });
});
