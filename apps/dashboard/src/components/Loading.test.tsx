// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AsyncPage, ButtonLoadingContent, HomeLoadingState, LoadingState, LogoLoader, OverviewSkeleton, TableSkeleton } from "./Loading";

afterEach(() => vi.useRealTimers());

describe("dashboard loading system", () => {
  it("announces blocking loading states", () => {
    render(<LoadingState label="正在加载测试数据" />);
    expect(screen.getByRole("status")).toHaveTextContent("正在加载测试数据");
  });

  it("uses the animated project signal as its loading mark", () => {
    const { container } = render(<LogoLoader size="md" />);
    expect(container.firstElementChild).toHaveClass("brand-signal", "brand-signal-loading", "brand-signal-md");
  });

  it("reveals the logo loader only when the home page remains slow", () => {
    vi.useFakeTimers();
    render(<HomeLoadingState />);
    expect(screen.queryByText("网络响应较慢，请稍候")).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(480));
    expect(screen.getByText("网络响应较慢，请稍候")).toBeInTheDocument();
  });

  it("mirrors the detailed overview layout in its skeleton", () => {
    const { container } = render(<OverviewSkeleton />);
    expect(container.querySelectorAll(".overview-skeleton-stat")).toHaveLength(4);
    expect(container.querySelectorAll(".overview-skeleton-vital")).toHaveLength(4);
    expect(container.querySelectorAll(".overview-skeleton-release")).toHaveLength(5);
    expect(container.querySelectorAll(".table-skeleton-row")).toHaveLength(6);
  });

  it("marks a page busy without hiding existing content", () => {
    render(<AsyncPage refreshing error={null}><p>已有监控数据</p></AsyncPage>);
    expect(screen.getByText("已有监控数据").parentElement).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("已有监控数据")).toBeVisible();
  });

  it("keeps structural skeletons out of the accessibility tree", () => {
    const { container } = render(<TableSkeleton />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("uses a stable loading label inside action buttons", () => {
    render(<button><ButtonLoadingContent loading loadingLabel="保存中…">保存</ButtonLoadingContent></button>);
    expect(screen.getByRole("button")).toHaveTextContent("保存中…");
    expect(screen.queryByText("保存")).not.toBeInTheDocument();
  });
});
