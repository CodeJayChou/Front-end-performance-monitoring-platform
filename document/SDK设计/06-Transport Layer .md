解决如何把数据可靠的送出去 ？

为什么需要单独  Transport Layer  数据传输层 ？

核心职责：
接收    Receive
缓存    Buffer
发送    Send
重试    Retry

第一层：Receive
不在关心网络，开始解耦

第二层：Buffer
收到事件不立即发送而是 进入缓冲区 

Batch机制
批量处理请求 

Flush机制  
冲洗机制 

Retry机制

Offline Queue
恢复网络 继续上传  


Rate Limiting 速率限制 

Transport Layer真正的架构价值 
可靠事件投递系统 

