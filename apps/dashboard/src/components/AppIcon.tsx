import type { LucideIcon } from "lucide-react";

export type AppIconSize = "xs" | "sm" | "md" | "lg" | "xl";

export function AppIcon({
  icon: Icon,
  size = "md",
  className = "",
}: {
  icon: LucideIcon;
  size?: AppIconSize;
  className?: string;
}) {
  return (
    <Icon
      className={`app-icon app-icon-${size}${className ? ` ${className}` : ""}`}
      strokeWidth={1.8}
      aria-hidden="true"
      focusable="false"
    />
  );
}
