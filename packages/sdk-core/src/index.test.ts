import { describe, expect, it, vi } from "vitest";
import { init } from "./index";
import type { Integration } from "./integration/Integration";

describe("init", () => {
  it("默认 platform 为 web，并初始化传入的插件", () => {
    const setup = vi.fn();
    const integration: Integration = { name: "test", setup };

    const client = init({ integrations: [integration] });

    expect(client.platform).toBe("web");
    expect(setup).toHaveBeenCalledWith(client);
  });

  it("可以覆盖 platform", () => {
    expect(init({ platform: "mp" }).platform).toBe("mp");
  });

  it("无插件时也能正常初始化", () => {
    expect(() => init()).not.toThrow();
  });
});
