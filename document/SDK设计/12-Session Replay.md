Replay 体系（ Session Replay ）

用户到底是怎么操作的？
把用户操作过程录像

第一层：录制
DOM快照
DOM增删改
鼠标移动
点击
输入
滚动
窗口变化

第二层：事件流
event1
event2
event3
...
event10000

第三层：压缩
批量发送
gzip
事件压缩
增量快照

第四层：存储
replay_event

session_id
event_data
timestamp

第五层：回放
用户打开页面
↓
点击按钮
↓
出现错误
↓
刷新页面
↓
离开

Replay体系的核心难点 数据脱敏 

