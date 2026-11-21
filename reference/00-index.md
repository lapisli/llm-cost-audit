# 知识库总目录

> 来源：2026-10-22 的 14 路并行调研（每路一个独立子代理，互不共享上下文）。
> 共 15 份资料，408 KB。每个数字都带来源与证据等级标注 —— 这是本知识库唯一值得信任的地方。

## 一、证据等级约定（读之前先看标签）

| 标签 | 含义 | 能否对外引用 |
|---|---|---|
| 官方 | 厂商自己的定价页 / 文档 / 官方博客 | 能，必须注明抓取日期 |
| 论文 | 有 arXiv 或 ACL 编号，可复现 | 能，注明会议与年份 |
| 第三方实测 | 独立第三方的实测数据 | 能，说明是第三方 |
| 厂商宣传 | 厂商自己的效果宣称（例如「省 68%」） | 不能当独立证据，只能当线索 |
| 未核实 | 只拿到标题或二手转述，或抓取失败 | 不能引用，只能写「待核实」 |

## 二、文件清单

| 文件 | 课题 |
|---|---|
| reference/01-waste-matrix.md | 浪费矩阵总表（W1–W18，逐项链接到各篇） |
| reference/02-compression.md | 提示词压缩与上下文工程 |
| reference/03-semantic-cache.md | 语义缓存与 prompt caching 门槛 |
| reference/04-routing.md | 模型路由与级联 |
| reference/05-batch.md | 批处理与异步折扣 |
| reference/06-agent-token.md | Agent 与多智能体 token 规律 |
| reference/07-tooling.md | 计量与成本归因工具链 |
| reference/08-selfhost.md | 自托管 vs API 的 break-even |
| reference/09-price-cn.md | 国内大模型官方定价全表 |
| reference/11-finops-cn.md | 国内云节省计划与 FinOps |
| reference/13-methodology.md | 审计方法论、对账与认证 |

## 三、本轮抓取失败情况（这就是为什么要标未核实）

调研期实测：OpenAI 官方站大面积 HTTP 403（Cloudflare）、Google 文档多次 fetch failed、
Anthropic 文档跨域重定向、豆包/文心/阶跃/零一万物定价页为纯前端渲染或 404、
Upwork/Fiverr 全站 403、BOSS 直聘与拉勾零可读页面。

这些缺口不要用记忆去补。每份资料末尾都有自己的「未核实」清单，写报告时照抄那个清单。

## 四、跨资料的三条最高价值结论

1. 缓存比路由更有效。Manifest 官方博客：路由器跑了 4 个月、覆盖 7000 云用户后自行下线，
   理由之一就是缓存读取便宜 75–90%，比路由更划算。
2. 自托管几乎不划算。H100 上 8B 模型满载输出约 $0.042/M token，但对比 DeepSeek Flash
   空闲价 $0.60/M，盈亏平衡利用率仅约 7%；计入人力后要更低利用率才回本。
3. 国内暂无「AI 成本审计」这个品类。招聘与外包平台零命中，猪八戒的 RAG 商品里明确写
   「大模型 API 调用费由客户自行承担」——说明「帮客户管 API 账单」是空白供给。

## 五、维护

本目录内容随实践更新；发现数字过期请提 issue 并附新来源。
调研更新后重跑该脚本即可；SKILL.md 的源码在 tools/skill-src-SKILL.md。
