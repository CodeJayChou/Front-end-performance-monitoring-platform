export type BrandSignalSize = "xs" | "sm" | "md" | "lg";

export function BrandSignal({
  size = "lg",
  loading = false,
}: {
  size?: BrandSignalSize;
  loading?: boolean;
}) {
  return (
    <span
      className={`brand-signal brand-signal-${size}${loading ? " brand-signal-loading" : ""}`}
      aria-hidden="true"
    >
      <span />
    </span>
  );
}
