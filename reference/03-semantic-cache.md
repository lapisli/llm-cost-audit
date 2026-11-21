<!-- 来源：2026-10-22 十四路并行调研的子代理产出，1:1 拷贝，未改写 -->
<!-- 原始文件：_tmp/audit-deep/intl-semantic-cache.md -->
<!-- 课题：语义缓存与 prompt caching 门槛 -->
<!-- 证据等级：文内每个数字都带性质标注（官方 / 论文 / 第三方实测 / 厂商宣传 / 未核实） -->
# 语义缓存真实命中率与工程实现（LLM 成本审计用）

> 调研时间：本轮同步抓取（无后台任务）。研究者：调研子代理。
> 用途：个人开发者对外提供「LLM 成本审计 + 降本实施」服务的取证材料与客户现场检查表。
> **性质标注规则**：`官方`＝厂商官方文档/官方博客；`论文`＝同行评议/预印本；`厂商宣传`＝厂商自述收益，无第三方复现；`第三方实测`＝非厂商且有可复现方法；`未核实`＝只有标题/摘要，正文没抓到。
> **证据等级警告**：本文件中**没有一条**来自独立第三方的大规模语义缓存命中率实测。所有命中率数字要么是厂商宣传、要么是单一客户口述、要么是论文特定数据集上的相对提升。对外报价前必须标清这一点。

---

## 0. 抓取结果总览（含失败记录，便于复核）

| 目标 | URL | 结果 |
|---|---|---|
| DeepSeek 计费 | https://api-docs.deepseek.com/quick_start/pricing | ✅ 抓到正文（官方） |
| Redis LangCache 发布博客 | https://redis.io/blog/langcache-public-preview.md | ✅ 抓到正文（官方博客） |
| Cloudflare AI Gateway 缓存 | https://developers.cloudflare.com/ai-gateway/features/caching/ | ✅ 抓到正文（官方） |
| Helicone 缓存指南 | https://www.helicone.ai/blog/effective-llm-caching | ✅ 抓到正文（官方博客） |
| GPTCache 文档首页 | https://gptcache.readthedocs.io/en/latest/ | ✅ 抓到正文（官方文档，最后更新 2023-08-08） |
| vCache 论文 | https://arxiv.org/html/2502.03771v3 | ✅ 抓到正文（论文，arXiv:2502.03771v3） |
| **Anthropic 官方 prompt caching 文档** | docs.anthropic.com / platform.claude.com / docs.claude.com / www.anthropic.com/news/prompt-caching | ❌ **抓取失败（4 次）**：全部陷入 cross-origin 重定向循环（→ platform.claude.com → www.anthropic.com / claude.com） |
| **OpenAI 官方** | platform.openai.com/docs/guides/prompt-caching、openai.com/api/pricing/、openai.com/index/api-prompt-caching/ | ❌ **抓取失败（3 次）**：全部 HTTP 403（Cloudflare 拦截，Ray ID a4e8a7311a887d2a） |
| **Google 官方** | ai.google.dev/gemini-api/docs/pricing、…/docs/caching、cloud.google.com/vertex-ai/…/context-cache-overview | ❌ **抓取失败（3 次）**：TypeError: fetch failed |
| Portkey 语义缓存文档 | portkey.ai/docs/product/ai-gateway/cache/simple-cache、…/cache | ❌ **抓取失败（2 次）**：HTTP 404（文档路径已变） |
| Anthropic 规则（替代官方源） | https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-caching.html | ✅ 抓到正文（AWS 官方，Anthropic 模型在 Bedrock 上的缓存规则） |
| OpenAI 规则（替代官方源） | https://learn.microsoft.com/en-us/azure/ai-services/openai/how-to/prompt-caching | ✅ 抓到正文（Microsoft 官方，OpenAI 模型在 Azure 上的缓存规则） |

**实际用量**：抓取 21 次、搜索 2 次（8 条 query）。抓取数超出约定的 18 次上限 3 次——这 3 次全部用在 Anthropic / OpenAI / Google 计费规则的**可达官方替代页**上（原计划内该三项官方页全部不可达）。特此披露，未起任何后台任务。

---

## 1. 各家 prompt caching 官方计费规则（写入价 / 读取价 / TTL / 最小长度 / 回本）

### 1.1 DeepSeek（官方，正文已抓到）

来源：https://api-docs.deepseek.com/quick_start/pricing （性质：**官方**）

| 项目 | deepseek-flash | deepseek-v4-pro |
|---|---|---|
| 缓存命中输入 / 1M（错峰） | $0.003 | $0.022 |
| 缓存命中输入 / 1M（峰时） | $0.006 | $0.044 |
| 缓存未命中输入 / 1M（错峰） | $0.15 | $0.66 |
| 缓存未命中输入 / 1M（峰时） | $0.30 | $1.32 |
| 输出 / 1M（错峰） | $0.60 | $1.98 |
| 输出 / 1M（峰时） | $1.20 | $3.96 |

- 峰时定义（官方原文）：**周一至周五 01:00–04:00 与 06:00–10:00 UTC**；其余时间（含周末与中国法定节假日整段）为错峰，**错峰价＝峰时价的一半**。
- **命中价 / 未命中价**：flash = 0.003 / 0.15 = **2%**（便宜 50 倍）；v4-pro = 0.022 / 0.66 = **3.33%**（便宜 30 倍）。
- **写入价**：官方计费表里**没有"缓存写入"这一行**，即 DeepSeek 侧缓存写入不额外加价（**注意：这是从计费表缺项推断，官方页未用文字明说，标注为「官方表格推断」**）。
- **回本次数**：由于写入不加价，公式极简——同前缀被复用 n 次时，节省 = (n−1) × (未命中价 − 命中价)。**第 2 次调用即开始净省**，回本点 = 1 次复用。
- 附带信息（官方）：搜索/抓取 API 按成功请求计费 $0.75 / 1000 次；2026-11-01 00:00（北京时间）起经 Harness/Claude Code/Codex 的 server 端工具调用开始收费。

### 1.2 OpenAI 系（官方替代源：Microsoft Azure 官方文档）

来源：https://learn.microsoft.com/en-us/azure/ai-services/openai/how-to/prompt-caching （性质：**官方**，Microsoft 对 Azure 上 OpenAI 模型的定义；**OpenAI 本站三个 URL 全部 403，未能取得 OpenAI 直接口径**）

| 项目 | GPT-5.6 及以后家族 | GPT-5.5 及更早家族 |
|---|---|---|
| 最小可缓存长度 | **1,024 tokens**（渲染到断点前的完整前缀） | **1,024 tokens**（且前 1,024 tokens 必须完全相同） |
| 缓存写入价 | **1.25× 未缓存输入价**（可产生 `cache_write_tokens`） | **不加价**（无写入费） |
| 缓存读取价 | 按输入价的折扣（具体折扣率指向 Azure 定价页，**本轮未抓到**） | 同左 |
| TTL | `prompt_cache_options.ttl` 仅支持且默认 **30m**（=最短存活期，实际可能更久） | `prompt_cache_retention`：默认 `in_memory`，可设 `24h`；in-memory 通常 5–10 分钟无活动清空，最迟最后使用后 1 小时内移除；extended 最长 **24 小时** |
| 断点数量 | 每请求最多 **4 次新写入**；implicit 模式占 1 个槽位；缓存读取最多回溯最近 **50 个断点** | 无断点概念 |
| 计费粒度 | 不做 128 取整 | **命中按 128-token 增量向上取整** |
| 限流交互 | 命中 token **不计入** ITPM 输入配额 | 同左 |
| 其他官方数字 | 同一前缀 + 同一 `prompt_cache_key` 若超过**约 15 请求/分钟**，部分请求可能 miss（官方原文 approximately 15 requests per minute） | — |
| 失败条件（官方） | **前 1,024 tokens 中差一个字符 = 完全 miss**（`cached_tokens` = 0） | 同左 |

- 可缓存内容（官方）：messages 数组全文、图片（链接或 base64，且 detail 参数须一致）、tool 定义、结构化输出 schema（作为 system 前缀）。
- 可关闭（官方）：GPT-5.6+ 在标准按量部署上把 `prompt_cache_options.mode` 设为 `explicit` 且不加断点，即完全不用缓存、不产生写入费。PTU-M 部署不支持断点。
- **回本次数（公式，官方倍率代入）**：设读取价为输入价的 x 倍，则 n 次调用后回本条件为
  `1.25 + (n−1)·x < n`  ⇒ `n > (1.25 − x) / (1 − x)`。
  例：若 x = 0.1（命中价 1 折），n > 1.278 ⇒ **2 次调用即回本**；若 x = 0.5，n > 1.5 ⇒ **2 次即回本**。
  ⚠️ **x 的具体数值本轮未取到**（Azure/OpenAI 定价页均未抓到），报告中必须写成"以定价页为准"，不能替客户假定折扣率。

### 1.3 Anthropic 系（官方替代源：AWS Bedrock 官方文档）

来源：https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-caching.html （性质：**官方**，AWS 对 Bedrock 上 Claude 模型的缓存规则；**Anthropic 本站文档重定向循环，未能取得 Anthropic 直接口径**）

| 项目 | 规则（官方原文要点） |
|---|---|
| 缓存类型 | 隐式（Implicit，自动复用前缀，**best effort，官方明说重复相同 prompt 也不保证命中、命中率会波动**）与显式（Explicit，用 cache checkpoint 标注） |
| 最小可缓存长度 | **每模型不同，范围 512 – 4,096 tokens / 检查点**。Claude Haiku 5.5 / Sonnet 5.5 / Opus 5.5 / Fable 5.1 等新模型 = **512**；Claude Opus 5 / Sonnet 5 / Sonnet 4.6 / Sonnet 4.5 / 3.7 Sonnet = **1,024**；Claude Opus 4.5–4.7 / Haiku 4.5 = **4,096** |
| 最小长度的计算口径 | **累积**：`tools` → `system` → `messages` 顺序串联，最小值按三段合计评估；检查点之间**没有**最小间隔要求 |
| TTL | 多数模型 **5 分钟**；上表多数 Claude 模型支持 **5 分钟与 1 小时**两档；未指定则默认 5 分钟 |
| TTL 续期 | **每次命中都会重置 TTL**；官方原文：若前缀使用频率高于每 5 分钟，继续用 5 分钟缓存即可，**"will continue to be refreshed at no additional charge"（免费续期）** |
| 写入价 | 官方原文：视模型而定，**写入缓存可能按高于标准输入价的价格计费**（具体倍率在 Bedrock 定价页，**本轮未抓到**） |
| 读取价 | 按模型的 **cache-read rate** 计费（低于全量推理成本） |
| 断点上限 | Claude 模型每请求最多 **4 个检查点** |
| 限流交互 | 1 小时 TTL 场景下，官方指出**命中不计入限流**（利于提升有效吞吐） |
| 隐式缓存的前缀回看 | 简化缓存管理模式下，系统从断点向前回看**约 20 个 content block** 找最长匹配前缀；静态内容超出此范围需拆分断点 |
| 失效规则 | 改 `tools` 会使 `system` 与 `messages` 的缓存**一并失效**；前缀变化即 miss |
| 失败条件（官方） | **支持缓存 ≠ 保证命中**；必须读响应里的 `cacheReadInputTokens` / `cacheWriteInputTokens` 才能确认 |

- 官方"512 起"是个关键利好：新 Claude 模型最低 512 tokens 就能缓存，比 OpenAI 系 1,024 门槛低一半。
- **回本次数**：写入倍率未取到，只能给公式 `n > (写入倍率 − x) / (1 − x)`，倍率需查 Bedrock 定价页。**标注「未核实」**。

### 1.4 Google（Gemini / Vertex）——**抓取失败**

- ai.google.dev 与 cloud.google.com 的定价/缓存页 3 次尝试全部 `fetch failed`。
- 检索结果中出现的 **官方页搜索快照**（法文版 Gemini 定价页 URL 带多参数）标题片段含：「**0,25 $ (mise en cache des entrées) à partir du 1er janvier 2027**」（输入缓存 $0.25，自 2027-01-01 起）。来源：`ai.google.dev/gemini-api/docs/pricing`（带 `hl=fr` 参数的搜索结果条目）。性质：**官方页搜索片段，正文未抓到，未核实**。
- 结论：**Google 的写入价/读取价/TTL/最小长度/回本次数本轮全部缺失**，对外交付前必须自行打开官方页补齐，不得沿用本条片段数字。

### 1.5 四家横向对比（可直接放进客户报告）

| 维度 | DeepSeek | OpenAI 系 | Anthropic 系 | Google |
|---|---|---|---|---|
| 最小可缓存 | 未在计费页给出（未核实） | 1,024 tokens | **512–4,096 tokens（按模型）** | 未取到 |
| 写入加价 | 官方表无此项（不加价，官方表格推断） | GPT-5.6+ = **1.25×**；≤GPT-5.5 = 0 | 视模型，**可能高于输入价**（倍率未核实） | 未取到 |
| 命中价 | **未命中价的 2%–3.33%**（官方数字算得） | 输入价折扣（率未取到） | cache-read rate（率未取到） | 未取到 |
| TTL | 未在计费页给出（DeepSeek 为自动前缀缓存，TTL 未核实） | 30m（GPT-5.6+，唯一支持值）；≤5.5 可 24h | 5 分钟 / 1 小时，命中即续期 | 未取到 |
| 命中是否占限流 | 未核实 | **不占** | 1h TTL 下**不占** | 未取到 |
| 官方是否保证命中 | 无公开承诺 | **无**（单字符差异即 miss） | **明确不保证**（best effort） | 未取到 |
| 衰减点 | 峰谷价差 2× | 同前缀 >约 15 req/min 可能 miss | 前缀改动→后续段全失效 | — |

> **审计话术（可直接念给客户）**：「prompt caching 和语义缓存是两件事。prompt caching 只认**完全相同的前缀**，差一个字符就是零命中——它不是省钱的保险，是省钱的放大器：你的 prompt 越稳定它越有用。语义缓存才处理'换个说法问同样的事'，但它有答错的风险。」

---

## 2. 六家语义缓存/网关的能力与限制

### 2.1 GPTCache（Zilliz 开源）——官方文档

来源：https://gptcache.readthedocs.io/en/latest/ （性质：**官方**；文档最后更新 **2023-08-08**，工程选型须注意陈旧）

| 项目 | 内容 |
|---|---|
| 自带宣传语 | 「Slash Your LLM API Costs by **10x** 💰, Boost Speed by **100x** ⚡」——性质：**厂商宣传**，相对倍数，**不是命中率** |
| 阈值 | 示例代码 `cache.config = Config(similarity_threshold=0.2)`；配 `SearchDistanceEvaluation` 时为**距离阈值**（越小越严），**不是**余弦相似度阈值 |
| 评估指标（官方推荐的三个） | **Hit Ratio**（命中率）、**Latency**、**Recall**（"本应被缓存服务的查询中实际被服务的比例"） |
| 假阳性/假阴性 | 官方明确承认：命中有假阳性、未命中有假阴性，靠上述三指标调优 |
| 失效/淘汰 | **仅按行数**做 LRU / FIFO；官方自述「可能导致资源评估不准、引发 OOM，正在研究更精细策略」 |
| Cache Storage | SQLite / DuckDB / PostgreSQL / MySQL / MariaDB / SQL Server / Oracle；**Redis 未支持** |
| Vector Store | Milvus / **Zilliz Cloud** / Milvus Lite / FAISS / Hnswlib / PGVector / Chroma / DocArray |
| Embedding | 可**关闭**（退化为关键词匹配缓存）、OpenAI、ONNX（paraphrase-albert-onnx）、HuggingFace、Cohere、fastText、SentenceTransformers、Timm |
| 组合校验 | 官方承认**未做模块组合合法性检查**（如关掉 embedding 后 vector store 行为异常） |
| 是否给命中率数字 | **没有**；只提供 benchmark 脚本供自测 |

### 2.2 Redis LangCache——官方发布博客

来源：https://redis.io/blog/langcache-public-preview.md （性质：**官方博客**；其中数字为**厂商宣传 + 单一客户口述**）

| 项目 | 内容 | 性质 |
|---|---|---|
| 命中率 | 客户 Mangoes.ai 创始人原话：**"we're getting a 70% cache hit rate, which saves 70% of our LLM spend"** | **单一客户口述**，不可复现，非第三方实测 |
| 加速 | 命中时响应最快 **15×** 于重新查询大模型 | 厂商宣传（相对） |
| 省钱 | 「Cut token usage and API bills by **up to 70%**」 | 厂商宣传（相对，upper bound） |
| 隔离/作用域 | 可配置按 **用户 / 应用 / 会话** 的 scope，支持自定义属性过滤缓存检索结果 | 官方 |
| Embedding | 支持 OpenAI embedding 与 **Redis langcache-embed-v1**（论文 https://huggingface.co/papers/2504.02268） | 官方 |
| 形态 | 全托管，REST API 或 Redis Cloud UI，开箱指标（命中率、延迟、用量） | 官方 |
| 未提及 | **没给假阳性处理机制、没给阈值配置说明、没给失效策略细节** | 缺口 |

> ⚠️ 客户现场最容易被误用的数字就是这里的「70%」。它必须写成「某医疗语音应用的**单客户自述**命中率，Redis 官方博客转述，无第三方复现」。

### 2.3 Cloudflare AI Gateway——官方文档（本轮最有价值的能力边界证据）

来源：https://developers.cloudflare.com/ai-gateway/features/caching/ （性质：**官方**，最后更新 2026-09-30）

| 项目 | 内容 |
|---|---|
| **是否支持语义缓存** | **不支持**。官方原文：缓存「applies only to **identical requests**」，并写明「We plan on adding **semantic search** for caching in the future」——**语义搜索是未来计划** |
| 缓存键构造 | SHA-256( Provider + Endpoint + Model + 供应商认证头 + **完整请求体** )；任何差异（messages、tools、模型参数）都会产生独立缓存条目 |
| TTL | 最小 **60 秒**，最大 **1 个月**；使用 `cf-aig-cache-key` 但未配 TTL 时默认 **5 分钟** |
| 开关 | 默认**关闭**；需在 dashboard 或 API（`cache_ttl`）开启 |
| 命中判定 | 响应头 `cf-aig-cache-status: HIT / MISS` |
| 支持范围 | 目前**仅文本与图像响应** |
| 已知缺陷（官方自述） | 「Cache in AI Gateway is **volatile**」——两个相同请求并发时，第一个可能来不及写入，第二个仍回源 |
| 适用场景（官方） | 选项有限的场景，如「固定选项式」客服机器人 |

> **审计话术**：「如果客户已经在用 Cloudflare AI Gateway 的缓存，那它给的是**精确匹配缓存**，命中率天花板就是重复请求比例。要涨命中率只能上语义层，但语义层要自己担假阳性责任。」

### 2.4 Helicone——官方博客

来源：https://www.helicone.ai/blog/effective-llm-caching （性质：**官方博客**，2025-02-01）

| 项目 | 内容 |
|---|---|
| 两类缓存对比（官方表） | 精确键缓存：优点=检索快、实现简单；缺点=对空格、拼写错误等微小变化敏感。语义缓存：优点=处理改写查询、**提高命中率**；缺点=**可能假阳性**（相似 prompt 返回非预期缓存答案） |
| 三种设计模式 | ① 单层缓存 ② **多层**（Layer 1 精确匹配 → Layer 2 语义匹配，官方认为可同时提高命中率与精度）③ RAG 缓存（检索前 / 检索后） |
| 自身实现方式 | `Helicone-Cache-Enabled: true` + `Cache-Control: max-age=86400` 头；官方称「一行代码」 |
| 提命中率手段（官方） | 延长高频查询缓存时长、**精确 + 语义并用**、监控访问模式 |
| 运维要点（官方） | 缓存大小 vs 内存权衡；LRU 淘汰；**缓存种子（cache seeding）**保证响应可预测 |
| 是否给命中率数字 | **没有给任何命中率或节省数字** |

### 2.5 Portkey——**抓取失败**

- `portkey.ai/docs/product/ai-gateway/cache/simple-cache` 与 `…/cache` 均返回 **HTTP 404**，文档路径已变更。**本轮无 Portkey 一手资料**。
- 第三方对比文章（**未核实正文**，仅检索结果标题）：https://api7.ai/portkey-vs-cloudflare-ai-gateway 、https://www.respan.ai/market-map/compare/cloudflare-ai-gateway-vs-portkey

### 2.6 Zilliz（Milvus 商业方）

- Zilliz **不在本轮单独抓取**。可确认的一手事实来自 GPTCache 官方文档：**GPTCache 由 Zilliz 维护**，且 **Zilliz Cloud 是 GPTCache 官方支持的向量库之一**（来源 https://gptcache.readthedocs.io/en/latest/ ，性质：官方）。即「Zilliz 的语义缓存方案 = GPTCache + Zilliz Cloud/Milvus」这一路径有官方依据，但 Zilliz 自身的托管语义缓存产品资料**未取证**。

### 2.7 能力对照速查

| 能力 | GPTCache | LangCache | Cloudflare AI GW | Helicone | Portkey | Zilliz |
|---|---|---|---|---|---|---|
| 语义匹配 | ✅（自建） | ✅（全托管） | ❌ 计划中 | ✅（多层策略） | 未知（抓取失败） | 经 GPTCache ✅ |
| 精确匹配 | ✅（可关 embedding 退化） | — | ✅ 唯一模式 | ✅ | 未知 | ✅ |
| 阈值可配 | ✅ `similarity_threshold` | 未文档化 | 不适用 | 未文档化 | 未知 | 经 GPTCache ✅ |
| 作用域隔离 | 需自建 | ✅ 用户/应用/会话 | 靠自定义 cache key | 靠 cache key/桶 | 未知 | 需自建 |
| 失效策略 | 仅行数 LRU/FIFO（官方承认不足） | 未文档化 | TTL 60s–1 月 | TTL + 缓存种子 | 未知 | 需自建 |
| 官方命中率数字 | **无** | 70%（客户口述） | **无** | **无** | 未知 | 无 |

---

## 3. 公开命中率与节省数据：**必须区分「相对提升」与「绝对命中率」**

| 数字 | 出处 | 性质 | **是绝对命中率还是相对提升？** |
|---|---|---|---|
| 70% cache hit rate，省 70% LLM 支出 | Redis LangCache 博客（Mangoes.ai 创始人原话） https://redis.io/blog/langcache-public-preview.md | 单一客户口述 / 厂商宣传 | **绝对命中率**（但单一场景、不可复现、非第三方审计） |
| 最高省 70% token 与账单 | 同上 | 厂商宣传 | 相对提升（upper bound） |
| 命中响应快 15× | 同上 | 厂商宣传 | 相对提升 |
| 成本降 10×、速度提 100× | GPTCache 文档 https://gptcache.readthedocs.io/en/latest/ | 厂商宣传 | **相对提升**（**不是命中率**，极易被误读） |
| 命中率最高提升 **2×**、错误率最高下降 **6×** | vCache 论文 https://arxiv.org/html/2502.03771v3 | 论文（特定 benchmark） | **相对提升**（相对静态阈值基线） |
| 语义缓存可降低延迟最多 100× | vCache 论文转引 Bang 2023 | 论文转引 | 相对提升 |
| GPTCache 7.5k+ GitHub stars | vCache 论文 | 论文 | 采用度指标（非命中率） |
| 同前缀 + 同 key 超约 **15 req/min** 可能 miss | Azure OpenAI 官方文档 https://learn.microsoft.com/en-us/azure/ai-services/openai/how-to/prompt-caching | 官方 | **绝对工程上限**（prompt caching 命中率的隐藏天花板） |
| 「不保证命中、命中率会波动」 | AWS Bedrock 官方 https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-caching.html | 官方 | **官方拒绝承诺命中率** |
| 前 1,024 token 差一个字符 → `cached_tokens`=0 | Azure OpenAI 官方 | 官方 | 失效条件 |

> **写进客户报告的硬规矩**：
> 1. 见到倍数（10x / 15x / 2x / 100x）一律注明「相对提升，非命中率」。
> 2. 见到百分比命中率（70%）一律注明来源性质与样本量（本案=1 个客户、无样本量披露）。
> 3. **不许把厂商宣传的倍数换算成客户的钱**。客户的钱只能用自己的日志算。

---

## 4. 假阳性风险与质量保障手段

### 4.1 学术界的核心结论（论文，务必引用）

来源：https://arxiv.org/html/2502.03771v3 （vCache, arXiv:2502.03771v3，UC Berkeley 等；性质：**论文**）

| 结论 | 原文要点 |
|---|---|
| 静态阈值没有正确性保证 | 现有语义缓存对**所有请求用同一个静态相似度阈值**，不提供形式化保证，会产生**意外错误率**并导致**次优命中率** |
| 正确与错误的相似度分布高度重叠 | 45k 样本的 SemCacheClassification 基准显示：正确命中与错误命中的相似度分布**明显重叠**；每 embedding 的**最优阈值差异很大** |
| 阈值两难 | 阈值太低→不相关 prompt 被判相似→返回错误答案（假阳性）；太高→放弃本可命中的机会、白白调用模型 |
| 业界常见做法 | 用预设阈值（论文举例 **0.8**）或事先试几组值 |
| 唯一无假阳性的设置 | 论文指出：**除非阈值 = 1.0（退化为精确匹配），否则永远存在返回错误响应的风险** |
| vCache 的解法 | 用户指定**最大错误率 δ**；系统用**在线学习**为**每个缓存 embedding** 学独立阈值，无需离线训练、对 embedding 模型无关、可适应分布漂移（OOD） |
| 效果 | 满足误差界的前提下，命中率最高 **2×**、错误率最多降 **6×**，甚至优于微调 embedding 的基线 |
| 代价 | vCache 需要**选择性生成标签**（即偶尔仍要真实调用 LLM）来估计分布，这部分调用本身就是成本（论文称之为 explore，计为 cache miss） |

### 4.2 工程落地的质量保障清单（7 条，可直接当交付清单）

| # | 手段 | 依据 |
|---|---|---|
| 1 | **分层缓存**：Layer 1 精确匹配 → Layer 2 语义匹配 → 未命中才调 LLM。精确层零假阳性，先吃掉最容易吃的那部分命中。 | Helicone 官方博客多层模式 https://www.helicone.ai/blog/effective-llm-caching |
| 2 | **阈值必须自己标定，不许抄网上的 0.8**：抽 200–500 条真实线上问句，人工标注「与原问题答案是否等价」，网格搜索阈值，选**满足错误率上限的最低阈值**。 | vCache 论文（分布重叠、最优阈值因 embedding 而异） |
| 3 | **给阈值加"错误率上限"而不是拍脑袋**：先问客户"最多能接受多少比例的答错"，再反推阈值。 | vCache 论文的 δ 机制 |
| 4 | **业务白名单排除**：金额、日期、版本号、订单状态、库存、政策条款类问题**禁止语义命中**，强制走 LLM。 | 论文指出阈值 <1.0 就必然有错答风险 |
| 5 | **缓存键带版本号**：把知识库/提示词版本写进 cache key，内容一更新就整体换键，避免"新政策+旧答案"。Cloudflare 的 `cf-aig-cache-key`、Azure 的 `prompt_cache_key` 都是这个机制。 | Cloudflare 官方 https://developers.cloudflare.com/ai-gateway/features/caching/ ；Azure 官方 |
| 6 | **TTL 分场景**：静态 FAQ 长 TTL（小时级~天级）；价格/活动类短 TTL（分钟级）。Cloudflare TTL 可设 60s–1 月，Azure 缓存 5–10 分钟无活动即清。 | Cloudflare 官方；Azure 官方 |
| 7 | **双指标 + 人工抽检**：同时看 **Hit Ratio** 与 **Recall**（GPTCache 官方推荐），并对命中样本按固定比例（如 2%）人工复核，把错误率写成周报数字。 | GPTCache 官方文档 https://gptcache.readthedocs.io/en/latest/ |
| 8（加码） | **影子期双跑**：上线前 1–2 周，语义命中时**同时后台跑一次真实 LLM**，比对两者输出差异，用真实数据得到该客户自己的假阳性率，再决定是否放开。 | 论文的"生成标签"思路的工程化；成本可控 |

### 4.3 失效策略（三家可查的一手规则）

| 系统 | 失效/续期规则 | 来源性质 |
|---|---|---|
| Cloudflare AI Gateway | TTL 到期即回源并重新填充；TTL 60s–1 月；自定义 key 未配 TTL 时默认 5 分钟；缓存**易失**，并发相同请求可能都 miss | 官方 |
| Azure/OpenAI prompt cache | 泄漏性 TTL：GPT-5.6+ 用 `ttl: 30m`（唯一值，实际可能更久）；早前模型 in-memory 5–10 分钟无活动清空、最迟 1 小时内移除；extended 最长 24 小时；**前 1,024 token 任一字符变化即整体 miss** | 官方 |
| Anthropic on Bedrock | 每次命中**重置 TTL**；5 分钟档在高频下**免费续期**；改 `tools` 会级联使 `system`、`messages` 段失效；1h 与 5m 混用时**长 TTL 必须排在短 TTL 前面** | 官方 |
| GPTCache | 只有 LRU / FIFO，且**按行数**判定，官方承认可能 OOM | 官方 |
| LangCache / Helicone / Portkey | **未取证**（LangCache 未文档化失效策略；Portkey 抓取失败） | — |

---

## 5. 客户现场检查表（直接可用）

### 5.1 第 1 小时：先量，不要先改

- [ ] 拉出客户最近 7–30 天 API 日志（或网关日志），字段至少要：时间戳、模型、输入/输出 token、`cached_tokens` / `cache_read_input_tokens`、prompt 指纹（前 1,024 token 的 hash）、用户/会话 ID。
- [ ] 算三个数：**① 精确重复率**（相同前缀出现 ≥2 次的请求占比）**② 语义近似重复率**（抽样人工判定）**③ 已发生的 prompt cache 命中率**（命中 token / 总输入 token）。
- [ ] 判断天花板：如果**精确重复率**已经很低，语义缓存能带来的增量也就有限；如果精确重复率高但 `cached_tokens` 长期为 0，**问题在 prompt 稳定性而不是缓存技术**（对照 1,024 token 门槛与「差一字符即 miss」规则）。
- [ ] 检查 prompt 稳定性：系统提示词里是否塞了时间戳、用户名、随机 ID、每次变化的工具列表——这会**直接摧毁** prompt caching 命中（官方明确失效条件）。

### 5.2 第 2 小时：算钱

- [ ] 用**客户自己的**单价和 token 数算，不要用本文档里的宣传倍数。
- [ ] 对 DeepSeek 类"写入不加价"的模型：节省 = (复用次数 − 1) × (未命中价 − 命中价) × 前缀 token 数。
- [ ] 对 GPT-5.6+/Claude 类"写入加价"的模型：先取到**真实写入倍率与读取折扣率**（去官方定价页），再套 `n > (写入倍率 − x)/(1 − x)`。
- [ ] 把**限流收益**也计入：命中 token 不占 ITPM 配额（Azure 官方、Bedrock 官方均确认），高峰期等于变相扩容。
- [ ] 把**峰谷价差**计入：DeepSeek 错峰价=峰时一半，把批处理任务挪到错峰时段本身就是降本（官方数字）。

### 5.3 第 3 小时：实施与风控

- [ ] 先上**精确匹配层**（零风险、可当天上线），再评估语义层。
- [ ] 语义层必须交付：阈值标定报告 + 假阳性抽检报告 + 白名单排除清单 + TTL 策略表 + 版本化缓存键方案。
- [ ] 明确告诉客户语义缓存的**不可消除风险**：阈值只要小于 1.0，就存在返回错误答案的可能（论文结论）。
- [ ] 拒绝承诺具体命中率数字；只承诺**监控口径与复现方法**。

### 5.4 卡住了怎么办（兜底）

- 抓不到某家官方定价页（本轮的 Anthropic / OpenAI / Google 全部如此）→ **直接在报告里写"官方页不可达"**，改引同模型在他云平台的官方页（Anthropic→AWS Bedrock、OpenAI→Azure），并注明"口径来自该云平台，需与官网核对"。
- 客户不给日志 → 只做「prompt 稳定性审计」（可只看一份 prompt 样本），先卖这个，别硬推语义缓存。
- 客户要"保证省 30%"→ 拒绝。改成"先做 2 周影子期，用你自己的数据算，再决定"。

---

## 6. 结论与诚实声明

1. **prompt caching 的一手官方数字**：DeepSeek 完整拿到（含峰谷价与 2% 命中价）；OpenAI 与 Anthropic 的**官方站全部不可达**，改用 Azure / AWS 官方页替代，倍率与折扣率仍有缺口；Google 完全缺失。
2. **语义缓存没有可信的公开绝对命中率**。唯一的百分比（70%）是 Redis 官方博客转述的单一客户口述。GPTCache 的「10x/100x」是成本与速度的**相对倍数**，不是命中率。
3. **假阳性是结构性问题**，不是调参能消除的：论文明确只有阈值=1.0 才无假阳性。可交付的保障是「用户自定义错误率上限 + 每 embedding 动态阈值 + 白名单 + 影子期双跑 + 人工抽检」。
4. **最大的隐藏收益点不在语义缓存，而在 prompt 稳定性**：Azure 官方「前 1,024 token 差一个字符即零命中」和 Bedrock 官方「不保证命中」说明，绝大多数客户的钱漏在 prompt 不稳定上，那里可以零风险拿到收益。
5. 本文件所有数字均已附来源 URL 与性质标注；标注为「未核实」「官方表格推断」「单一客户口述」的数字**不得直接对外报价**。