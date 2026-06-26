/**
 * fnv1a —— 32 位 FNV-1a 字符串哈希。
 *
 * 用途：为 dedup 生成稳定指纹。选型理由——纯同步、零依赖、确定性，
 * 不碰 `crypto`（避免又引入一处需要 RuntimePlatform 兜底的全局），
 * 抗碰撞要求不高（只用于「短窗口内同一错误」判同，不是安全场景）。
 *
 * 返回 base36 字符串，紧凑且可读。对同一输入恒定，跨端一致。
 */
export function fnv1a(input: string): string {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // Math.imul 保证 32 位整型乘法（FNV prime 0x01000193），避免精度溢出
    hash = Math.imul(hash, 0x01000193);
  }
  // 无符号化后转 base36
  return (hash >>> 0).toString(36);
}
