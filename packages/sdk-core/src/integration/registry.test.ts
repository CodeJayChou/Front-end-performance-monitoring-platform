import { describe, expect, it, vi } from "vitest";
import type { Client } from "../client/Client";
import type { Integration } from "./Integration";
import { IntegrationRegistry } from "./registry";
import { DynamicLoader } from "./DynamicLoader";

const makeIntegration = (name: string, setup = vi.fn()): Integration => ({
  name,
  setup,
});

describe("IntegrationRegistry", () => {
  it("register 后可按名称 create，每次返回新实例", () => {
    const registry = new IntegrationRegistry();
    registry.register("error", () => makeIntegration("error"));

    const a = registry.create("error");
    const b = registry.create("error");

    expect(a?.name).toBe("error");
    expect(a).not.toBe(b);
    expect(registry.has("error")).toBe(true);
  });

  it("未登记的能力 create 返回 null", () => {
    const registry = new IntegrationRegistry();
    expect(registry.create("nope")).toBeNull();
    expect(registry.has("nope")).toBe(false);
  });
});

describe("DynamicLoader", () => {
  it("enable 会从 registry 创建插件并 use 到 client", () => {
    const setup = vi.fn();
    const registry = new IntegrationRegistry();
    registry.register("error", () => makeIntegration("error", setup));

    const use = vi.fn();
    const client = { use } as unknown as Client;

    new DynamicLoader(registry, client).enable("error");

    expect(use).toHaveBeenCalledTimes(1);
    expect(use.mock.calls[0]![0]).toMatchObject({ name: "error" });
  });

  it("enable 未登记能力时静默忽略", () => {
    const registry = new IntegrationRegistry();
    const use = vi.fn();
    const client = { use } as unknown as Client;

    expect(() =>
      new DynamicLoader(registry, client).enable("missing"),
    ).not.toThrow();
    expect(use).not.toHaveBeenCalled();
  });
});
