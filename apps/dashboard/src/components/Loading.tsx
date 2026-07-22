import { useEffect, useState, type ReactNode } from "react";
import { BrandSignal, type BrandSignalSize } from "./BrandSignal";

export function LogoLoader({ size = "sm" }: { size?: BrandSignalSize }) {
  return <BrandSignal size={size} loading />;
}

export function HomeLoadingState() {
  const [showLogoLoader, setShowLogoLoader] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowLogoLoader(true), 480);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="home-loading-shell">
      <OverviewSkeleton />
      {showLogoLoader ? (
        <div className="home-loading-indicator" aria-hidden="true">
          <LogoLoader size="lg" />
          <strong>正在加载监控首页…</strong>
          <span>网络响应较慢，请稍候</span>
        </div>
      ) : null}
    </div>
  );
}

export function OverviewSkeleton() {
  return (
    <div className="page-stack overview-skeleton" role="status" aria-label="正在加载监控首页">
      <div className="overview-skeleton-header" aria-hidden="true">
        <SkeletonLine width="78px" />
        <span className="skeleton skeleton-title" />
        <SkeletonLine width="min(440px, 68%)" />
      </div>

      <section className="overview-skeleton-health" aria-hidden="true">
        <span className="skeleton overview-skeleton-orb" />
        <div className="overview-skeleton-health-copy">
          <SkeletonLine width="86px" />
          <SkeletonLine width="112px" />
          <SkeletonLine width="min(330px, 78%)" />
        </div>
        <div className="overview-skeleton-health-meta">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index}><SkeletonLine width="54px" /><SkeletonLine width={index === 2 ? "88px" : "42px"} /></div>
          ))}
        </div>
      </section>

      <section className="overview-skeleton-stats" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <article className="overview-skeleton-stat" key={index}>
            <div><span className="skeleton overview-skeleton-dot" /><SkeletonLine width={`${66 + index * 4}px`} /></div>
            <SkeletonLine width={`${72 + (index % 2) * 22}px`} />
            <SkeletonLine width={`${94 + index * 7}px`} />
          </article>
        ))}
      </section>

      <div className="overview-skeleton-content" aria-hidden="true">
        <section className="panel">
          <SkeletonPanelHeading eyebrow="82px" title="118px" action />
          <div className="overview-skeleton-vitals">
            {Array.from({ length: 4 }, (_, index) => (
              <article className="overview-skeleton-vital" key={index}>
                <div><SkeletonLine width="38px" /><span className="skeleton overview-skeleton-pill" /></div>
                <SkeletonLine width={`${74 + (index % 2) * 18}px`} />
                <SkeletonLine width="116px" />
                <span className="skeleton overview-skeleton-rating" />
              </article>
            ))}
          </div>
        </section>
        <section className="panel">
          <SkeletonPanelHeading eyebrow="64px" title="84px" />
          <div className="overview-skeleton-releases">
            {Array.from({ length: 5 }, (_, index) => (
              <div className="overview-skeleton-release" key={index}>
                <div><SkeletonLine width={`${82 + (index % 3) * 16}px`} /><SkeletonLine width="108px" /></div>
                <span className="skeleton overview-skeleton-count" />
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="panel" aria-hidden="true">
        <SkeletonPanelHeading eyebrow="92px" title="84px" action />
        <TableSkeleton columns={4} rows={5} />
      </section>
    </div>
  );
}

function SkeletonPanelHeading({ eyebrow, title, action = false }: { eyebrow: string; title: string; action?: boolean }) {
  return (
    <div className="overview-skeleton-panel-heading">
      <div><SkeletonLine width={eyebrow} /><SkeletonLine width={title} /></div>
      {action ? <SkeletonLine width="62px" /> : null}
    </div>
  );
}

export function LoadingState({ label = "正在读取监控数据…" }: { label?: string }) {
  return (
    <div className="state-box loading" role="status" aria-live="polite">
      <LogoLoader size="md" />
      <span>{label}</span>
    </div>
  );
}

export function ButtonLoadingContent({
  loading,
  loadingLabel,
  children,
}: {
  loading: boolean;
  loadingLabel: string;
  children: ReactNode;
}) {
  return (
    <span className="button-loading-content">
      {loading ? <LogoLoader size="xs" /> : null}
      <span>{loading ? loadingLabel : children}</span>
    </span>
  );
}

export function AsyncPage({
  refreshing,
  error,
  children,
}: {
  refreshing: boolean;
  error?: Error | null;
  children: ReactNode;
}) {
  return (
    <div className={`page-stack async-page${refreshing ? " is-refreshing" : ""}`} aria-busy={refreshing}>
      {refreshing ? (
        <div className="page-refresh-indicator" aria-hidden="true">
          <LogoLoader size="xs" />
          <span>正在更新</span>
        </div>
      ) : null}
      {error ? (
        <div className="background-error" role="status">
          刷新失败，正在显示上次成功获取的数据。
        </div>
      ) : null}
      {children}
    </div>
  );
}

function SkeletonLine({ width = "100%" }: { width?: string }) {
  return <span className="skeleton skeleton-line" style={{ width }} />;
}

export function TableSkeleton({ columns = 5, rows = 6 }: { columns?: number; rows?: number }) {
  return (
    <div className="table-skeleton" aria-hidden="true">
      <div className="table-skeleton-row table-skeleton-head" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: columns }, (_, index) => <SkeletonLine key={index} width={index === 0 ? "64%" : "45%"} />)}
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div className="table-skeleton-row" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }} key={row}>
          {Array.from({ length: columns }, (_, column) => <SkeletonLine key={column} width={column === 0 ? "78%" : `${48 + ((row + column) % 4) * 10}%`} />)}
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="list-skeleton" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div className="list-skeleton-item" key={index}>
          <div><SkeletonLine width={`${58 + (index % 3) * 9}%`} /><SkeletonLine width="38%" /></div>
          <SkeletonLine width="18%" />
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="chart-skeleton" aria-hidden="true">
      <div className="chart-skeleton-y"><SkeletonLine width="54%" /><SkeletonLine width="72%" /><SkeletonLine width="46%" /></div>
      <div className="skeleton chart-skeleton-canvas" />
      <div className="chart-skeleton-legend"><SkeletonLine width="72px" /><SkeletonLine width="92px" /><SkeletonLine width="62px" /></div>
    </div>
  );
}

export function PageSkeleton({ label = "正在加载页面" }: { label?: string } = {}) {
  return (
    <div className="page-stack page-skeleton" role="status" aria-label={label}>
      <div className="page-skeleton-header" aria-hidden="true">
        <SkeletonLine width="86px" />
        <span className="skeleton skeleton-title" />
        <SkeletonLine width="min(520px, 72%)" />
      </div>
      <div className="page-skeleton-stats" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => <div className="skeleton skeleton-card" key={index} />)}
      </div>
      <div className="panel" aria-hidden="true"><TableSkeleton /></div>
    </div>
  );
}

export function ConnectionSkeleton() {
  return (
    <div className="connection-skeleton" role="status" aria-label="正在加载登录页">
      <div className="connection-skeleton-visual" aria-hidden="true" />
      <div className="connection-skeleton-form" aria-hidden="true">
        <span className="skeleton skeleton-title" />
        <SkeletonLine width="58%" />
        <div className="skeleton skeleton-input" />
        <div className="skeleton skeleton-input" />
        <div className="skeleton skeleton-input" />
      </div>
    </div>
  );
}
