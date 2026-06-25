/**
 * 行为采集共用的 DOM 工具：把一个元素压缩成可上报的最小定位信息。
 * 只读不改 DOM，纯函数，便于在 Click / Exposure 之间复用与单测。
 */

/**
 * 生成元素的绝对 XPath（带同名兄弟序号），用于唯一定位被点击 / 曝光的节点。
 * 形如 `/html[1]/body[1]/div[2]/button[1]`。
 */
export function getXPath(node: HTMLElement): string {
  const segments: string[] = [];
  let el: HTMLElement | null = node;

  while (el && el.nodeType === 1) {
    let index = 1;
    let sibling = el.previousElementSibling;
    while (sibling) {
      if (sibling.tagName === el.tagName) index++;
      sibling = sibling.previousElementSibling;
    }
    segments.unshift(`${el.tagName.toLowerCase()}[${index}]`);
    el = el.parentElement;
  }

  return "/" + segments.join("/");
}

/** 取元素可读文本（trim 后截断 50 字），作为点击行为的人类可读标签。 */
export function getText(el: HTMLElement): string | undefined {
  const text = el.textContent?.trim();
  return text ? text.slice(0, 50) : undefined;
}
