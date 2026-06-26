/**
 * INP（Interaction to Next Paint）—— 暂未实现，刻意留空。
 *
 * 原因：INP 不是单点指标，需追踪整个会话内所有交互（pointer/keyboard/click）的
 * 处理时长，剔除离群后取近似 98 分位，并在页面隐藏时定稿。算法复杂度远高于
 * FP/FCP/LCP/CLS，草率实现会得出错误数值，反而误导。
 *
 * 落地时走标准模板：extends BaseIntegration，实现 install()，用 onCleanup 登记解绑、
 * this.emit("performance", toPerformancePayload("INP", value)) 上报（复用 webVitals.ts）。
 * 阈值已在 VITALS_THRESHOLDS.INP 备好（good 200ms / poor 500ms）。
 */
export {};
