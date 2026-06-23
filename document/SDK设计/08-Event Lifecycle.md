事件生命周期 

用户操作
    │
    ▼
异常发生
    │
    ▼
Instrument 捕获
    │
    ▼
构建 Event
    │
    ▼
Context 注入
    │
    ▼
Event Processing
    │
    ▼
Sampling
    │
    ▼
Transport
    │
    ▼
Server
    │
    ▼
存储
    │
    ▼
聚合分析
    │
    ▼
告警/查询/UI展示


第一阶段：Event Birth（ 事件诞生 ）
发生了错误

第二阶段：Capture（捕获）
Instrument 开始工作：现实世界被感知 但是还不能发送因为信息量太少了 

第三阶段：Event Construction（构建事件）
开始走标准Event 生成模型 

{
  "message": "支付失败",
  "stacktrace": [],
  "timestamp": 123456789
}

领域建模 

第四阶段：Context Enrichment（上下文增强）
此时的event 信息仍然不够 ， 所以context 开始注入 

第五阶段：Event Processing
负责判断 进入流水线处理 
数据脱敏 -》 补充标签  -》 标准化 -》丢弃 


第六阶段：Sampling（采样）
对数据继续筛选，收集处最有价值的数据 

第七阶段：Transport

Event
 ↓
Queue
 ↓
Batch
 ↓
Serialize
 ↓
Send

第八阶段：Server Ingestion
服务端会再次
校验
过滤
清洗

第九阶段：Storage
不同类型的事件进入不同的存储 

第十阶段：Aggregation
聚合分析 

第十一阶段：Consumption（消费）
最终展示 

