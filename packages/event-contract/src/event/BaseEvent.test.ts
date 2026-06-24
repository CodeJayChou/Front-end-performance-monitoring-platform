import { describe, expect, it } from "vitest";
import { createEvent } from "./BaseEvent";

describe("createEvent", () => {
  it("把 payload 包装成统一的 BaseEvent 结构", () => {
    const event = createEvent("error", { message: "x" });

    expect(event.type).toBe("error");
    expect(event.platform).toBe("web");
    expect(typeof event.id).toBe("string");
    expect(event.id.length).toBeGreaterThan(0);
    expect(typeof event.timestamp).toBe("number");
    expect(event.payload).toEqual({ message: "x" });
  });

  it("每次生成唯一 id", () => {
    expect(createEvent("error", null).id).not.toBe(createEvent("error", null).id);
  });
});
