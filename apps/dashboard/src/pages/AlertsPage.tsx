import { useMemo, useState, type FormEvent } from "react";
import type { AlertRuleType, CreateAlertRule } from "../api/types";
import { FilterSelect } from "../components/FilterSelect";
import { AsyncPage, ButtonLoadingContent, ListSkeleton, TableSkeleton } from "../components/Loading";
import { Badge, EmptyState, ErrorState, formatDate, PageHeader } from "../components/Ui";
import { useDashboard } from "../state/DashboardContext";
import { toApiFilters } from "../state/filters";
import { useApiData } from "../state/useApiData";

interface AlertForm {
  name: string;
  type: AlertRuleType;
  metric: string;
  threshold: string;
  windowMinutes: string;
  consecutivePeriods: string;
  cooldownMinutes: string;
  webhookUrl: string;
}

const initialForm: AlertForm = {
  name: "错误数量过高",
  type: "error_count",
  metric: "LCP",
  threshold: "10",
  windowMinutes: "5",
  consecutivePeriods: "1",
  cooldownMinutes: "15",
  webhookUrl: "",
};

const metrics = ["LCP", "INP", "CLS", "FCP", "FP", "TTFB"];
const metricOptions = metrics.map((value) => ({ value, label: value }));
const ruleTypeOptions = [
  { value: "error_count", label: "错误数量" },
  { value: "performance_p75", label: "性能 P75" },
];

export function AlertsPage() {
  const { client, filters, refreshKey, refresh } = useDashboard();
  const [form, setForm] = useState<AlertForm>(initialForm);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const apiFilters = useMemo(
    () => toApiFilters(filters, new Date(), { limit: 50, offset: 0 }),
    [filters, refreshKey],
  );
  const state = useApiData(async (signal) => {
    if (!client) throw new Error("尚未配置连接");
    const [rules, incidents] = await Promise.all([
      client.alertRules(signal),
      client.alertIncidents(apiFilters, signal),
    ]);
    return { rules, incidents };
  }, [client, apiFilters.from, apiFilters.to, apiFilters.environment, apiFilters.release, apiFilters.platform, refreshKey]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!client) return;
    const input: CreateAlertRule = {
      name: form.name,
      type: form.type,
      ...(form.type === "performance_p75" ? { metric: form.metric } : {}),
      threshold: Number(form.threshold),
      windowMinutes: Number(form.windowMinutes),
      consecutivePeriods: Number(form.consecutivePeriods),
      cooldownMinutes: Number(form.cooldownMinutes),
      webhookUrl: form.webhookUrl || undefined,
      environment: filters.environment || undefined,
      release: filters.release || undefined,
      platform: filters.platform || undefined,
    };
    await mutate("create", () => client.createAlertRule(input));
  };

  const mutate = async (action: string, operation: () => Promise<void>) => {
    setPendingAction(action);
    setMutationError(null);
    try {
      await operation();
      refresh();
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "操作失败");
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <AsyncPage refreshing={state.refreshing} error={state.data ? state.error : null}>
      <PageHeader
        eyebrow="ALERTING"
        title="告警中心"
        description="按完整时间窗口评估错误数量和性能 P75；触发后进入告警态，指标恢复时自动关闭。"
      />
      <div className="content-grid alert-layout">
        <section className="panel">
          <div className="panel-heading"><div><span>NEW RULE</span><h2>创建告警规则</h2></div></div>
          <form className="alert-form" onSubmit={submit}>
            <label className="wide">规则名称<input required maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
            <FilterSelect label="信号类型" value={form.type} options={ruleTypeOptions} variant="field" onChange={(value) => {
              const type = value as AlertRuleType;
              setForm({ ...form, type, name: type === "error_count" ? "错误数量过高" : "LCP P75 过高", threshold: type === "error_count" ? "10" : "2500" });
            }} />
            {form.type === "performance_p75" ? <FilterSelect label="性能指标" value={form.metric} options={metricOptions} variant="field" onChange={(value) => setForm({ ...form, metric: value })} /> : null}
            <label>触发阈值<input required type="number" min="0" step="any" value={form.threshold} onChange={(event) => setForm({ ...form, threshold: event.target.value })} /></label>
            <label>窗口（分钟）<input required type="number" min="1" max="1440" value={form.windowMinutes} onChange={(event) => setForm({ ...form, windowMinutes: event.target.value })} /></label>
            <label>连续窗口<input required type="number" min="1" max="10" value={form.consecutivePeriods} onChange={(event) => setForm({ ...form, consecutivePeriods: event.target.value })} /></label>
            <label>冷却（分钟）<input required type="number" min="1" max="1440" value={form.cooldownMinutes} onChange={(event) => setForm({ ...form, cooldownMinutes: event.target.value })} /></label>
            <label className="wide">Webhook（可选）<input type="url" placeholder="https://example.com/monitor-webhook" value={form.webhookUrl} onChange={(event) => setForm({ ...form, webhookUrl: event.target.value })} /><small>留空时仅在平台内记录告警事件。</small></label>
            <div className="alert-scope wide"><strong>规则范围</strong><span>{scopeLabel(filters.environment, filters.release, filters.platform)}</span></div>
            {mutationError ? <p className="form-error wide" role="alert">{mutationError}</p> : null}
            <button className="primary-button wide" type="submit" disabled={pendingAction !== null} aria-busy={pendingAction === "create"}><ButtonLoadingContent loading={pendingAction === "create"} loadingLabel="正在保存…">创建规则</ButtonLoadingContent></button>
          </form>
        </section>

        <section className="panel">
          <div className="panel-heading"><div><span>RULES</span><h2>当前规则</h2></div></div>
          {state.loading ? <ListSkeleton /> : state.error && !state.data ? <ErrorState error={state.error} onRetry={refresh} /> : state.data?.rules.length ? (
            <div className="alert-rule-list">{state.data.rules.map((rule) => (
              <article className="alert-rule" key={rule.id}>
                <div className="alert-rule-title"><div><strong>{rule.name}</strong><span>{rule.type === "error_count" ? "错误数量" : `${rule.metric} P75`} · {rule.windowMinutes} 分钟窗口</span></div><Badge tone={rule.status === "firing" ? "danger" : rule.enabled ? "good" : "neutral"}>{rule.status === "firing" ? "告警中" : rule.enabled ? "正常" : "已停用"}</Badge></div>
                <div className="alert-rule-meta"><span>阈值 <b>{formatAlertValue(rule.metric, rule.threshold)}</b></span><span>最近值 <b>{rule.lastValue === null ? "—" : formatAlertValue(rule.metric, rule.lastValue)}</b></span><span>连续 <b>{rule.consecutiveBreaches}/{rule.consecutivePeriods}</b></span></div>
                <small>最近评估：{rule.lastEvaluatedAt ? formatDate(rule.lastEvaluatedAt) : "等待首个完整窗口"}</small>
                <div className="alert-actions"><button type="button" disabled={pendingAction !== null} aria-busy={pendingAction === `toggle:${rule.id}`} onClick={() => void mutate(`toggle:${rule.id}`, () => client!.setAlertRuleEnabled(rule.id, !rule.enabled))}><ButtonLoadingContent loading={pendingAction === `toggle:${rule.id}`} loadingLabel="处理中…">{rule.enabled ? "停用" : "启用"}</ButtonLoadingContent></button><button className="danger-action" type="button" disabled={pendingAction !== null} aria-busy={pendingAction === `delete:${rule.id}`} onClick={() => {
                  if (window.confirm(`确定删除规则“${rule.name}”及其告警历史吗？`)) void mutate(`delete:${rule.id}`, () => client!.deleteAlertRule(rule.id));
                }}><ButtonLoadingContent loading={pendingAction === `delete:${rule.id}`} loadingLabel="删除中…">删除</ButtonLoadingContent></button></div>
              </article>
            ))}</div>
          ) : <EmptyState title="还没有告警规则" description="创建第一条规则后，Worker 会从下一个完整时间窗口开始评估。" />}
        </section>
      </div>

      <section className="panel">
        <div className="panel-heading"><div><span>INCIDENTS</span><h2>告警事件</h2></div></div>
        {state.loading ? <TableSkeleton /> : state.error && !state.data ? null : state.data?.incidents.items.length ? <div className="table-wrap"><table><thead><tr><th>规则</th><th>状态</th><th>触发值 / 阈值</th><th>触发时间</th><th>恢复时间</th></tr></thead><tbody>{state.data.incidents.items.map((incident) => <tr key={incident.id}><td><strong>{incident.ruleName}</strong><small>{incident.ruleType === "error_count" ? "错误数量" : `${incident.metric} P75`}</small></td><td><Badge tone={incident.status === "firing" ? "danger" : "good"}>{incident.status === "firing" ? "告警中" : "已恢复"}</Badge></td><td>{formatAlertValue(incident.metric, incident.triggerValue)} / {formatAlertValue(incident.metric, incident.threshold)}</td><td>{formatDate(incident.startedAt)}</td><td>{incident.resolvedAt ? formatDate(incident.resolvedAt) : "—"}</td></tr>)}</tbody></table></div> : <EmptyState title="当前范围内没有告警事件" description="规则达到连续窗口条件后，触发记录会显示在这里。" />}
      </section>
    </AsyncPage>
  );
}

function formatAlertValue(metric: string | null, value: number): string {
  if (!metric) return String(value);
  return metric === "CLS" ? value.toFixed(3) : `${Math.round(value)} ms`;
}

function scopeLabel(environment: string, release: string, platform: string): string {
  const parts = [environment && `环境 ${environment}`, release && `版本 ${release}`, platform && `平台 ${platform}`].filter(Boolean);
  return parts.length ? parts.join(" · ") : "全部环境、版本和平台";
}
