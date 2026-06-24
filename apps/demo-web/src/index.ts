import { initWebSDK } from "@monitor/sdk-web";

// 最终用户视角：一行初始化，按需配置 beforeSend
const client = initWebSDK({
  beforeSend(event) {
    // 这里可做：过滤敏感数据 / 采样 / 返回 null 丢弃事件
    return event;
  },
});

console.log("[demo] SDK initialized", client.platform);

// 触发一个未捕获错误，验证整条链路（浏览器中会被 GlobalError 插件捕获）
throw new Error("test error");
