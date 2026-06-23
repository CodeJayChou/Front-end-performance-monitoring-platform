事件处理 

普通理解 ：
-   SDK -> 上报 -> 服务端 -> 存储 -> 展示 

但是实际上真正复杂的是：
-   SDK -> Event Processing  -> 存储  -> 查询 


思考 Event 是什么 ？   事件 
-   用户点击按钮
-   用户页面奔溃 
-   接口请求失败 
-   页面卡顿 
-   资源加载超时

思考 为什么需要 Event Processing ?
-   垃圾数据爆炸 ？
-   无法分析 


事件处理的核心目标就是将原始事件  -》  转换成  -》  可分析事件

本质是什么  ?
Raw Event       原始事件
      ↓
Normalize       
      ↓
Enrich
      ↓
Filter
      ↓
Grouping
      ↓
Aggregate
      ↓
Store


Normalize:      标准化
各种浏览器或者说外部世界的输入标准格式不统一    小的架构设计 输入混乱 -内部统一 -输出自由 

Enrichment :    增强 
核心功能类似于 统一背景

Filter      :   过滤 
很多事件没有价值 
广告脚本报错
浏览器插件报错
爬虫产生错误
测试环境错误

有效信号 / 噪音 
提高有效设计，降低噪音的存在 

Grouping ：      分组 


Aggregation ：   聚合

把混乱的数据转化成可决策的信息 






