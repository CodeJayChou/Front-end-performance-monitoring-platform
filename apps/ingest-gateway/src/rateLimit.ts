interface WindowCounter {
  start: number;
  count: number;
}

/** MVP 单实例固定窗口限流；后续多实例部署时替换为共享存储实现。 */
export class InMemoryRateLimiter {
  private readonly counters = new Map<string, WindowCounter>();

  constructor(
    private readonly limit: number,
    private readonly windowMs = 60_000,
  ) {}

  allow(key: string, now = Date.now()): boolean {
    const current = this.counters.get(key);
    if (!current || now - current.start >= this.windowMs) {
      this.counters.set(key, { start: now, count: 1 });
      this.cleanup(now);
      return true;
    }
    current.count += 1;
    return current.count <= this.limit;
  }

  private cleanup(now: number): void {
    if (this.counters.size < 10_000) return;
    for (const [key, value] of this.counters) {
      if (now - value.start >= this.windowMs) this.counters.delete(key);
    }
  }
}
