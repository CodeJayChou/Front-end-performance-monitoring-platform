import type { ResourceErrorPayload } from "@monitor/event-contract";

/**
 * Web 平台专属的事件载荷扩展。
 *
 * 契约（event-contract）只承载跨平台核心；web 端的「平台专属字段」在这里通过
 * `extends` 叠加，既保住类型安全（web 必填字段就是必填，而非可选），又让共享契约
 * 不因 web/native/小程序 各自的定位字段而膨胀。其它平台同理在各自 SDK 包扩展。
 */

/**
 * 资源加载错误的 web 扩展：在跨平台核心之上补 DOM 定位与 Resource Timing 派生字段。
 * 由 ResourceErrorIntegration 上报；后端消费 web 细节时引用本类型即可。
 */
export interface WebResourceErrorPayload extends ResourceErrorPayload {
  /** 触发错误的元素标签名（小写，如 "script" / "img" / "link"） */
  tagName: string;
  /** 元素的 CSS 选择器路径（形如 `div#app > img.logo`） */
  domPath: string;
  /** 元素绝对 XPath，与行为采集口径一致 */
  xpath: string;
  /** Resource Timing 对齐后由 pipeline enrich 补入（script/img/css/link…），可选 */
  initiatorType?: string;
}
