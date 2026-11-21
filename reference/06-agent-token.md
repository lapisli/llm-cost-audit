<!-- 来源：2026-10-22 十四路并行调研的子代理产出，1:1 拷贝，未改写 -->
<!-- 原始文件：_tmp/audit-deep/intl-agent-token.md -->
<!-- 课题：Agent 与多智能体 token 规律 -->
<!-- 证据等级：文内每个数字都带性质标注（官方 / 论文 / 第三方实测 / 厂商宣传 / 未核实） -->
# Agent / 多智能体架构的 token 消耗规律与降本手段

> 调研用途：为「LLM 成本审计 + 降本实施」服务建立可引用的专业依据。
> 编制时间：2026 年（本机会话）
> 性质标注约定：**官方** = 模型/平台厂商自己的文档或工程博客；**论文** = 学术来源；**第三方实测** = 非厂商方的实测/工程记录；**厂商宣传** = 带营销性质的性能宣称；**未核实** = 只拿到标题/URL，未读到正文；**本机实测** = 在这台电脑上用本工作区账本量到的数据。
> ⚠️ 每条数字都附来源 URL。凡本文件未给 URL 的数字，一律视为不可引用。

---

## 0. 一句话总纲

**Agent 的成本公式不是「一次对话多贵」，而是「平均上下文 × 调用次数」。**
多智能体把单条轨迹的上下文切碎（省单次），但把总调用次数和总 token 量级抬高（贵总量）。Anthropic 官方给出的量级是：**agent ≈ 4× chat，多智能体 ≈ 15× chat**。降本的主战场因此有三个：**① 压低每次调用送进去的上下文；② 减少调用次数；③ 让重复前缀命中缓存**。

来源：
- Anthropic《How we built our multi-agent research system》<https://www.anthropic.com/research/multi-agent-research-system> —— **官方**
  （原始入口 `https://www.anthropic.com/engineering/built-multi-agent-research-system`，实际解析到 `/research/`）

---

## 1. ① 多智能体比单智能体贵多少倍（实测/官方数字）

| 指标 | 数字 | 性质 | 来源 |
| --- | --- | --- | --- |
| 普通 agent 相对 chat 的 token 倍数 | **约 4×** | 官方 | <https://www.anthropic.com/research/multi-agent-research-system> |
| 多智能体系统相对 chat 的 token 倍数 | **约 15×** | 官方 | 同上 |
| 多智能体（Opus 4 主 + Sonnet 4 子）相对单智能体 Opus 4 的得分提升 | **+90.2%**（Anthropic 内部 research eval） | 官方（厂商自评） | 同上 |
| BrowseComp 上性能方差的可解释比例 | **token 用量单项解释 80%**；token + 工具调用数 + 模型选择三者合计 **95%** | 官方 | 同上 |
| 15× 这个数字被第三方官方博客交叉引用 | 「up to 15× more tokens than chat as reported by Anthropic」 | 官方（LangChain 转引） | <https://www.langchain.com/blog/context-engineering-for-agents> |

### 审计时可以直接用的三条话术

1. 「多智能体不是免费的并行。Anthropic 自己公布：普通 agent 约 4 倍 chat 的 token，多智能体约 15 倍。所以判断标准不是『能不能拆』，而是『这个任务的价值撑不撑得住 15 倍』。」（官方）
2. 「Anthropic 明确写了：多智能体主要不是因为架构聪明，而是**因为它帮助花掉了足够多的 token**；token 用量单独解释了 80% 的性能方差。」（官方）
3. 「同一篇官方文章也给了不适用场景：需要所有 agent 共享同一上下文、或 agent 之间依赖很多的领域不适合多智能体。原文点名大多数编码任务的可并行部分比研究任务少。」（官方）

### 反方观点（必须一起讲，否则话术不可信）

| 观点 | 内容 | 性质 | 来源 |
| --- | --- | --- | --- |
| Cognition《Don't Build Multi-Agents》 | 两条原则：**共享上下文（要连完整 agent 轨迹一起共享，不只是单条消息）**、**动作隐含决策，冲突的决策带来坏结果**。因此默认应排除不满足这两条的架构，最稳的是单线程线性 agent。 | 厂商工程博客（反方） | <https://cognition.com/blog/dont-build-multi-agents> |
| 对 Claude Code 子代理的观察 | 截至 2025 年 6 月，Claude Code 会派生子任务，但**从不与子代理并行工作**，且子代理通常只被要求回答问题、不写代码。作者认为收益是「子代理的调研工作不必留在主 agent 历史里」。 | 厂商工程博客（第三方观察） | 同上 |

> **给用户的结论**：多智能体的 15× 和 Cognition 的「别拆」并不矛盾 —— Anthropic 讲的是**成本与能力交换**，Cognition 讲的是**可靠性**。审计报告里应该同时给出这两个数字和理由，才站得住。

---

## 2. ② Context engineering 官方指南（Anthropic / OpenAI / Google / LangChain）

### 2.1 Anthropic《Effective context engineering for AI agents》

来源：<https://www.anthropic.com/research/effective-context-engineering-for-ai-agents> —— **官方**
（原始入口 `.../engineering/effective-context-engineering-for-ai-agents`）

| 要点 | 原文结论 | 备注 |
| --- | --- | --- |
| 定义 | context engineering = 在推理时**策划与维护最优 token 集合**的策略，含 prompt 之外一切会落进上下文的输入 | 与 prompt engineering 的区别：后者只管「怎么写指令」 |
| 为什么重要 | 引 Chroma 的 **context rot** 研究：**上下文 token 数增加时，模型准确回忆其中信息的能力下降**。这是跨所有模型的现象。 | 引用来源 research.trychroma.com/context-rot（**未核实正文**，仅从官方文中获知） |
| 机制解释 | Transformer 下 n 个 token 有 **n² 对** 两两关系；上下文越长，捕获这些关系的能力被摊薄 | 官方 |
| 核心原则 | 找到**最小的高信号 token 集合**（smallest possible set of high-signal tokens）；上下文是「有限资源 + 边际收益递减」，模型有「注意力预算」 | 官方 |
| System prompt | 要落在「**right altitude**」：一端是硬编码 if-else 的脆弱提示，另一端是过于笼统、假设了共享上下文的空话 | 官方 |
| 组织结构 | 建议分节（`<background_information>`、`<instructions>`、`## Tool guidance`、`## Output description`），用 XML 标签或 Markdown 标题分隔 | 官方 |
| 工具 | 最常见的失败模式是**工具集臃肿、功能重叠**导致「选哪个」的歧义点。若人类工程师都说不清该用哪个工具，agent 更不行 | 官方 |
| Few-shot | 不要塞一堆边界情况清单；要**精选少量、多样、典型的例子** | 官方 |
| 检索范式 | 从「预推理期 embedding 检索」转向 **just-in-time**：agent 只持有轻量标识符（文件路径、存的查询、链接），运行时用工具动态加载 | 官方 |
| 渐进披露 | 文件大小暗示复杂度、命名约定暗示用途、**时间戳可作为相关性的代理** | 官方 |
| 长任务的三种手段 | **compaction（压缩）**、**structured note-taking（结构化笔记/agentic memory）**、**multi-agent 架构** | 官方 |
| Compaction 细节 | 把接近窗口上限的对话摘要后重开新窗口。Claude Code 的做法：模型保留**架构决策、未解决的 bug、实现细节**，丢弃冗余的工具输出与消息，然后带压缩上下文 **+ 最近访问的 5 个文件**继续 | 官方 |
| Compaction 调参建议 | 先在复杂 agent trace 上把 compaction prompt 调到**最大化 recall**，再迭代提升 precision | 官方 |
| 最划算的压缩 | **tool result clearing（清除工具结果）** 被点名为「最安全、最轻的压缩形式」，并已在 Claude Developer Platform 上线 | 官方 |
| 笔记法 | 类似 Claude Code 写 to-do、或自建 agent 维护 `NOTES.md`；官方举「Claude 玩宝可梦」例：跨数千步精确记录「过去 1,234 步在 Route 1 练级，皮卡丘涨了 8 级」 | 官方 |
| 选择建议 | 需要大量来回的对话 → compaction；有明显里程碑的迭代开发 → 笔记法；需要并行探索的复杂研究 → 多智能体 | 官方 |

### 2.2 LangChain《Context Engineering》

来源：<https://www.langchain.com/blog/context-engineering-for-agents> —— **官方（LangChain 官方博客）**

四分类框架（写检查表时最好用）：

| 类别 | 做法 | 官方举的例子 |
| --- | --- | --- |
| **Write** | 把上下文写到窗口外 | scratchpad（写文件 / 运行时 state 字段）、跨会话 memories（Reflexion、Generative Agents；产品侧 ChatGPT / Cursor / Windsurf） |
| **Select** | 把需要的拉回窗口 | 读 scratchpad、按语义选记忆（episodic / procedural / semantic）、**对工具描述做 RAG**、RAG 检索 |
| **Compress** | 只留必要 token | 摘要（Claude Code 在**超过上下文窗口 95%** 时跑 auto-compact）、trimming / pruning（删旧消息、Provence 训练式剪枝） |
| **Isolate** | 把上下文切开 | 多智能体（每个 agent 自带工具集、指令、独立窗口）、环境隔离 |

其他可直接引用的数字/结论：

| 要点 | 内容 | 性质 |
| --- | --- | --- |
| 长上下文的四类性能故障 | Context **Poisoning**（幻觉进入上下文）/ **Distraction**（上下文淹没训练分布）/ **Confusion**（无关上下文影响回答）/ **Clash**（上下文各部分互相矛盾），引自 Drew Breunig | 官方博客转引第三方（Breunig 原文**未核实**） |
| 工具描述 RAG 的收益 | 有近期论文显示可把**工具选择准确率提升 3 倍（3-fold）** | 官方转引论文（arXiv 2505.03275，**未核实原文**） |
| Claude Code auto-compact 触发线 | **超过上下文窗口 95%** 时对整条轨迹做摘要 | 官方 |
| LangChain 引用 Cognition 与 Anthropic | 引用 Cognition「context engineering 是构建 AI agent 工程师的 **#1 job**」；引用 Anthropic「agent 常在跨**数百轮**的对话中运行」 | 官方转引 |

### 2.3 OpenAI / Google

| 目标 | 状态 | 说明 |
| --- | --- | --- |
| OpenAI《prompt caching》官方页 `https://platform.openai.com/docs/guides/prompt-caching` | **抓取失败：HTTP 403**（Cloudflare 拦截，Ray ID `a4e8a6ce2dcb9399`） | 已用 Azure 官方镜像替代（见 §4），Azure 文档明说「Azure OpenAI 使用与 OpenAI API 相同的请求结构」 |
| OpenAI《A practical guide to building agents》PDF `https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf` | **抓取失败：unsupported content type "application/pdf"** | 本工具的 web_fetch 不吃 PDF |
| Google Gemini API 缓存文档 `https://ai.google.dev/gemini-api/docs/caching` | **抓取失败：fetch failed** | |
| Vertex AI context cache 文档 `https://cloud.google.com/vertex-ai/generative-ai/docs/context-cache/context-cache-overview` | **抓取失败：fetch failed** | |
| Anthropic 官方 prompt caching 文档 | **抓取失败**：`docs.claude.com/en/docs/build-with-claude/prompt-caching` → 重定向链 → 最终跨域到 `platform.claude.com` / `www.anthropic.com`，工具不跟随跨域重定向 | 已用 **AWS Bedrock 官方文档**替代，其中含 Anthropic 模型的完整缓存规则（见 §4） |
| Anthropic context management 发布说明 `https://www.anthropic.com/news/context-management` | **抓取失败**：跨域重定向到 `claude.com` | tool result clearing 的机制已从 context engineering 官方文中获得 |

> **给用户的提醒**：OpenAI 与 Google 的**缓存规则**目前只能靠 Azure/AWS 官方镜像引用；如果要写进交付物，请标注「经 Azure/AWS 官方镜像转引，OpenAI/Google 原页未直接核验」。

---

## 3. ③ 子智能体隔离为什么能省

### 3.1 官方给出的机制（Anthropic）

| 机制 | 原文结论 | 性质 | 来源 |
| --- | --- | --- | --- |
| 各自烧自己的窗口 | 子代理「**并行运行、各有自己的上下文窗口**」，同时探索问题的不同侧面，然后把最重要的 token 压缩后交给主研究 agent | 官方 | <https://www.anthropic.com/research/multi-agent-research-system> |
| 隔离产生压缩 | 「搜索的本质是压缩」；子代理充当**智能过滤器**，迭代用工具收集信息后只回传结论 | 官方 | 同上 |
| 蒸馏回传量级 | 每个子代理可能「探索性地烧掉**数万 token 或更多**」，但只回传**约 1,000–2,000 token** 的浓缩摘要 | 官方 | <https://www.anthropic.com/research/effective-context-engineering-for-ai-agents> |
| 分离关注点 | 每个子代理有**不同的工具、prompt、探索轨迹**，降低路径依赖，让调查互相独立 | 官方 | <https://www.anthropic.com/research/multi-agent-research-system> |

**降本逻辑链（可直接写进审计报告）**：
子代理把「数万 token 的探索过程」留在自己的窗口里 → 主 agent 只收 1,000–2,000 token 摘要 → 主 agent 的**每次**后续调用都不必重发那几万 token。
因为「消耗 = 平均上下文 × 调用次数」，这一步同时压低了**平均上下文**和主 agent 的**总重发量**。

### 3.2 代价与反面（必须同时讲）

| 代价 | 内容 | 性质 | 来源 |
| --- | --- | --- | --- |
| 总量变贵 | 隔离省的是**主 agent 的上下文**，不是总账。子代理自己也在烧 token，所以总量升到约 15× | 官方 | <https://www.anthropic.com/research/multi-agent-research-system> |
| 协调复杂度暴涨 | 早期 agent 会「为简单查询派生 50 个子代理」、「无休止搜不存在的来源」、「互相用过量更新干扰」 | 官方 | 同上 |
| 信息传递损耗 | Anthropic 自己做了一个反制：**让子代理把输出写进文件系统，只把轻量引用传回协调者**，以免多阶段处理中信息丢失，并减少把大输出复制进对话历史的 token 开销（原文标题正在讲 "minimize the 'game of telephone'"） | 官方 | 同上 |
| 决策分散导致不可靠 | Cognition：子代理看不到彼此在做什么，会给出**互相冲突的假设**；且 2025 年多个 agent 协作「只会得到脆弱的系统」 | 厂商工程博客 | <https://cognition.com/blog/dont-build-multi-agents> |
| 主/子上下文无法真正共享 | Anthropic 也承认：需要「所有 agent 共享同一上下文」的领域现在不适合多智能体 | 官方 | <https://www.anthropic.com/research/multi-agent-research-system> |

### 3.3 官方的「该派几个」经验规则（可直接做成检查表）

Anthropic 原文嵌进 prompt 的缩放规则 —— **官方**，来源 <https://www.anthropic.com/research/multi-agent-research-system>：

| 任务复杂度 | 建议投入 |
| --- | --- |
| 简单事实查找 | **1 个 agent，3–10 次工具调用** |
| 直接对比 | **2–4 个子代理，每个 10–15 次调用** |
| 复杂研究 | **>10 个子代理**，且职责必须清晰切分 |

同文另外两条可引用的操作数：
- 主 agent 并行起 **3–5 个子代理**（而不是串行），子代理之间用 **3+ 个工具并行**；这些改动把复杂查询的研究时间**最多缩短 90%**。—— 官方
- 一个「工具描述优化 agent」反复测试工具体验后改写描述，使后续 agent 的任务完成时间**下降 40%**。—— 官方

---

## 4. ④ Agent 循环里的 prompt caching 行为（前缀稳定性 / 工具定义 / 动态时间戳）

### 4.1 官方规则总表

| 规则 | 数字/结论 | 性质 | 来源 |
| --- | --- | --- | --- |
| 最小可缓存长度（OpenAI 侧） | **1,024 token**，且**前 1,024 token 必须完全相同** | 官方（Azure 镜像 OpenAI） | <https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/prompt-caching> |
| 破坏条件 | **前 1,024 token 里只要差一个字符 → cache miss**，表现为 `cached_tokens = 0` | 官方（Azure） | 同上 |
| 命中粒度（GPT-5.5 及更早） | 首次 1,024 token 之后，按 **128 token 增量**命中；GPT-5.6 及以后不再有此取整 | 官方（Azure） | 同上 |
| 缓存里到底有什么 | **完整 messages 数组（system / developer / user / assistant）**、图片（链接或 base64，`detail` 参数必须一致）、**工具定义（tool use：messages 数组 + tool definitions）**、结构化输出 schema（作为前缀追加到 system message） | 官方（Azure） | 同上 |
| 写入缓存是否收费 | GPT-5.6 之前：**写入不额外收费**；GPT-5.6 及以后：写入可能收费，读取仍打折 | 官方（Azure） | 同上 |
| OpenAI 侧写入/读取倍率 | 写入 **1.25×** 未缓存输入价；读取按模型 cache-read 折扣价；**缓存命中的输入 token 不计入 TPM 限流** | 官方（AWS 镜像 OpenAI） | <https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-caching.html> |
| 保留时长（OpenAI 侧） | 内存缓存**通常 5–10 分钟无活动后清除，最迟在使用后 1 小时内移除**；扩展保留最长 **24 小时**；GPT-5.6+ 的 `prompt_cache_options.ttl` 只支持 `30m` | 官方（Azure） | <https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/prompt-caching> |
| 每小时请求量上限 | 同一前缀 + 同一 `prompt_cache_key` **超过约 15 请求/分钟**时，部分请求可能 miss；高并发要高散到多个 key | 官方（Azure） | 同上 |
| 官方最佳实践 | **稳定/重复内容放最前，动态内容放最后；保持对话上下文 append-only** | 官方（Azure） | 同上 |

### 4.2 ★ 工具定义变化会不会击穿缓存？——会（官方明文）

**AWS Bedrock 官方文档原文（Anthropic 模型的缓存检查点）**：
> Cache checkpoints are processed in this order: `tools` → `system` → `messages`. … Because the sections are chained, **changing content in an earlier section invalidates the cache for later sections (for example, modifying `tools` invalidates the `system` and `messages` caches).**

| 结论 | 性质 | 来源 |
| --- | --- | --- |
| 检查点按 **tools → system → messages** 顺序链接；**改了 tools，system 与 messages 的缓存一起失效** | 官方 | <https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-caching.html> |
| Claude 模型每个请求最多 **4 个缓存检查点** | 官方 | 同上 |
| 最小可缓存前缀：**512–4,096 token**，按模型而异（Claude 3.5 Sonnet v2 / 3.7 Sonnet = 1,024；Claude Opus 4.5+ 与 Haiku 4.5 = 4,096；Claude Sonnet 5 / Sonnet 5.5 / Opus 5 系列 = 512）；最小值按 `tools`+`system`+`messages` **累计**计算，不是每段单独算 | 官方 | 同上 |
| 检查点之间**没有**最小间隔；只要每个检查点之前的累计前缀够最小值即可 | 官方 | 同上 |
| 自动前缀检查只回看**约 20 个 content block**；静态内容超出这个范围要改用多检查点或重排 | 官方 | 同上 |
| TTL：多数模型 **5 分钟**，部分支持 **1 小时**；**每次命中都会重置 TTL**；1 小时条目必须排在 5 分钟条目之前 | 官方 | 同上 |
| 缓存命中**不计入限流** | 官方 | 同上 |

> ⚠️ Anthropic 官方 prompt caching 页未能抓取（跨域重定向）。上述 `tools` 击穿 `system`/`messages` 的结论来自 **AWS Bedrock 官方文档中 Anthropic 模型章节**，属官方但为**云厂镜像**。另有 Anthropic 官方页标题为《Mid-conversation system messages and tool changes》(`https://platform.claude.com/docs/en/build-with-claude/mid-conversation-system-messages`)，标题本身即指向「对话中途改 system 消息与工具」，**正文未核实**。

### 4.3 动态时间戳的破坏性

| 证据 | 内容 | 性质 | 来源 |
| --- | --- | --- | --- |
| 机制（官方） | 前 1,024 token 内**一个字符的差异**即导致整段 miss | 官方 | <https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/prompt-caching> |
| 机制（官方） | 「prompt prefixes should remain static between requests. **Changes to a prompt prefix in subsequent requests result in cache misses**」 | 官方 | <https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-caching.html> |
| 真实故障案例 | opencode 仓库 issue #32622 标题：**「Daily date in cached system prefix breaks prompt cache across midnight」** —— 系统提示里的日期，跨午夜就击穿缓存 | 第三方实测（未读正文，仅获标题与 URL） | <https://github.com/anomalyco/opencode/issues/32622> |
| 真实修复案例 | n8n 仓库 PR #32413 标题：**「Stabilize Instance AI prompt-cache prefix across turns」** —— 工程上专门为「跨轮次稳定缓存前缀」做的修复 | 第三方实测（未读正文，仅获标题与 URL） | <https://github.com/n8n-io/n8n/pull/32413> |

**审计动作（可直接写进检查表）**：
1. 抓一段真实请求的**最前面 1,024 token**，逐字节比对连续 3 次调用是否完全一致。
2. 搜 system prompt / 工具定义里有没有 `now()`、`today`、日期、时间戳、随机 ID、会话 ID、用户 IP、环境变量、模型版本号。
3. 只要有一个，**把它从静态前缀挪到动态尾部**（或改成「仅日期粒度且在会话内冻结」）。
4. 看 `cached_tokens` / `cache_read_input_tokens` 是否长期为 0 —— 为 0 就是被击穿了。
5. 检查 `tools` 是否每轮都在变（工具集按会话动态增删、MCP server 列表变动、工具描述里带版本号/时间）—— 这会让 `system` 和 `messages` 一起失效。

### 4.4 本机实测的参照值（可作为「健康态」基线）

| 指标 | 本机实测值 | 性质 | 来源 |
| --- | --- | --- | --- |
| 缓存命中率 | **96.8%** | 本机实测 | 本工作区 `AGENTS.md`「上下文成本规则」 |
| 全局缓存读取 vs 新输入 | 缓存读取 **1,970.99M** vs 新输入 **65.22M**（11,503 次请求） | 本机实测 | 同上 |
| 结论 | 缓存命中高是**正常状态**，不要去「修」缓存；降成本只能靠**降上下文长度** | 本机实测 | 同上 |

> 这条对定价谈判很关键：**缓存已经很省的时候，继续在缓存上做文章收益极低；真正的钱在上文长度 × 调用次数。**

---

## 5. ⑤ 工具返回落盘 / 摘要化的最佳实践

### 5.1 Anthropic 官方《Writing effective tools for AI agents》

来源：<https://www.anthropic.com/research/writing-tools-for-agents> —— **官方**
（原始入口 `.../engineering/writing-tools-for-agents`）

| 实践 | 官方给的数字 | 备注 |
| --- | --- | --- |
| 默认截断上限 | **Claude Code 把工具响应默认限制在 25,000 token** | 官方 |
| 精简 vs 详细返回 | 官方示例：detailed = **206 token**，concise = **72 token**，用 concise **只用约 1/3 的 token**；做法是给工具加 `response_format` enum（`detailed` / `concise`） | 官方 |
| 只回高信号信息 | 优先「上下文相关性」而非「灵活性」，**剔掉低层技术标识符**（`uuid`、`256px_image_url`、`mime_type`）；保留 `name`、`image_url`、`file_type` 这类能直接驱动下游动作的字段 | 官方 |
| 语义化 ID | 把无意义 UUID 解析成语义化名称（甚至 0 基索引 ID）**显著提升检索精度、降低幻觉** | 官方 |
| 工具要合并而不是堆砌 | 不要 `list_users` + `list_events` + `create_event`，要做 `schedule_event`；不要 `read_logs`，要做 `search_logs`（只返回相关行 + 上下文）；不要 `get_customer_by_id` 等三个，要做 `get_customer_context` | 官方 |
| 截断要带引导 | 截断时要用错误/截断信息**明确引导 agent 改用分页、过滤、范围选择**，而不是甩一个不透明的错误码或 traceback | 官方 |
| 返回格式 | XML / JSON / Markdown 没有通解，LLM 对与训练分布相符的格式表现更好，要用自己的评测选 | 官方 |
| 命名空间 | 用前缀（`asana_search`）或后缀（`asana_projects_search`）分组；前缀 vs 后缀效果有非平凡差异，要按自己的评测选 | 官方 |
| 评测时要收集的指标 | 不只准确率，还要收集**工具调用总耗时、工具调用总次数、总 token 消耗、工具错误数** | 官方（审计服务的卖点可以直接建在这套指标上） |

### 5.2 落盘（文件系统）—— 官方点名的最佳实践

| 做法 | 原文结论 | 性质 | 来源 |
| --- | --- | --- | --- |
| 子代理输出写文件系统 | 实现 artifact 系统：专门的 agent 把工作**存进外部系统**，然后只把**轻量引用**回传给协调者。这能防止多阶段处理中的信息丢失，**并减少把大输出复制进对话历史带来的 token 开销** | 官方 | <https://www.anthropic.com/research/multi-agent-research-system> |
| 最轻的压缩 = 清工具结果 | **tool result clearing** 被称为「最安全、最轻的 compaction 形式」，已在 Claude Developer Platform 上线 | 官方 | <https://www.anthropic.com/research/effective-context-engineering-for-ai-agents> |
| 子代理回传摘要 | 子代理烧数万 token，只回传 **1,000–2,000 token** | 官方 | 同上 |
| 落盘的副作用 | 运行时探索比预取数据慢；且需要工具与启发式设计得当，否则 agent 会浪费上下文去用错工具、追死路 | 官方 | 同上 |

### 5.3 本机实测的三条铁律（可作为「中国本地部署 + 自建 harness」场景的实证）

| 规则 | 本机实测值 | 性质 |
| --- | --- | --- |
| 工具返回在上下文中的占比 | **60.7%**（其次 reasoning 25.8%、工具参数 10.7%、助手正文 2.8%、用户消息 0%） | 本机实测 |
| 第一元凶 | `web_fetch`：单会话累计 **760K 字符 / 115 次调用**，占全部工具返回的 **60%** | 本机实测 |
| 落盘阈值 | **工具返回超过约 2 万字符就必须落盘**，上下文里只留「结论 + 路径」 | 本机实测 |
| 一次性内容的复利 | 一次 50K 字符的抓取会在之后**每次**调用里重发；100 次调用 = **170 万 token** 的计费量 | 本机实测 |
| 别指望自动压缩 | 34 次 prune 累计只剪掉 **158,539 token**，占会话总消耗 **0.36%** | 本机实测 |

来源：本工作区 `AGENTS.md`「上下文成本规则」（含根因报告路径 `_docs/上下文成本根因报告-20261022.md`）。

---

## 6. ⑥ 「任务拆会话」的经验阈值

### 6.1 官方给的锚点（注意：官方按**上下文占用比例**，不按调用次数）

| 锚点 | 数字 | 性质 | 来源 |
| --- | --- | --- | --- |
| Claude Code auto-compact 触发线 | **超过上下文窗口 95%** | 官方 | <https://www.langchain.com/blog/context-engineering-for-agents> |
| Anthropic 多智能体的截断点 | 主研究 agent 一超出 **200,000 token** 上下文就会被截断，所以它先把计划写进 Memory | 官方 | <https://www.anthropic.com/research/multi-agent-research-system> |
| 压缩后恢复工作的方法 | 用压缩后的上下文 **+ 最近访问的 5 个文件** 继续 | 官方 | <https://www.anthropic.com/research/effective-context-engineering-for-ai-agents> |
| 长任务的官方三种手段 | compaction / structured note-taking / multi-agent，按任务特征选 | 官方 | 同上 |
| 硬重启的官方做法 | 「当接近上下文上限时，agent 可以**派生出干净上下文的新子代理**，并通过谨慎的交接保持连续性」 | 官方 | <https://www.anthropic.com/research/multi-agent-research-system> |
| Cognition 的做法 | 专门训一个模型把「动作与对话历史」压缩成关键细节、事件、决策；承认「**这很难做对**」，为此投入了微调小模型 | 厂商工程博客 | <https://cognition.com/blog/dont-build-multi-agents> |

### 6.2 以「调用次数」为单位的阈值（本机实测 —— 这是你手上唯一有次数口径的数字）

| 规则 | 阈值 | 性质 | 来源 |
| --- | --- | --- | --- |
| 单个任务超过多少次工具调用就该起新会话 | **约 30 次** | 本机实测 | 本工作区 `AGENTS.md`「上下文成本规则」 |
| 一个「简单任务」可能触发的调用次数 | **100+ 次** → 折算 **16.7M token** | 本机实测 | 同上 |
| 单任务平均上下文 | **15 万 token** | 本机实测 | 同上 |

### 6.3 由此推出的「拆会话」决策表（可直接交付客户）

| 信号 | 触发动作 | 依据性质 |
| --- | --- | --- |
| 同一任务工具调用 **> 30 次** | 存盘当前结论 → 开新会话，只带「结论 + 关键文件路径」 | 本机实测 |
| 上下文占用 **> 95%** | 立即压缩或换会话（Claude Code 的官方线） | 官方 |
| 单次请求上下文 **> 200,000 token** | 会被截断，必须先把计划/结论落盘 | 官方 |
| 换了**任务主题**（不是同一目标的延续） | 直接换会话，不要复用一个满载的窗口 | 官方（Cognition：动作隐含决策；Anthropic：上下文污染） |
| 会话中出现大量**已用完的工具输出** | 先做 tool result clearing，再决定是否换 | 官方 |
| 需要长期延续 | 落盘 `NOTES.md` / 计划文件，新会话读它恢复 | 官方 |

> **诚实标注**：调研范围内**没有找到**「多少次调用就换会话」的行业统一官方阈值。
> Anthropic / LangChain 给的是**百分比口径**（95%、200K token），次数口径的 30 次是**本机实测**。
> 交付时务必分开说，不要把 30 次说成官方数字。

---

## 7. 交付用检查表（审计 → 降本，逐条可执行）

### 表 A：Agent token 消耗审计清单

| # | 检查项 | 判定标准 | 依据 |
| --- | --- | --- | --- |
| A1 | 架构是否多智能体 | 是 → 先按 **15× chat** 预期成本，按 **4× chat** 单 agent 预期 | 官方 |
| A2 | 该任务是否值得多智能体 | 需要共享上下文 / agent 间依赖多 → 官方明说不合适 | 官方 |
| A3 | 是否有任务价值论证 | 官方原文：经济可行性要求「任务价值高到足以支付性能提升」 | 官方 |
| A4 | 子代理回传量 | 应落在 **1,000–2,000 token** 量级；超标说明没做摘要 | 官方 |
| A5 | 派生子代理数量 | 简单事实查询就派一堆 = 反模式（官方记录过「简单查询派生 50 个子代理」） | 官方 |
| A6 | 工具响应长度 | 是否有截断？默认上限参考 **25,000 token**（Claude Code） | 官方 |
| A7 | 是否有落盘机制 | 大输出应写外部系统，只回传轻量引用 | 官方 |
| A8 | 是否清理过期工具结果 | tool result clearing 是最划算的第一刀 | 官方 |
| A9 | 工具集是否臃肿 | 有功能重叠、人类都说不清选哪个 → 先合并/命名空间 | 官方 |
| A10 | 工具返回是否带低层标识符 | `uuid` / `mime_type` / 大 URL 应剔除或语义化 | 官方 |
| A11 | 缓存前缀是否稳定 | 前 **1,024 token** 逐字节比对连续 3 次调用 | 官方 |
| A12 | 静态前缀里有无动态值 | 日期/时间戳/随机 ID 一律外移 | 官方 + 第三方案例 |
| A13 | `tools` 是否每轮变动 | 变动会**同时击穿** `system` 与 `messages` 缓存 | 官方 |
| A14 | 缓存命中监控 | 盯 `cached_tokens` / `cache_read_input_tokens`，长期为 0 = 被击穿 | 官方 |
| A15 | 缓存 TTL 是否够用 | 5 分钟 vs 1 小时；长于 5 分钟的间隔应上 1 小时 TTL | 官方 |
| A16 | 是否有笔记/计划落盘 | 超 200K token 会被截断，计划必须外部化 | 官方 |
| A17 | 会话拆分 | 单任务 > 30 次工具调用 / 上下文 > 95% → 拆 | 本机实测 + 官方 |
| A18 | 是否计量了「每次调用的平均上下文」 | 这是成本公式的乘数，必须量出来 | 本机实测 |

### 表 B：降本手段优先级（按官方证据强度排序）

| 优先级 | 手段 | 预期效果 | 证据 |
| --- | --- | --- | --- |
| 1 | 工具返回落盘 + 摘要（只回传结论与路径） | 直接砍掉上下文里占比最大的一块（本机实测工具返回占 **60.7%**） | 官方 + 本机实测 |
| 2 | 清除已用完的工具结果（tool result clearing） | 官方称为「最安全、最轻」的压缩 | 官方 |
| 3 | 稳定缓存前缀（动态值外移、`tools` 冻结、append-only） | 守住已有的高命中率；官方：`tools` 变动会击穿后两段 | 官方 |
| 4 | 精简工具集与工具返回（concise 模式） | 官方示例 **206 → 72 token（约 1/3）** | 官方 |
| 5 | 子代理隔离 + 强制摘要在 1,000–2,000 token | 压低主 agent 的平均上下文 | 官方 |
| 6 | 按复杂度缩放子代理数量（1 个 / 2–4 个 / >10 个） | 防止「简单查询派生 50 个子代理」 | 官方 |
| 7 | 拆会话 / 压缩（>30 次调用、>95% 窗口） | 截断复利（一次 50K 字符会在之后每次调用重发） | 本机实测 + 官方 |
| 8 | 换更聪明的模型而不是加 token 预算 | 官方：升到 Sonnet 4 的收益大于在 3.7 上把预算翻倍 | 官方 |

---

## 8. 抓取失败清单（写报告时如实标注）

| 目标 | 结果 |
| --- | --- |
| `https://platform.openai.com/docs/guides/prompt-caching` | HTTP 403，Cloudflare 拦截（Ray ID `a4e8a6ce2dcb9399`） |
| `https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf` | 不支持 `application/pdf` |
| `https://ai.google.dev/gemini-api/docs/caching` | fetch failed |
| `https://cloud.google.com/vertex-ai/generative-ai/docs/context-cache/context-cache-overview` | fetch failed |
| `https://docs.claude.com/en/docs/build-with-claude/prompt-caching` | 跨域重定向链，未跟随（改用 AWS 官方镜像） |
| `https://platform.claude.com/docs/en/build-with-claude/prompt-caching` | 跨域重定向，未跟随 |
| `https://www.anthropic.com/news/context-management` | 跨域重定向到 `claude.com`，未跟随 |
| `https://cognition.com/blog/dont-build-multi-agents`（首次） | 跨域重定向；改用 `https://cognition.com/blog/dont-build-multi-agents` 成功 |

**未读正文、仅有标题/URL 的线索（不可当结论引用）**：

| 线索 | URL | 为什么值得后续补 |
| --- | --- | --- |
| 《Mid-conversation system messages and tool changes》 | <https://platform.claude.com/docs/en/build-with-claude/mid-conversation-system-messages> | **可能是「工具定义变化 = 缓存击穿」的 Anthropic 官方一手证据**，优先级最高 |
| Anthropic prompt caching 官方页 | <https://platform.claude.com/docs/en/build-with-claude/prompt-caching> | 一手 TTL / 检查点数量 / 写入倍率 |
| opencode issue #32622 | <https://github.com/anomalyco/opencode/issues/32622> | 动态日期击穿缓存的实测细节 |
| n8n PR #32413 | <https://github.com/n8n-io/n8n/pull/32413> | 跨轮次稳定缓存前缀的工程做法 |
| Claude Code 会话管理官方博客 | <https://claude.com/blog/using-claude-code-session-management-and-1m-context> | **「任务拆会话」的一手官方阈值** |
| 《Maximizing the value of your Claude Code sessions》 | <https://claude.com/resources/articles/maximizing-the-value-of-your-claude-code-sessions> | 同上 |
| savetokens（Claude Code / Codex 省 token 实测对照表） | <https://github.com/ryanportfolio/savetokens> | 第三方实测的前后对比数字 |
| Drew Breunig《How contexts fail and how to fix them》 | <https://www.dbreunig.com/2025/06/22/how-contexts-fail-and-how-to-fix-them.html> | 四类上下文故障的原始出处 |
| Chroma context rot 研究 | <https://research.trychroma.com/context-rot> | context rot 的原始论文/实验 |
| 工具描述 RAG 提升 3 倍 | <https://arxiv.org/abs/2505.03275> | 工具选择准确率的论文数字 |

---

## 9. 版本与时效说明

- 本文件所有数字均来自本会话实际抓取到的页面。抓取到的 AWS 表中出现 `Claude Sonnet 5.5` / `Claude Opus 5.5` / `GPT-6.1` 等型号，Azure 页脚标注 `Last updated on 2026-08-11`；引用时请**保留型号与页面日期**，因为缓存规则与最小 token 阈值**按型号不同而变化**（Claude 3.5/3.7 = 1,024，Opus 4.5+ / Haiku 4.5 = 4,096，Sonnet 5 系列 = 512）。
- Anthropic 的「4× / 15×」是**其自身生产数据**，不是第三方复现实验，引用时应说「Anthropic 官方公布的数据」。
- 本机实测数字来自本工作区 `AGENTS.md` 的记录，**不是行业基准**，但对「自建 harness / 中国本地部署」场景有直接可比性。