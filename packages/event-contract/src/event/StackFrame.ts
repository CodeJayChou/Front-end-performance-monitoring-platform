/**
 * 跨端统一调用栈帧 —— Web(string) / RN(hermes) / Node(V8) 三种原始栈格式
 * 解析后的归一结构。契约只定义**形状**，解析逻辑由各平台 SDK 注入
 * （见 sdk-web 的 parseWebStack），core 不写死任一平台的栈格式。
 *
 * 设计取舍：每一帧都保留 `raw`（原始行），即便解析失败也不丢信息——
 * 既保证可观测性（人读原始栈），又让聚合/去重能消费结构化字段。
 */
export interface StackFrame {
  /** 函数名（解析得到时） */
  functionName?: string;
  /** 源文件 / 脚本 URL */
  file?: string;
  /** 行号 */
  line?: number;
  /** 列号 */
  col?: number;
  /** 原始栈行；解析失败时至少保留它 */
  raw?: string;
}
