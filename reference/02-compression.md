<!-- 来源：2026-10-22 十四路并行调研的子代理产出，1:1 拷贝，未改写 -->
<!-- 原始文件：_tmp/audit-deep/intl-compression.md -->
<!-- 课题：提示词压缩与上下文工程 -->
<!-- 证据等级：文内每个数字都带性质标注（官方 / 论文 / 第三方实测 / 厂商宣传 / 未核实） -->
# 上下文 / 提示词压缩的最新技术与可复现效果（调研报告）

调研日期：2026-10-22 前后（子代理执行）
执行约束：共 18 次抓取 + 3 次搜索（同步，无后台任务）。抓取失败项统一记入 §6。
**性质标注体系**：`官方`（厂商/库官方文档或官方博客） / `论文`（同行评审或 arXiv 原文摘要，本次抓取到的是摘要页）/ `第三方实测` / `厂商宣传`（官方自我宣传口径） / `未核实`（只拿到第三方转述或二手摘要） / `抓取失败`。

> ⚠️ 所有数字均来自下面逐条给出的 URL。凡本次**没抓到原文**的，一律标 `未核实` 或 `抓取失败`，不做推测性补全。

---

## 1. LLMLingua 系列（微软）

### 1.1 三个方法一览（可引用结论）

| 方法 | 发表 | 核心原理 | 压缩率 | 质量损失 / 收益 | 延迟 | 来源与性质 |
|---|---|---|---|---|---|---|
| **LLMLingua** | EMNLP 2023 | coarse-to-fine 提示压缩：预算控制器（budget controller）保语义完整 + token 级迭代压缩建模相互依赖 + 指令微调做分布对齐 | **最高 20x**，"little performance loss" | 摘要口径：SOTA，几乎没有性能损失 | 未在摘要给出 | [arXiv:2310.05736](https://arxiv.org/abs/2310.05736) `论文`；[ACL Anthology EMNLP 2023](https://aclanthology.org/2023.emnlp-main.825/) `论文` |
| **LongLLMLingua** | ACL 2024 Long Papers（pp.1658–1677）；另有 ICLR 2024 ME-FoMo workshop 版 | 面向长上下文：缓解 "lost in the middle"、按问题条件重排/动态压缩、提升关键信息密度与位置感知 | 提示约 10k token 时 **2x–6x** | **NaturalQuestions +21.4%** 且 token 约 **4x 更少**（GPT-3.5-Turbo）；**LooGLE 成本降 94.0%** | 端到端延迟加速 **1.4x–2.6x** | [ACL Anthology 2024.acl-long.91](https://aclanthology.org/2024.acl-long.91/) `论文`（摘要页，本次抓取成功） |
| **LLMLingua-2** | Findings of ACL 2024（arXiv v1 2024-03-19，v2 2024-08-12） | 从 GPT-4 做 **data distillation**，把压缩重构为 **token 分类**问题（保证忠实于原文），用 Transformer encoder（XLM-RoBERTa-large / mBERT）利用**双向上下文**；引入抽取式压缩数据集 | **2x–5x** | 比已有压缩方法更强，跨 LLM 泛化稳健（MeetingBank / LongBench / ZeroScrolls / GSM8K / BBH） | 比已有压缩方法**快 3x–6x**；端到端延迟加速 **1.6x–2.9x** | [arXiv:2403.12968](https://arxiv.org/abs/2403.12968) `论文` |
| LLMLingua 2 发布口径 | 官方库 News | — | — | — | "**3x-6x speed improvement over LLMLingua**" | [PyPI llmlingua](https://pypi.org/project/llmlingua/) `厂商宣传`（与论文口径一致，可交叉印证） |

### 1.2 可直接抄进检查表的调用参数（官方库文档）

来源：[PyPI llmlingua 0.2.2（2024-04-09 发布）](https://pypi.org/project/llmlingua/) `官方`。注意该包 Development Status = **3 - Alpha**（官方自述），生产使用需自测。

| 场景 | 关键参数（官方 README 示例） |
|---|---|
| LongLLMLingua（RAG） | `ratio=0.55`、`condition_in_question="after_condition"`、`reorder_context="sort"`、`dynamic_context_compression_ratio=0.3`（或 0.4）、`condition_compare=True`、`context_budget="+100"`、`rank_method="longllmlingua"` |
| LLMLingua-2 | `model_name="microsoft/llmlingua-2-xlm-roberta-large-meetingbank"`、`use_llmlingua2=True`、`rate=0.33`、`force_tokens=['\n','?']`；小模型：`microsoft/llmlingua-2-bert-base-multilingual-cased-meetingbank` |
| 分段差异化压缩 | `<llmlingua, compress=False>…</llmlingua>` / `<llmlingua, rate=0.4>…</llmlingua>` 标签，可对"问题/指令"不压缩、只压"检索正文" |
| 官方示例的实测数字 | `origin_tokens: 2365 → compressed_tokens: 211`，`ratio: "11.2x"`，`saving: "Saving $0.1 in GPT-4"` |

### 1.3 ⚠️ 质量损失的**可见证据**（重要，用于劝退误用）

同一条官方 README 示例里，压缩后的文本已经**语法破碎、数字疑似受损**：
> 原文示例压缩结果：`He reanged five of boxes into packages of sixlters each and sold them $3 per.`

- 结论（本次观察，非引用）：LLMLingua 系列是**token 级删除**，压缩后文本**不能给人读**，也不适合需要逐字引用、审计留痕、含金额/编号/代码的场景。`官方`（示例本身即证据）
- LLMLingua-2 论文明确把"**faithfulness**（忠实于原文）"作为设计目标（token 分类而非自由生成）→ 说明忠实度是这一系列公认的痛点。[arXiv:2403.12968](https://arxiv.org/abs/2403.12968) `论文`

---

## 2. 上下文蒸馏与选择性上下文

| 方法 | 发表 | 原理 | 量化压缩率 | 质量损失 | 适用条件 | 来源与性质 |
|---|---|---|---|---|---|---|
| **Selective Context** | EMNLP 2023 | 用自信息量/冗余度**剪除输入上下文中的冗余 token**，使输入更紧凑（无需训练） | **context cost −50%**（约 2x） | 显存 **−36%**、推理时间 **−32%**；代价：BERTScore **−0.023**、faithfulness **−0.038**（4 个下游应用，含摘要/QA/回复生成） | 长文档、新闻、长对话；"无损近似"档位，适合先上 | [arXiv:2310.06201](https://arxiv.org/abs/2310.06201) `论文` |
| **RECOMP** | arXiv 2023-10（ICLR 2024） | 把检索到的文档压成**文本摘要**再入上下文：① 抽取式压缩器（选句子）② 生成式压缩器（多文档合成摘要）；两者**按下游任务效果训练**；当检索文档无关时**返回空串**（= selective augmentation） | **低至 6%**（即约 16.7x）"with minimal loss in performance" | 显著优于现成摘要模型；**在一个 LM 上训练的压缩器可迁移到其他 LM** | 需要训练压缩器（有 GPU/标注成本）；摘要式压缩有**幻觉/丢事实**风险 | [arXiv:2310.04408](https://arxiv.org/abs/2310.04408) `论文` |
| **xRAG** | NeurIPS 2024 | 把 dense retrieval 的**文档 embedding 当作"检索模态特征"**，用 modality fusion 直接注入 LM 表示空间，**取消文本对照物** | **一篇文档 → 1 个 token**（极端压缩） | 6 个知识密集任务**平均 +10% 以上**；部分数据集追平未压缩模型；整体 **FLOPs 降到 1/3.53** | 只训练 modality bridge，retriever 与 LM 全冻结；可复用离线 embedding，保持 plug-and-play | [arXiv:2405.13792](https://arxiv.org/abs/2405.13792) `论文` |

**选型提示（本文归纳）**：Selective Context ≈ 无损但只能到 2x；RECOMP 能到 16.7x 但要训练 + 有摘要幻觉；xRAG 压缩最极端但**必须自建检索与模型栈**（要改模型内部表示），外部 API 客户（调 Claude/GPT 的人）**用不了**。

---

## 3. 长上下文 vs RAG 的成本交叉点

### 3.1 本次能核实的**机制性事实**（这些才是决定成本的东西）

| 事实 | 数字/规则 | 来源与性质 |
|---|---|---|
| 提示缓存的最小可缓存长度 | 渲染后前缀**至少 1,024 token** 才可缓存 | [Microsoft Learn：Prompt caching（描述 OpenAI 服务）](https://learn.microsoft.com/en-us/azure/ai-services/openai/how-to/prompt-caching) `官方` |
| 缓存命中粒度 | GPT-5.5 及更早：首个 1,024 token 之后按 **128-token 增量**命中；GPT-5.6+ 取消该取整 | 同上 `官方` |
| 前缀稳定性 | 前 1,024 token 中**任何一个字符不同 = 缓存未命中**（`cached_tokens = 0`） | 同上 `官方` |
| 缓存价格结构 | 缓存读取"按输入 token 价的**折扣**计价"；Provisioned 部署输入 token 最高 **100% 折扣**；GPT-5.6+ **缓存写入也可能收费** | 同上 `官方`（**具体折扣百分比本次未取得**：OpenAI 官方页被 Cloudflare 拦，见 §6） |
| 缓存保留 | 内存缓存通常 5–10 分钟无活动即清除、最迟 1 小时后移除；扩展保留最长 **24 小时** | 同上 `官方` |
| 缓存调优建议 | 稳定/重复内容放**最前**、动态内容放最后；保持会话**append-only**；复用 `prompt_cache_key` | 同上 `官方` |
| Context editing 的收益 | "在 100 轮 web search 评测里，单做 context editing 就把 token 消耗降了 **84%**"；agentic search 任务 +29% | [腾讯云开发者社区转述 Anthropic 发布数据](https://cloud.tencent.cn/developer/article/2757497) `未核实`（第三方中文转述，Anthropic 官方页本次跨域重定向失败，未取得原文核对） |
| 压缩在 ~10k token 量级已划算 | 约 10k token 提示、2x–6x 压缩 → 延迟加速 1.4x–2.6x | [ACL 2024.acl-long.91](https://aclanthology.org/2024.acl-long.91/) `论文` |

### 3.2 为什么"多少 token 以上 RAG 更划算"**不能只按 token 数回答**

本次**没有取得**任何官方单价页（OpenAI 403、Anthropic 跨域重定向、Google 抓取失败），因此**不编造 $ 数字与 token 阈值**。可交付的是这个可现场复算的模型：

```
总成本 ≈ 平均上下文长度 × 调用次数 × 单价（区分：全价输入 / 缓存命中价 / 输出价）
```

| 情形 | 全量塞长上下文 | RAG / 压缩 | 谁更划算 |
|---|---|---|---|
| 同一份 N token 资料只被问 **1 次** | N × P | rN × P + 检索侧成本（embedding + 向量库 + 运维） | **全量塞**（RAG 的工程成本摊不回来） |
| 同一资料被复用 **K 次**，且**前缀稳定**（缓存命中） | N × P_cache × K + 首次写缓存 | rN × P × K' + 检索侧 | K 越大越偏向 **缓存**；RAG 在 r 很小时才反超 |
| 同一资料复用 K 次，但**每次开头都不同**（缓存必 miss） | N × P × K（= 最贵） | rN × P × K' | **RAG 优势最大** |
| 资料总量上千份、每份只用到一小段 | 上下文被无关内容污染，还有 context rot | 检索 + 压缩 | **RAG** |

**结论（本文归纳，非引用）**：真正的交叉点是「**重复次数 K × 前缀稳定度**」，不是文档长度；token 长度只在它决定"是否超过 1,024 token 缓存门槛"和"是否触发 context rot"时起作用。

### 3.3 可用的**有论文支撑的经验线**

- **≥10k token**：已有论文级证据表明压缩能带来 1.4x–2.6x 端到端延迟下降（LongLLMLingua）→ 建议把"单次提示 >10k token"设为**必须做压缩/检索**的红线。`论文`
- **检索文档"几百词"量级**：RECOMP 论文明确指出检索文档"often spanning hundreds of words"会让推理显著变贵，这是做摘要式压缩的动因。`论文`
- **1,024 token 以下**：连缓存都用不上（官方门槛）→ 这种小体量不值得上任何压缩工程。`官方`

---

## 4. Anthropic / OpenAI / Google 官方上下文工程指南要点

### 4.1 Anthropic（官方博客，本次抓取成功）

来源：[Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) `官方`

- **定义**：context engineering = prompt engineering 的自然演进，指在推理过程中**策划与维护最优 token 集合**的策略（含系统指令、工具、MCP、外部数据、消息历史）。
- **第一原则**：找到**能最大化期望结果的最小高信号 token 集合**（"smallest possible set of high-signal tokens"）。
- **为什么不能靠加长窗口**：**context rot**——token 越多，模型准确召回能力越下降（引 Chroma 研究）；LLM 有**注意力预算**；transformer 是 n² 对关系；长序列训练数据较少 → 形成**性能梯度而非断崖**。
- **长任务的三个手段**（官方命名，可直接作为方案目录）：
  1. **Compaction**：接近窗口上限时摘要并**重开窗口**；保留架构决策、未解 bug、实现细节，丢弃冗余工具输出；Claude Code 的做法 = 压缩上下文 **+ 最近 5 个访问过的文件**。官方建议调参顺序：**先最大化 recall，再优化 precision**。
  2. **Structured note-taking（agentic memory）**：把笔记写到上下文之外（NOTES.md / 记忆工具），需要时再拉回。
  3. **Sub-agent 架构**：子代理各自用干净窗口、可能烧掉数万 token，**只回 1,000–2,000 token 的浓缩摘要**。
- **工具结果清理（tool result clearing）**：官方称它是"**最安全、最轻量**"的压缩形式，且已作为 Claude Developer Platform 功能上线。`官方`
- **权衡**：运行时探索（just-in-time）比预取慢；建议混合——稳定内容（CLAUDE.md）预置，其余用 glob/grep 即时检索。

### 4.2 OpenAI

- 本次**未取得** OpenAI 官方页面：`platform.openai.com/docs/guides/prompt-caching` 返回 **HTTP 403（Cloudflare 拦截）**，`cookbook.openai.com` 抓取失败。→ 见 §6。
- **替代证据**：微软官方文档完整描述了 OpenAI 服务的提示缓存机制（1,024 token 门槛、128-token 增量、前缀字符级一致性、缓存写收费、24h 扩展保留、把稳定内容前置）——见 §3.1 表格。`官方`（微软文档 / 对 OpenAI 官方具体折扣数字 `未核实`）

### 4.3 Google

- 本次**两个官方入口均抓取失败**：`developers.googleblog.com/en/context-engineering-a-practical-guide-to-building-ai-agents/`（fetch failed）、`ai.google.dev/gemini-api/docs/caching`（fetch failed）、`ai.google.dev/gemini-api/docs/pricing`（fetch failed）。
- 搜索结果中出现可用的官方文档入口（**内容未抓取、数字未核实**）：[Context caching overview — Google Cloud Documentation](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/context-cache/context-cache-overview?hl=en)。→ 见 §6，建议下次优先补这一条。

### 4.4 三家共识（跨源归纳，可直接写进方案开场）

1. 上下文是**有限资源**，有边际递减 → 目标是"最小高信号集合"。
2. 稳定内容放前、动态内容放后；**保持前缀 append-only**（同时满足缓存命中与注意力结构）。
3. 超长任务不靠更大窗口，靠 **compaction / 笔记 / 子代理**三件套。
4. **工具结果**是上下文膨胀的第一来源 → 工具返回要落盘，只引用路径。

---

## 5. 可用的开源压缩库与商业实现

| 名称 | 类型 | 能力要点 | 集成/形态 | 来源与性质 |
|---|---|---|---|---|
| **microsoft/LLMLingua** | 开源（**MIT**，Python ≥3.8，v0.2.2 / 2024-04-09） | 一个库同时提供 LLMLingua / LongLLMLingua / LLMLingua-2；支持**结构化分段压缩**（对不同段落设不同 rate）；支持 **KV-Cache 压缩**加速；可选 GPT2-small、LLaMA-7B、phi-2、量化模型（<8GB 显存） | `pip install llmlingua` | [PyPI](https://pypi.org/project/llmlingua/) `官方`；[GitHub](https://github.com/microsoft/LLMLingua) `官方` |
| LLMLingua-2 权重 | 开源模型 | `microsoft/llmlingua-2-xlm-roberta-large-meetingbank`、`microsoft/llmlingua-2-bert-base-multilingual-cased-meetingbank` | HuggingFace | 同上 `官方` |
| LangChain 集成 | 开源框架集成 | LLMLingua 作为 retriever | 官方 README 列出的集成链接 | 同上 `官方` |
| LlamaIndex 集成 | 开源框架集成 | LongLLMLingua 作为 node postprocessor | 官方 README 列出的集成链接 | 同上 `官方` |
| **Anthropic Context editing + memory tool** | 商业（Claude Developer Platform，公开 beta） | ① **tool result clearing**（自动清理历史工具结果）② 文件式记忆工具（跨会话知识库） | 平台功能 | [anthropic.com/news/context-management](https://www.anthropic.com/news/context-management) `官方 URL`（**本次页面跨域重定向失败，内容未核实**）；效果数字见 §3.1 的 84% `未核实` |
| Anthropic **compaction** | 商业（Claude Code 内置） | 摘要 + 重开窗口 + 保留最近 5 个文件 | 产品内置 | [Anthropic 官方博客](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) `官方`（本次抓取成功） |
| **Google Cloud context caching** | 商业 | 上下文缓存（文档入口） | 平台功能 | [官方文档入口](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/context-cache/context-cache-overview?hl=en) `抓取失败`（数字未核实） |
| Selective Context | 开源（学术） | 2x 无损近似压缩 | GitHub（本次未抓仓库页） | [arXiv:2310.06201](https://arxiv.org/abs/2310.06201) `论文` |
| RECOMP | 开源（学术） | 抽取式/生成式摘要压缩器 | GitHub（本次未抓仓库页） | [arXiv:2310.04408](https://arxiv.org/abs/2310.04408) `论文` |
| xRAG | 开源（学术，NeurIPS 2024） | 单 token 表示文档 | GitHub（本次未抓仓库页） | [arXiv:2405.13792](https://arxiv.org/abs/2405.13792) `论文` |

> 搜索中出现的第三方"prompt caching 省钱指南"类博客（如 burnwise.io）**不建议作为引用源**，本次也未采纳其数字。

---

## 6. 抓取失败 / 未核实清单（诚实记录）

| 目标 | 结果 | 备注 |
|---|---|---|
| `platform.openai.com/docs/guides/prompt-caching` | **HTTP 403 Cloudflare** | 未重试（同站不反复试） |
| `cookbook.openai.com/examples/optimizing_latency_and_cost` | fetch failed | — |
| `docs.claude.com/en/docs/about-claude/pricing` | 跨域重定向到 `platform.claude.com`（未自动跟进） | 重试 `platform.claude.com/docs/en/about-claude/pricing` 又重定向至 `anthropic.com`，仍失败 |
| `ai.google.dev/gemini-api/docs/caching` / `/pricing` | fetch failed | Google 官方数字全部未取得 |
| `developers.googleblog.com/en/context-engineering-a-practical-guide-to-building-ai-agents/` | fetch failed | Google 上下文工程指南未取得 |
| `www.databricks.com/blog/long-context-rag-performance-llms` | HTTP 200 但**正文为空** | 未取得任何数字 |
| `www.anthropic.com/news/context-management` | 跨域重定向（claude.com）未跟进 | 84% 数字只从第三方转述取得 |
| arXiv **2411.03538**（Long Context RAG Performance of LLMs，Databricks） | **未抓取**（抓取预算耗尽） | 搜索结果中出现，本次未验证 |
| 长上下文 vs RAG 的 **$ 计 break-even 阈值** | **未取得** | 缺官方单价页 → 本报告不编造 token 阈值 |
| 各家的**缓存折扣百分比**（10% / 25% / 50% 等具体值） | **未取得** | 微软文档只说"折扣"，未给百分比 |

---

## 7. 现场检查表（把上面的证据变成能开口问的话）

### 7.1 先问三个问题（决定用哪一档手段）

1. **这份长资料，在一个会话/一天里被重复送进模型几次？**（决定缓存与 RAG 是否值得）
2. **每次请求开头那 1,024 token 是不是完全一样？**（一个字符不同 = 缓存必 miss）
3. **输出里需要逐字引用原文吗？**（决定能不能用 token 级删减）

### 7.2 按"重复次数 × 前缀稳定度"选手段

| 观察到的现象 | 先做什么（零/低质量损失） | 证据 |
|---|---|---|
| 重复 ≥3 次、前缀稳定 | 结构重排（稳定内容前置、append-only）+ 开提示缓存 | 微软官方 best practices `官方` |
| 上下文里堆着大量历史工具返回 | **先清工具结果**（Anthropic 称最安全的压缩） | Anthropic 官方博客 `官方` |
| 单次提示 >10k token | 上压缩，2x–6x，延迟可降 1.4x–2.6x | LongLLMLingua `论文` |
| 只要 2x 左右、不想损失质量 | Selective Context（−50% 成本 / 显存 −36% / 时间 −32% / BERTScore −0.023） | `论文` |
| 需要 5x 级别、可接受抽取式 | LLMLingua-2（rate=0.33 起步），注意压缩后文本不可读 | `论文`+`官方` |
| 需要"压到 6%"、且能训练 | RECOMP（抽取式→摘要式；无关文档返回空串） | `论文` |
| 需要极端压缩、有能力自建栈 | xRAG（单 token 表示文档，FLOPs 1/3.53） | `论文` |
| 含代码/金额/编号/法务/需引用 | **禁用 token 级删减**，改用"子代理摘要 + 落盘 + 路径引用" | LLMLingua 压缩示例已破碎（`官方`示例）；Anthropic 子代理模式 `官方` |
| 超长任务（>上下文窗口） | compaction + 结构化笔记 + 子代理三件套 | Anthropic 官方博客 `官方`（子代理只回 1,000–2,000 token） |

### 7.3 降本归因话术（一句话版，均有来源）

- 「撑爆成本的是**工具返回和重复上下文**，不是用户说的话」→ 先做工具结果清理与落盘（Anthropic：tool result clearing 是最轻量压缩）`官方`
- 「**token 越多，召回越差**，加长窗口不是解法」→ context rot `官方`
- 「**长上下文 vs RAG 的分界不是长度，是复用次数和前缀稳定度**」→ 缓存 1,024 token 门槛 + 字符级 miss `官方`
- 「**缓存不是万能**：GPT-5.6 之后写缓存本身也会收费，得算净收益」`官方`
- 「**压缩会伤忠实度**：2x 基本无损，5x 起必须做质量回归」→ Selective Context 2x 的损失量级 vs LLMLingua 压缩文本已破碎 `论文`+`官方`