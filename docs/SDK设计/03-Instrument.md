埋点注入层  = 监听Error XHR Retch  这只是表象理解 
Instrument = 再不修改业务代码的前提下，对运行时行为进行拦截和观测 

本质是AOP 面向切面编程 
原始流程： before ->   fetch   ->  after 
Instrument： before -> 业务逻辑 ->  after  

思考监控什么？
Error ： 
监听：  window.onerror  window.onunhadledrejection  
捕获：  JS Error     Promise Error      Resource Error 
Network :
History :
DOM ：
Performance :

架构设计问题 ：埋点管理系统 

Instrument Manager
        │
 ┌──────┼──────┐
 │      │      │
Fetch  XHR  History
 │      │      │
 Event Event Event
        │
        ↓
 Event Bus
        ↓
 Integration
        ↓
 Transport


运行时观测层面 
-   不解释 不分析 不上报 
-   只负责让系统看见世界 

observe ( 观察 ) -> Normalize ( 统一事实 )   -> Interpret 解释事实      -> Act  采取行动 
Instrument（ 器械 ） 属于链路的第一层 











