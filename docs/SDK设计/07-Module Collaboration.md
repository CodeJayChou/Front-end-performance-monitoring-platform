模块协作
监控系统本质上不是模块集合，而是数据流动系统 

关注组件之间怎么协作的问题 ？

一个Error 从产生到进入数据库，中间经历了什么？
系统等于 =  数据流 + 决策流 

第一阶段 Instrument 发现事件，只负责观察 
|  职责发现世界发生了什么？
捕获 JS 
|   TypeError 
得到
{
  message: "xxx",
  stack: "..."
} 

Instrument 职责完成 

第二阶段  -》 Orchestrator  编排
建立统一事件模型，转换成统一的结构 

{
  eventId,
  timestamp,
  eventType,
  payload
}

第三阶段：Context注入
开始补全背景 

{
  userId: 123,
  release: "1.0.1",
  route: "/home",
  browser: "Chrome"
}

Error + Context 


第四阶段：Event Processing
处理事件  
过滤 -》 脱敏 -》 移除  -》采样  -》事件增强  


第五阶段：Transport
送出去 

┌──────────────┐
│ Instrument   │
└──────┬───────┘
       │
       ▼

┌──────────────┐
│ Orchestrator │
└──────┬───────┘
       │
       ▼

┌──────────────┐
│ Context      │
└──────┬───────┘
       │
       ▼

┌──────────────┐
│ Processor    │
└──────┬───────┘
       │
       ▼

┌──────────────┐
│ Transport    │
└──────┬───────┘
       │
       ▼

    Backend

模块协作 = 职责传递 

