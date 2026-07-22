import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown } from "lucide-react";
import { AppIcon } from "./AppIcon";

export interface FilterSelectOption {
  value: string;
  label: string;
}

export function FilterSelect({
  label,
  value,
  options,
  onChange,
  variant = "toolbar",
  className = "",
}: {
  label: string;
  value: string;
  options: readonly FilterSelectOption[];
  onChange: (value: string) => void;
  variant?: "toolbar" | "field" | "standalone";
  className?: string;
}) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const selected = options[selectedIndex] ?? options[0];

  useEffect(() => {
    if (!open) setActiveIndex(selectedIndex);
  }, [open, selectedIndex]);

  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, []);

  const choose = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
  };

  const move = (direction: 1 | -1) => {
    setActiveIndex((current) => (current + direction + options.length) % options.length);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setActiveIndex(selectedIndex);
      } else {
        move(event.key === "ArrowDown" ? 1 : -1);
      }
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      if (!open) return;
      event.preventDefault();
      setActiveIndex(event.key === "Home" ? 0 : options.length - 1);
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && open) {
      event.preventDefault();
      choose(activeIndex);
      return;
    }
    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div className={`filter-select filter-select-${variant}${open ? " is-open" : ""}${className ? ` ${className}` : ""}`} ref={rootRef}>
      {variant === "field" ? <span className="filter-select-field-label">{label}</span> : null}
      <button
        className="filter-select-trigger"
        type="button"
        role="combobox"
        aria-label={`${label}：${selected?.label ?? "未选择"}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-options`}
        aria-activedescendant={open ? `${id}-option-${activeIndex}` : undefined}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleKeyDown}
      >
        {variant !== "field" ? <span>{label}</span> : null}
        <strong>{selected?.label ?? "未选择"}</strong>
        <AppIcon icon={ChevronDown} size="xs" />
      </button>
      {open ? (
        <div className="filter-select-menu" id={`${id}-options`} role="listbox" aria-label={label}>
          {options.map((option, index) => (
            <button
              id={`${id}-option-${index}`}
              className={index === activeIndex ? "is-active" : ""}
              type="button"
              role="option"
              aria-selected={option.value === value}
              tabIndex={-1}
              key={option.value || "all"}
              onClick={() => choose(index)}
              onPointerEnter={() => setActiveIndex(index)}
            >
              <span>{option.label}</span>
              {option.value === value ? <AppIcon icon={Check} size="sm" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
