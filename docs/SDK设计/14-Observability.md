通过数据还原线上真实运行状态，并快速定位问题根因

          Observability
                │
    ┌───────────┼───────────┐
    │           │           │
 Metrics      Logs       Traces
(指标)       (日志)      (链路)


可观测性的三大支柱
1 Metrics（指标）
-   发生了什么？
PV
UV
错误率
白屏率
接口成功率
页面加载时间
FPS
LCP
FID
CLS

2 Logs（日志）
-   具体发生了什么？

3 Traces（链路）
-   

四、前端监控中的可观测性
用户
 ↓
Browser
 ↓
CDN
 ↓
API
 ↓
Backend

                前端监控平台
                       │
 ┌─────────────┬─────────────┬─────────────┐
 │             │             │
 Performance   Replay        Observability
 性能监控      录屏回放       可观测性

 生产级监控平台的完整认知模型
 用户行为
    │
    ▼
SDK采集层
    │
    ├── Error
    ├── Performance
    ├── Behavior
    ├── Network
    └── Replay

    ▼
数据上报层
    │
    ▼
服务端接收
    │
    ▼
消息队列
    │
    ▼
存储系统
    │
    ▼
分析引擎
    │
    ▼
监控平台
    │
 ┌──┼──┐
 │  │  │
错误 性能 Replay
 │  │  │
 └──┼──┘
    ▼
可观测性分析
    ▼
告警
    ▼
问题定位