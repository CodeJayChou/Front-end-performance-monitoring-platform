// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState, StatCard } from "./Ui";

describe("dashboard UI states", () => {
  it("renders a metric with its supporting context", () => {
    render(<StatCard label="错误事件" value={12} hint="错误率 2.4%" tone="danger" />);
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("错误率 2.4%")).toBeInTheDocument();
  });

  it("renders an actionable empty-state explanation", () => {
    render(<EmptyState title="暂无性能样本" description="运行浏览器演示后再刷新。" />);
    expect(screen.getByText("暂无性能样本")).toBeInTheDocument();
    expect(screen.getByText("运行浏览器演示后再刷新。")).toBeInTheDocument();
  });
});
