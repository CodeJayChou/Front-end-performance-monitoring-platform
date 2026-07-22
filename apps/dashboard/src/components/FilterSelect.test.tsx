// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FilterSelect } from "./FilterSelect";

const options = [
  { value: "", label: "全部环境" },
  { value: "production", label: "production" },
  { value: "development", label: "development" },
];

afterEach(cleanup);

describe("FilterSelect", () => {
  it("opens a listbox and selects an option", () => {
    const onChange = vi.fn();
    render(<FilterSelect label="环境" value="" options={options} onChange={onChange} />);
    fireEvent.click(screen.getByRole("combobox", { name: "环境：全部环境" }));
    expect(screen.getByRole("listbox", { name: "环境" })).toBeVisible();
    fireEvent.click(screen.getByRole("option", { name: "production" }));
    expect(onChange).toHaveBeenCalledWith("production");
  });

  it("supports arrow and enter keyboard selection", () => {
    const onChange = vi.fn();
    render(<FilterSelect label="环境" value="" options={options} onChange={onChange} />);
    const trigger = screen.getByRole("combobox", { name: "环境：全部环境" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("production");
  });
});
