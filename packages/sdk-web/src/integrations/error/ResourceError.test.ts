import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BaseEvent } from "@monitor/event-contract";
import type { Client } from "@monitor/sdk-core";
import type { WebResourceErrorPayload } from "../../types";
import { ResourceErrorIntegration } from "./ResourceError";

type Listener = (event: unknown) => void;

const globalRef = globalThis as unknown as {
  window?: {
    addEventListener(type: string, cb: Listener, capture?: boolean): void;
    removeEventListener(type: string, cb: Listener, capture?: boolean): void;
  };
  location?: { href: string; origin: string };
};

// 模拟 window（只收 capture 阶段的 'error'）+ location，避免引入 jsdom
let errorListeners: Listener[];

function installEnv(): void {
  errorListeners = [];
  globalRef.window = {
    addEventListener(type, cb, capture) {
      if (type === "error" && capture) errorListeners.push(cb);
    },
    removeEventListener(type, cb, capture) {
      if (type === "error" && capture)
        errorListeners = errorListeners.filter((l) => l !== cb);
    },
  };
  globalRef.location = {
    href: "https://app.example.com/page",
    origin: "https://app.example.com",
  };
}

afterEach(() => {
  delete globalRef.window;
  delete globalRef.location;
});

/**
 * 构造一个最小 DOM 元素：getXPath 走 previousElementSibling/parentElement，
 * extractDomPath 走 nodeName/id/className/parentElement，故两者所需字段都给齐。
 */
interface FakeEl {
  tagName: string;
  nodeName: string;
  nodeType: number;
  id: string;
  className: string;
  src?: string;
  href?: string;
  getAttribute(name: string): string | null;
  parentElement: FakeEl | null;
  previousElementSibling: FakeEl | null;
}

function el(
  tag: string,
  props: {
    id?: string;
    className?: string;
    src?: string;
    href?: string;
    attrs?: Record<string, string>;
    parentElement?: FakeEl | null;
    previousElementSibling?: FakeEl | null;
  } = {},
): FakeEl {
  const attrs = props.attrs ?? {};
  return {
    tagName: tag.toUpperCase(),
    nodeName: tag.toUpperCase(),
    nodeType: 1,
    id: props.id ?? "",
    className: props.className ?? "",
    src: props.src,
    href: props.href,
    getAttribute: (name) => attrs[name] ?? null,
    parentElement: props.parentElement ?? null,
    previousElementSibling: props.previousElementSibling ?? null,
  };
}

function fire(target: unknown): void {
  errorListeners.forEach((l) => l({ target }));
}

function payloadOf(capture: ReturnType<typeof vi.fn>): WebResourceErrorPayload {
  return (capture.mock.calls[0]![0] as BaseEvent)
    .payload as WebResourceErrorPayload;
}

function setup(): ReturnType<typeof vi.fn> {
  const capture = vi.fn<(e: BaseEvent) => void>();
  new ResourceErrorIntegration().setup({ capture } as unknown as Client);
  return capture;
}

describe("ResourceErrorIntegration", () => {
  beforeEach(installEnv);

  it("img 加载失败 → 一条 error 事件（kind:resource），带 url/tagName/resourceType/定位字段", () => {
    const capture = setup();
    const body = el("body");
    const img = el("img", {
      className: "logo lazy",
      src: "https://cdn.example.com/logo.png",
      parentElement: body,
    });

    fire(img);

    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture.mock.calls[0]![0].type).toBe("error");
    expect(payloadOf(capture)).toMatchObject({
      kind: "resource",
      url: "https://cdn.example.com/logo.png",
      tagName: "img",
      resourceType: "img",
      message: "Resource load failed: img",
      isCrossOrigin: true, // cdn.example.com ≠ app.example.com
      domPath: "body > img.logo.lazy", // 多 class 用 . 连接
      xpath: "/body[1]/img[1]", // 与行为采集口径一致：带同名兄弟序号
      pageUrl: "https://app.example.com/page",
    });
  });

  it("link[rel=stylesheet] → css；取 href；同源 isCrossOrigin=false", () => {
    const capture = setup();
    fire(
      el("link", {
        href: "https://app.example.com/app.css",
        attrs: { rel: "stylesheet" },
      }),
    );

    expect(payloadOf(capture)).toMatchObject({
      url: "https://app.example.com/app.css",
      tagName: "link",
      resourceType: "css",
      isCrossOrigin: false,
    });
  });

  it("link[as=font] → font", () => {
    const capture = setup();
    fire(el("link", { href: "/fonts/x.woff2", attrs: { rel: "preload", as: "font" } }));
    expect(payloadOf(capture).resourceType).toBe("font");
  });

  it("video / audio / source → media", () => {
    const capture = setup();
    fire(el("video", { src: "/v.mp4" }));
    fire(el("audio", { src: "/a.mp3" }));
    fire(el("source", { src: "/s.webm" }));
    expect(capture.mock.calls.map((c) => (c[0] as BaseEvent).payload)).toEqual([
      expect.objectContaining({ resourceType: "media" }),
      expect.objectContaining({ resourceType: "media" }),
      expect.objectContaining({ resourceType: "media" }),
    ]);
  });

  it("相对 URL 按页面 origin 解析 → 同源", () => {
    const capture = setup();
    fire(el("script", { src: "/assets/app.js" }));
    expect(payloadOf(capture)).toMatchObject({
      resourceType: "script",
      isCrossOrigin: false,
    });
  });

  it("JS 运行时错误（target 为 window / null，无 tagName）被忽略，交给 GlobalError", () => {
    const capture = setup();
    fire(globalRef.window);
    fire(null);
    expect(capture).not.toHaveBeenCalled();
  });

  it("非资源元素（如 div）被忽略", () => {
    const capture = setup();
    fire(el("div", { id: "app" }));
    expect(capture).not.toHaveBeenCalled();
  });

  it("teardown 后移除 capture 监听，不再上报", () => {
    const capture = vi.fn<(e: BaseEvent) => void>();
    const integration = new ResourceErrorIntegration();
    integration.setup({ capture } as unknown as Client);
    expect(errorListeners).toHaveLength(1);

    integration.teardown();
    expect(errorListeners).toHaveLength(0);

    fire(el("img", { src: "/x.png" }));
    expect(capture).not.toHaveBeenCalled();
  });

  it("非浏览器环境（无 window）安全降级，不抛错", () => {
    delete globalRef.window;
    const capture = vi.fn();
    expect(() =>
      new ResourceErrorIntegration().setup({ capture } as unknown as Client),
    ).not.toThrow();
  });
});
