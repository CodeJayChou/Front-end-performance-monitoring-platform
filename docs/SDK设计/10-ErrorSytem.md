构建故障认知系统 

第一层 Error 
浏览器的原始错误  

第二层 Event
转换为 
{
  type: "error",
  message: "...",
  stack: "...",
  url: "...",
  user: "...",
  release: "1.2.3"
}

第三层 Issue
平台会主动聚合数据 

第四层 Incident

报警
通知
升级
响应

Error体系整体架构
Capture
 ↓
Normalize
 ↓
Enrich
 ↓
Group
 ↓
Sample
 ↓
Transport
 ↓
Store
 ↓
Analyze
 ↓
Alert

Monitoring SDK

├── Foundation          ✅
│   ├── API
│   ├── Instrument
│   ├── Context
│   ├── Event Processing
│   ├── Transport
│   ├── Orchestration
│   ├── Runtime
│   └── Collaboration
│
├── Error Monitoring    ← 当前
│   ├── Capture         ✅
│   ├── Normalize       ✅
│   ├── Enrich          ✅
│   ├── Breadcrumb      ✅
│   ├── Grouping        ✅
│   ├── Source Map      ← 下一节
│   ├── Stack Parser
│   ├── Symbolication
│   ├── Fingerprint
│   ├── Issue Engine
│   └── Alert Engine
│
├── Performance Monitoring
├── Session Replay
└── Backend Platform

Source Map → Stack Parser → Symbolication 第二层细化结构 

压缩代码
↓
错误发生
↓
收集堆栈
↓
恢复源码位置
↓
展示给开发者

第一层：Stack Parser

文本
↓
结构化数据

第二层：Source Map

压缩坐标
↓
源码坐标

所以构建工具生成：source-map  记录 原始位置-最终位置 

第三层：Symbolication 符号化

Stack Frame
↓
app.js:1:23456
↓
查 Source Map
↓
src/user/index.ts:45:12
↓
恢复函数名
↓
恢复源码上下文

-   最终展示 
TypeError

handleUserInfo
src/user/index.ts:45:12


Issue Engine

第一层：Issue State

第二层：Regression

第三层：Release Association

第四层：Impact Analysis

第五层：Issue Ownership

Alert Engine
谁应该知道这个问题？什么时候知道？以什么方式知道？

第一层：Alert Rule

第二层：Threshold

第三层：Alert Fatigue

第四层：Alert Grouping

第五层：Alert Routing

第六层：Escalation