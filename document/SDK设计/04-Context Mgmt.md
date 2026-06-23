-   上下文管理 
-   不就是存一些环境信息吗？ 不全面，背后实际解决的是 如何让一条孤立的数据编程可解释、可关联、可分析的事件

假设SDK 捕获到一个错误
TypeError: Cannot read property 'name' of undefined

如果只是上传这个错误？

{
  "error": "Cannot read property 'name' of undefined"
}

-》以上结构没价值 

根本不知道
·谁发生的
·再哪个页面
·什么操作触发的
·什么版本
·哪个接口刚刚失效了
·用户之前经历了什么


思考这个结构 ：

{
  "error": "Cannot read property 'name' of undefined",
  "userId": "1001",
  "release": "1.2.3",
  "page": "/order",
  "browser": "Chrome 137",
  "network": "4G",
  "traceId": "abc123"
}


思考为什么需要独立 Context Layer  ?
本质是状态中心





