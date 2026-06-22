设计心智模型

思考三个问题：
1）他丢的“是什么东西”？

2）这些东西需不需要“统一背景信息”？
-把“解释权”从业务层上收上来
-把“通用决策”前移到 SDK / 平台层
-标准化、归一化、结构化
-SDK 提供一个“统一语义容器（semantic container）”   

3）系统能不能让业务“少做决定”？
-消除“局部决策污染系统一致性”
-控制认知复杂度的问题

事件
上下文
规则

Public API 真实形态
1   事实入口 Event Entry Points
captureException        捕获异常
captureMessage          捕获消息
caoptureEvent           捕获事件
-   用来说发生了什么

2   状态入口    Context State
setUser                 设置用户
setTag                  设置标签
setContext              设置上下文 
-   用来定义环境背景

3   控制入口    Control hooks
beforeSend              发送前
configureScope          配置范围 

-   本质是 拆成人类认知方式 事实、背景、控制
-   任何监控系统都逃不掉这个三个办法
-   所有SDK 设计都自动收敛成同一个结构 




 