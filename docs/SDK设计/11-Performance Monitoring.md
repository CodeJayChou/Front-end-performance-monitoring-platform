性能监控体系 
回答一个核心问题 用户为什么觉得慢 ？ 

第一层：页面加载性能（Page Load Performance）
DNS: 10ms
TCP: 20ms
TTFB: 150ms
DOM Ready: 600ms
Load Complete: 1200ms

第二层：Web Vitals
LCP 、 FID / INP 、INP、CLS、

第三层：资源性能（Resource Performance）
JS
CSS
Image
Font
API

第四层：接口性能（API Performance）
95% 请求小于 1800ms。

第五层：Long Task
用户就会感觉卡顿。

第六层：用户体验指标（UX Metrics）
用户打开页面
↓
首次看到内容
首页主要内容出现

点击菜单
↓
页面渲染完成


从平台设计角度看
Performance Monitoring
│
├── Web Vitals
│   ├── LCP
│   ├── INP
│   └── CLS
│
├── Page Load
│   ├── DNS
│   ├── TCP
│   ├── TTFB
│   └── DOM Ready
│
├── Resource
│   ├── JS
│   ├── CSS
│   ├── Image
│   └── Font
│
├── API
│   ├── Slow API
│   ├── Error API
│   └── Percentile
│
├── Long Task
│
└── Custom Metrics