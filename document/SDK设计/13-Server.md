服务端架构总览

Browser SDK
    │
    ▼
API Gateway
    │
    ▼
消息队列(Kafka)
    │
    ├──── Error Pipeline
    │
    ├──── Performance Pipeline
    │
    ├──── Replay Pipeline
    │
    ▼
实时计算
(Flink)
    │
    ▼
存储层
    │
    ├──── ClickHouse
    ├──── Elasticsearch
    ├──── MySQL
    └──── Object Storage
    │
    ▼
查询服务
    │
    ▼
Dashboard

第一层：接入层（Ingestion Layer）
职责 接收SDK上报数据 
这一层关注：
限流
鉴权
数据校验
数据清洗

第二层：消息队列
Kafka：
削峰填谷

缓冲
解耦
重试
顺序消费

第三层：实时计算层
Flink
Spark Streaming

第四层：存储层

MySQL
用户
项目
告警配置
权限

Elasticsearch
秒级搜索

ClickHouse
性能数据
埋点数据
统计数据

Object Storage
OSS
S3
MinIO

第五层：查询层
Frontend
    ↓
Query API
    ↓
ClickHouse

第六层：告警系统
企业微信
邮件
钉钉
飞书

服务端架构最核心的认知模型
采集
 ↓
接收
 ↓
缓冲
 ↓
计算
 ↓
存储
 ↓
查询
 ↓
告警

Collect
 ↓
Ingestion
 ↓
Kafka
 ↓
Compute
 ↓
Storage
 ↓
Query
 ↓
Alert