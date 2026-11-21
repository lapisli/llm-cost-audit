<!-- 来源：2026-10-22 十四路并行调研的子代理产出，1:1 拷贝，未改写 -->
<!-- 课题：模型路由与级联 -->
<!-- 证据等级：文内每个数字都带性质标注（官方 / 论文 / 第三方实测 / 厂商宣传 / 未核实） -->
# 模型路由 / 级联：最新进展与省费率（调研报告）

> 调研时间：本机 2026 年（环境日期约 2026-10）。为一位中国吉林市的个人开发者整理，用于其「LLM 成本审计 + 降本实施」服务的检查表与话术。
> 性质标注说明：**官方** = 厂商/项目官方文档或官方博客；**论文** = 学术预印本/会议论文；**第三方实测** = 独立第三方带方法的测量或复现；**厂商宣传** = 厂商在营销语境下给出的百分比；**第三方算例** = 第三方给出的算术演示（非实测）；**未核实** = 只在一处二手来源出现、本次未回到一手页面确认。
> ⚠️ 本报告所有数字均附来源 URL。凡标注「未核实」的，**不得**直接写进给客户的报价或承诺。

---

## 0. 一句话结论（可直接用作话术）

路由不是"免费的钱"，它是**为省一笔更大的钱而新增的一笔推理成本**；只有当「强弱模型价差足够大」且「可路由流量占比足够高」时这笔账才成立 —— 而业内已有真实反例：一家网关厂商在生产上跑了 4 个月、7000 云用户后**把自己的路由器下线了**（[Manifest 官方博客](https://manifest.build/blog/why-we-deprecated-our-llm-router/)）。

---

## 1. RouteLLM（ICLR 2025）：方法、数据集、数字

### 1.1 基本事实

| 项目 | 内容 | 来源 | 性质 |
| --- | --- | --- | --- |
| 论文 | RouteLLM: Learning to Route LLMs with Preference Data，arXiv:2406.18665（v1 2024-06-26，v4 2025-02-23） | https://arxiv.org/abs/2406.18665 | 论文 |
| 团队 | LMSYS（Chatbot Arena 同一团队）：Isaac Ong、Amjad Almahairi、Vincent Wu、Wei-Lin Chiang、Tianhao Wu、Joseph E. Gonzalez、M Waleed Kadous、Ion Stoica | https://arxiv.org/abs/2406.18665 | 论文 |
| 代码/模型 | 开源框架 + 预训练路由器，Apache-2.0，OpenAI 兼容 server | https://github.com/lm-sys/RouteLLM | 官方 |
| 数据集 | Chatbot Arena 人类偏好公开数据 `lmsys/lmsys-arena-human-preference-55k`（55k 条偏好对）；另用 golden-label 数据集与 LLM judge 做数据增强 | https://www.lmsys.org/blog/2024-07-01-routellm/ · https://huggingface.co/datasets/lmsys/lmsys-arena-human-preference-55k | 官方 |
| 训练范式 | 每个数据点 = 一个 prompt + 两模型回答优劣（win/lose/tie）。四种路由器：① 相似度加权(SW)排序 ② 矩阵分解 ③ BERT 分类器 ④ 因果 LLM 分类器 | https://www.lmsys.org/blog/2024-07-01-routellm/ | 官方 |
| 任务定位 | **二元路由**：一个强模型 + 一个弱模型，目标是最小化成本同时保住质量 | https://www.lmsys.org/blog/2024-07-01-routellm/ | 官方 |

### 1.2 核心数字（这是全行业引用的"85%"的出处）

**官方博客原文数字**（强模型 GPT-4 Turbo，弱模型 Mixtral 8x7B）：

| 基准 | 官方口径 | 关键细节 | 来源 | 性质 |
| --- | --- | --- | --- | --- |
| MT Bench | 成本降低 **>85%** | 相对"全部走 GPT-4" | https://www.lmsys.org/blog/2024-07-01-routellm/ | 官方（论文同源） |
| MMLU | 成本降低 **45%** | 同上 | 同上 | 官方（论文同源） |
| GSM8K | 成本降低 **35%** | 同上 | 同上 | 官方（论文同源） |
| 质量保持 | 达到 GPT-4 性能的 **95%** | 三个基准一致口径 | 同上 | 官方 |

**拆到"GPT-4 调用占比"这一层（审计时真正要用的口径）**：

| 场景 | 达到 95% GPT-4 质量所需 GPT-4 调用占比 | 相对随机基线的成本 | 来源 | 性质 |
| --- | --- | --- | --- | --- |
| MT Bench，仅 Arena 数据训练，矩阵分解 | **26%** | 便宜约 **48%** | https://www.lmsys.org/blog/2024-07-01-routellm/ | 官方 |
| MT Bench，Arena + LLM judge 增强，矩阵分解 | **14%** | 便宜约 **75%** | 同上 | 官方 |
| MMLU，仅 Arena 数据训练 | 接近随机（**路由基本失效**） | —— | 同上 | 官方 |
| MMLU，Arena + MMLU 验证集 golden-label 增强，因果 LLM 路由器 | **54%** | 便宜约 **14%** | 同上 | 官方 |
| 增强数据规模 | 约 **1500** 条样本，不到总训练数据 **2%** | —— | 同上 | 官方 |
| 与商业路由器（Martian、Unify AI）对比 | 同等性能下便宜 **>40%** | 强模型 GPT-4 Turbo，弱模型 Llama-2-70B 或 Mixtral-8x7B | 同上 | 厂商/项目自测（LMSYS 自比） |

> **审计要点（务必写进检查表）**：85% 这个数字**只在 MT Bench**（广泛、闲聊型问题，弱模型常常够用）成立。同一篇官方博客里 MMLU 只有 45%、GSM8K 只有 35%，而且**只用 Arena 数据训练的 MMLU 路由几乎是随机的**。客户流量离 MT Bench 分布越远（窄领域、结构化抽取、Agent 工具链），这个胜率越不迁移。

### 1.3 泛化能力（换模型对，不重训）

| 结论 | 数字/描述 | 来源 | 性质 |
| --- | --- | --- | --- |
| 换模型对不重训 | 强模型 Claude 3 Opus + 弱模型 Llama 3 8B，**不做任何重训练**，MT Bench 表现与原模型对相当；这两个模型的回答**不在训练数据里** | https://www.lmsys.org/blog/2024-07-01-routellm/ | 官方 |
| 论文摘要口径 | "显著降本 —— 某些情况下**超过 2 倍** —— 且不牺牲质量" | https://arxiv.org/abs/2406.18665 | 论文 |

### 1.4 RouteLLM 当前维护状态（卖服务前必须知道）

| 结论 | 来源 | 性质 |
| --- | --- | --- |
| 官方仓库自 **2024 年 8 月**起未更新；其数字是在 2024 年模型格局下测的（强模型 GPT-4、弱模型差得多）；作为 2026 年的**生产基础设施已无人维护**，但作为研究与评测基座仍可用 | https://www.toolbit.ai/blog/ai-model-routers-tools-that-choose-the-right | 第三方（未核实，未回到 GitHub 确认提交时间） |

---

## 2. 商业路由产品：形态与报价

### 2.1 总览表

| 产品 | 形态 | 显式路由费 | 路由依据 | 来源 | 性质 |
| --- | --- | --- | --- | --- | --- |
| **OpenRouter Auto Router** | 托管聚合器上的一个模型 slug（`openrouter/auto`，另有 beta 轨 `openrouter/auto-beta`） | **无额外费用**（"You pay the standard rate for whichever model is selected. There is no additional fee for using the Auto Router."） | 市场信号：约 30 个任务类型 + 该任务近 7 天社区**花费份额**排名 | https://openrouter.ai/docs/guides/routing/routers/auto-router.md | 官方 |
| **Not Diamond** | 托管推荐 API（返回模型建议，你自己调用模型、用自己的 key）；另开源部分研究栈 RoRF | **$0.05 / 百万 token 路由量**（Pay-as-you-go） | 自训练 router（embedding + 随机森林 + 置信阈值 / 自定义评测数据） | https://www.notdiamond.ai/pricing | 官方 |
| **Martian** | 曾是托管路由端点（闭源 "model mapping"） | 价格页 `/pricing` 返回 **404**（本次抓取失败） | —— | https://withmartian.com/pricing（404） | 抓取失败 |
| **AWS Bedrock Intelligent Prompt Routing** | 一个 serverless 端点，在**同一模型家族的两模型**之间路由 | 官方定价页本次**抓取失败**（内容被截断，未取到路由费条目）；文档未提到额外路由费 | Bedrock 预测各模型对该 prompt 的响应质量 → 按"质量差阈值"决定是否切换 | https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-routing.html | 官方（费用部分抓取失败） |
| **Azure Model Router（Microsoft Foundry）** | 打包成**一个 Foundry 模型部署**（版本 `2025-11-18` 为最新） | 官方概念页："Model router usage is charged for input prompts at the rate listed on the pricing page."（即按输入 prompt 计费，费率见定价页；定价页本次未抓） | 训练好的路由模型，按 prompt 复杂度/推理需求/任务类型实时选模型 | https://learn.microsoft.com/en-us/azure/ai-foundry/openai/concepts/model-router | 官方 |

### 2.2 OpenRouter Auto Router 细节（官方文档）

| 项目 | 内容 | 来源 | 性质 |
| --- | --- | --- | --- |
| 分类粒度 | 每个 prompt 归入 **约 30 个细粒度任务类型**，如 `code:debugging`、`agent:multi_step_planning`、`qa_knowledge`、`math`、`customer_support`、`research_report` | [官方文档](https://openrouter.ai/docs/guides/routing/routers/auto-router.md) | 官方 |
| 排名信号 | 该任务类型下社区**近 7 天窗口**的"花费份额"（Share of Spend）；开发者迁移到新模型后，路由器"数天内"跟随，无需重训 | 同上 | 官方 |
| 成本档位 | `cost_tier`：`low` / `medium` / `high` / `xhigh` / `max`；**不设置时约等于 `low` 档**。档位是"带"不是上限，比该带更便宜的模型同样被排除 | 同上 | 官方 |
| 模型白/黑名单 | `allowed_models` / `excluded_models`，支持通配（`anthropic/*`、`openai/gpt-5*`、`*/claude-*`）；排除后若无可选模型，请求以 **404** `No models match your request and model restrictions` 失败 | 同上 | 官方 |
| 会话粘性 | 记住会话落到哪个模型，后续轮次优先复用，但**每轮仍从零排名**；任务类型变了可能换模型 | 同上 | 官方 |
| 降级行为 | 分类或排名不可用时**优雅降级到默认模型集合**，"请求永不因路由基础设施抖动而失败" | 同上 | 官方 |
| 元数据 | 加 `X-OpenRouter-Metadata: enabled` 头可在 `openrouter_metadata.pipeline` 的 `data.task_type` 看到分类结果 | 同上 | 官方 |
| 平台费用（非路由费） | 第三方文章称 OpenRouter 对**购买 credits** 收 5.5%（最低 $0.80）、对 BYOK 超额度部分收 5% | https://www.toolbit.ai/blog/ai-model-routers-tools-that-choose-the-right | 第三方（未核实，未回到 OpenRouter FAQ 确认） |

**⚠️ 重要纠错素材**：网上流传"OpenRouter Auto Router 加价 10%"之类的说法；其**官方文档现明确写"无额外费用"**（链接同上）。审计时以官方文档为准。

### 2.3 Not Diamond 关键数字（官方）

| 项目 | 数字/描述 | 来源 | 性质 |
| --- | --- | --- | --- |
| 路由费 | **$0.05 / 百万 token 路由量** | https://www.notdiamond.ai/pricing | 官方 |
| 自报省费 | 使用的团队"至少 **20–40%** 成本节省，常常更多，且相对前沿模型无质量下降" | 同上 | **厂商宣传** |
| ROI 口径 | "最保守情况下，相对我们带来的节省提供 **10x ROI**" | 同上 | **厂商宣传** |
| 额外延迟 | 平均每请求增加 **100–150ms** | 同上 | 官方（自报） |
| 定位 | **不是网关**：接入你已有的网关；网关管访问，路由管"用哪个模型" | 同上 | 官方 |
| 算法输入 | payload 语义、KV cache 状态、隐式反馈信号、会话结果、子 agent 架构、compaction 事件、历史全部轮次 | 同上 | 官方 |
| 隐私模式 | privacy-preserving routing：只用派生元数据 + 本地计算特征，不看 payload；官方称不降低路由质量 | 同上 | 官方（自报） |
| 合规 | SOC-2、ISO 27001 | 同上 | 官方 |
| 场景 | 自称专为**长周期 coding agent** 工作负载打造，兼容多种 coding agent harness，兼容 Claude Code | 同上 | 官方 |
| 产品现状补充 | 2026-08 推出 Not Diamond Code；在 AWS Marketplace 上架 | https://www.toolbit.ai/blog/ai-model-routers-tools-that-choose-the-right | 第三方（未核实） |

### 2.4 AWS Bedrock Intelligent Prompt Routing（官方文档）

| 项目 | 内容 | 来源 | 性质 |
| --- | --- | --- | --- |
| 形态 | 单一 serverless 端点；**必须在同一模型家族内**选**恰好两个模型**；可自定义 fallback 模型 | https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-routing.html | 官方 |
| 支持的模型（截至抓取） | Amazon **Nova Lite**、**Nova Pro**；Meta **Llama 3.1 70B Instruct**、**Llama 3.1 8B Instruct**、**Llama 3.3 70B Instruct** | 同上 | 官方 |
| 默认路由器 | 开箱即用，使用 Nova / Llama 家族中的选定模型，可用性随 Region 变化 | 同上 | 官方 |
| 路由准则 | `responseQualityDifference` 阈值：如设 **10%** 且 fallback 为 Nova Lite，则只有当 Nova Pro 的**预测质量比 Nova Lite 高 10% 以上**才切换 | 同上 | 官方 |
| API 示例参数 | `--routing-criteria '{"responseQualityDifference": 0.5}'` | https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-routing.md | 官方 |
| **硬限制 1** | **只针对英文 prompt 优化**（"only optimized for English prompts"）| 同上 | 官方 |
| **硬限制 2** | **不能**基于应用自有的性能数据调整路由决策或回答 | 同上 | 官方 |
| **硬限制 3** | 对独特/专用场景不一定最优；效果取决于初始训练数据 | 同上 | 官方 |
| 响应内容 | 返回体包含实际使用的模型与路由准则信息 | 同上 | 官方 |
| 上线时间/宣传 | 最早以 Preview 形式随 re:Invent 发布（含 Prompt Caching） | https://dev.classmethod.jp/articles/amazon-bedrock-intelligent-prompt-routing-preview/ | 第三方（未核实） |
| 省费数字 | 官方文档**未给出具体省费百分比**；定价页本次抓取失败 | —— | **抓取失败** |

### 2.5 Azure Model Router（Microsoft Foundry，官方文档）

| 项目 | 内容 | 来源 | 性质 |
| --- | --- | --- | --- |
| 形态 | 一个**训练好的语言模型**，作为单个 Foundry 模型部署；你不再单独部署底层模型（Claude 例外，需自己先部署） | https://learn.microsoft.com/en-us/azure/ai-foundry/openai/concepts/model-router | 官方 |
| 版本 | 当前 `2025-11-18`（active，原地追加新模型）；`2025-08-07`、`2025-05-19` 已冻结 | 同上 | 官方 |
| 三种路由模式 | **Balanced**（默认）：只在"最高质量模型 ±**1%–2%**"的质量带内挑最省钱的；**Cost**：质量带放宽到 **±5%–6%**；**Quality**：直接选最高质量，忽略成本 | 同上 | 官方 |
| 自动故障转移 | 默认开启；自定义部署时你选的 model subset 同时充当 fallback 集合 —— 官方建议**至少选 2 个模型**才有 fallback 能力 | 同上 | 官方 |
| 缓存 | 支持 prompt caching（取决于被选中的底层模型）；因路由可能逐轮换模型，缓存收益只在"同一模型处理连续请求且前缀重叠"时出现；可用 **session affinity（sticky）** 提高缓存复用机会，但**不保证命中** | 同上 | 官方 |
| Session affinity 细节 | 关联在最后一次成功请求后建立，**30 分钟**无成功请求即过期；Chat Completions 无状态，默认每轮独立评估 | https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/model-router | 官方 |
| **硬限制 1（最容易踩）** | 路由器的有效上下文窗口 = **最小底层模型的上下文窗口**：更大上下文的调用**只有恰好被路由到支持它的模型时才成功** | https://learn.microsoft.com/en-us/azure/ai-foundry/openai/concepts/model-router | 官方 |
| **硬限制 2** | 视觉输入：接受图片，但**路由决策只看文本**；不支持音频 | 同上 | 官方 |
| 配额 | 按订阅 tier：Tier 1 = 1,000 RPM / 1,000,000 TPM（Global Standard），最高 Tier 6 = 15,000 RPM / 15,000,000 TPM | 同上 | 官方 |
| 计费 | "usage is charged for input prompts at the rate listed on the pricing page." | 同上 | 官方 |
| 成本监控 | Azure Portal → Cost analysis → 按 Tag(`Deployment`) 过滤到该 router 部署名 | https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/model-router | 官方 |
| 上线时间 | 概念页/操作页最后更新日期为 **2026-09-01 / 2026-09-10**，属 2026 年在营产品 | 同上 | 官方 |
| 支持的模型清单 | 文档列出的 `2025-11-18` 支持清单包含 OpenAI（`gpt-6-astra`、`gpt-5.6-sol/terra/luna`、`gpt-5.5`、`gpt-5.4(-mini/-nano)`、`gpt-5.2`、`gpt-5(-mini/-nano)`、`o4-mini`、`gpt-4.1(-mini/-nano)`、`gpt-4o(-mini)`、`gpt-oss-120b）、Anthropic（`claude-fable-5-1`、`claude-opus-5`、`claude-sonnet-5`、`claude-opus-4-8/-7/-6`、`claude-sonnet-4-5`、`claude-haiku-4-5`）、xAI（`grok-4.6`、`grok-4-1-fast-reasoning`、`grok-4`）、Fireworks（`FW-GLM-5.3`、`FW-GLM-5.3-Flash`、`FW-Kimi-K3`）、DeepSeek（`DeepSeek-V3.2`）、Meta（`Llama-4-Maverick-17B-128E-Instruct-FP8`） | 同上 | 官方（**型号名以文档为准，本次未独立交叉验证**） |
| 官方评测建议 | "把初始部署当作起始配置；在生产流量前，对照当前模型跑质量、估算成本、延迟的 benchmark，再决定保留配置 / 改一个路由旋钮 / 部分工作负载继续直连模型" | https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/model-router | 官方 |

> **给审计服务的直接弹药**：Azure 官方自己在文档里给了"**先 benchmark 再上生产**"的流程，并且给了三个旋钮（routing mode / model subset / session affinity）。这可以直接抄成客户检查表。

---

## 3. 小模型级联：实测省费与质量保持

### 3.1 三家小模型的价格位置（口径以厂商页为准）

| 模型 | 价格 | 来源 | 性质 |
| --- | --- | --- | --- |
| Claude Haiku 4.5 | **$1 / $5** 每百万 token（输入/输出） | 转引自 https://www.toolbit.ai/blog/ai-model-routers-tools-that-choose-the-right（原文称可在厂商定价页验证） | 第三方引用（未核实；claude.com/pricing 本次抓到的是导航壳，未取到 API 价目表） |
| Claude Opus 5（2026-07-24 发布） | **$5 / $25** 每百万 token | 同上 | 第三方引用（未核实） |
| GPT-5.2（旗舰） | **$1.75 / $14** 每百万 token | 同上 | 第三方引用（未核实） |
| gpt-5-nano（最小） | **$0.05 / $0.40** 每百万 token | 同上 | 第三方引用（未核实） |
| DeepSeek flash | **$0.15**（off-peak 未缓存输入）/ **$0.60**（输出）每百万 token | 同上 | 第三方引用（未核实） |
| Gemini 2.5 Flash-Lite | 未能取到价格（`ai.google.dev/gemini-api/docs/pricing` 与 Google 官方博客 **两次抓取失败**） | —— | **抓取失败** |
| GPT-4o mini | 未能取到价格（`developers.openai.com` 返回 **403 Forbidden**） | —— | **抓取失败** |

> **口径提醒**：上表除 Claude/Azure 官方文档内文以外，均由一篇第三方文章转引。给客户出账单前**必须**回到厂商定价页现场截证。

### 3.2 级联省费的算术（第三方算例，非实测）

一个客服机器人工作负载：**10,000 请求/天，每请求约 1,500 输入 token + 300 输出 token**。

| 全部走 | 单请求成本 | 每日成本 |
| --- | --- | --- |
| GPT-5.2 | $0.0068 | **$68.25** |
| gpt-5-mini | $0.0010 | **$9.75** |
| gpt-5-nano | $0.0002 | **$1.95** |

- **路由承诺**：把"简单"的 **70%** 送 nano、难的后 30% 留给 GPT-5.2 → 混合成本约 **$21.84/天**，约 **-68%**。
- **同一套配置若只有 20% 流量真"简单"** → 只省约 **19%**。
- 来源：https://www.toolbit.ai/blog/ai-model-routers-tools-that-choose-the-right ｜性质：**第三方算例**（按公开价目表计算，非真实部署实测）。
- 价格跨度话术：同一句一句话问题，"$0.0004 vs $0.007，**35 倍价差**"（同上，第三方算例）。

### 3.3 LiteLLM 的生产省费（本次未能回到一手页面）

| 结论 | 数字 | 来源 | 性质 |
| --- | --- | --- | --- |
| 一次真实部署：**272,876** 个请求、**450+** 用户、近 **4 个月**，Auto Router 实付 **$11,736**，而"全部走旗舰档"的反事实成本为 **$23,985** → 省 **51%**；**95%** 的请求从未需要旗舰模型 | —— | 转引自 https://www.toolbit.ai/blog/ai-model-routers-tools-that-choose-the-right，原始出处 https://docs.litellm.ai/blog/auto-router-production-savings | 第三方转引（**未能核实**：原始 URL 两次抓取失败） |
| 另一次 Terminal-Bench 运行：匹配 Claude Opus 5 的任务解决率，成本低 **27%** | —— | 同上 | 第三方转引（未核实） |

> 这是全报告**最有价值的第三方实测候选**（方法学披露、反事实用同样 token 数计价），但本次没能打开原始页面。**建议下一位代理优先补抓** `https://docs.litellm.ai/blog/auto-router-production-savings`。

### 3.4 级联/路由被**成本算术反杀**的场景：prompt cache（关键检查项）

| 结论 | 数字 | 来源 | 性质 |
| --- | --- | --- | --- |
| cache read 成本 = 基础输入价的 **0.1x**（Claude API 与 OpenAI GPT-5 家族均约 10%） | 0.1x | https://www.toolbit.ai/blog/ai-model-routers-tools-that-choose-the-right；Manifest 官方另称缓存读取比未缓存输入便宜 **75%–90%** | 第三方 + 官方 |
| 典型 coding agent 单步：前缀约 **126,000** token，输出仅约 **250** token → **99%+ 输入是已发过的上下文** | 126,000 / 250 | https://www.toolbit.ai/blog/ai-model-routers-tools-that-choose-the-right | 第三方（引"2026 年一份广泛引用的 trace 研究"，未核实） |
| 算例：留在 Opus 5 且缓存热（126,000 × 10% × $5/M ≈ $0.063，加新增与输出 ≈ **$0.074/步**） | $0.074 | 同上 | **第三方算例** |
| 同一算例：路由到"更便宜"的 Sonnet 5，但缓存冷（约 127,000 × $3/M ≈ **$0.38/步**） | $0.38（约 **5 倍**） | 同上 | **第三方算例** |
| **可写成规则的结论** | 切换只在"目标模型的**未缓存**输入价 > 当前模型的 **10 倍**"时才划算 | 同上 | 第三方推导 |
| 家族内几乎不成立 | Haiku $1 打不过热的 Opus 缓存（$5 的 10% = $0.5） | 同上 | 第三方推导 |
| 官方也承认这点 | OpenRouter Auto Router 文档与 toolbit 均提到"重建输入缓存时成本上升"，官方用 session stickiness 让多轮会话留在同一模型 | https://openrouter.ai/docs/guides/routing/routers/auto-router.md · Azure 同理由官方明说 | 官方 |

---

## 4. 路由质量怎么度量（SLO / 回归检测 / A/B）

### 4.1 官方给出的度量与回归手段

| 手段 | 怎么做 | 来源 | 性质 |
| --- | --- | --- | --- |
| 路由元数据可观测 | OpenRouter：`X-OpenRouter-Metadata: enabled` → 读 `openrouter_metadata.pipeline.data.task_type` | https://openrouter.ai/docs/guides/routing/routers/auto-router.md | 官方 |
| 逐请求看决策 | Azure：响应体的 `model` 字段显示实际服务模型；可开预览元数据看路由尝试、状态、延迟；`model_selection_details.model_router_details.session_affinity` 的 `decision` 取值 `initialize` / `retain` / `switch` | https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/model-router | 官方 |
| 指标监控 | Azure Monitor → Metrics，按 router 部署名过滤，并按底层模型**拆分** | 同上 | 官方 |
| 成本监控 | Azure Cost analysis → Tag `Deployment` = router 部署名 | 同上 | 官方 |
| 评测流程（官方话术） | 先 benchmark 对照现有模型（质量 / 估算成本 / 延迟），再决定留配置、改一个旋钮、或部分工作负载直连 | 同上 | 官方 |
| 路由准则本身是 SLO 旋钮 | AWS：`responseQualityDifference`（示例 10%）就是"质量差容忍度" | https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-routing.md | 官方 |
| 质量带即容忍度 | Azure Balanced = 1–2% 质量带；Cost = 5–6% 质量带 | https://learn.microsoft.com/en-us/azure/ai-foundry/openai/concepts/model-router | 官方 |
| 评测单位要变成"**模型 × 路由 × 任务**" | 除测每个模型，还要回放主模型限流、区域故障、配额耗尽、上下文过长、工具不兼容；检查：强模型失败后未完成上下文是否正确交接、不同模型结构化输出是否兼容、切换后是否**重复执行外部工具** | https://developer.aliyun.com/article/1761829 | 第三方（工程实践文章） |
| 每次运行要留的字段 | `task_type`、`policy_version`、`candidate_models`、`chosen_model`、`route_reason`、`eval_version` + 人工修订 | 同上 | 第三方 |
| 报表维度 | 任务级成功率、**高风险漏检率**、人工接管率、单任务成本、**路由切换率**、切换前后质量差 | 同上 | 第三方 |
| 测前必做（最便宜的实测法） | 取样 **100–300 条真实 prompt**，回放同一集合于当前模型 + 2~3 个候选模型；每条记录四项：成本（读 API usage 字段）、墙钟延迟、可判定质量信号（代码用单测、抽取用 schema 校验、文案用 rubric）、失败（拒答/空输出/格式错） | https://www.toolbit.ai/blog/ai-model-routers-tools-that-choose-the-right | 第三方（方法学建议，可复现） |
| 判定阈值 | 若"便宜模型达标占比"**< 40%** → 路由收益很小，"固定便宜优先 + 失败升级"可能更好；若 **≥ 70%** → 路由（或干脆硬编码便宜默认）是最高 ROI 的改动之一 | 同上 | 第三方（经验阈值，未核实） |

### 4.2 机器可读路由门禁（可直接抄成客户交付物）

第三方工程文章给出的最小实现（性质：第三方示例代码，可直接改造）：

```python
TASK_POLICY = {
    "log_summary":       {"min_score": 0.78, "max_data_level": 2, "allow_fallback": True},
    "test_case_expand":  {"min_score": 0.84, "max_data_level": 2, "allow_fallback": True},
    "permission_review": {"min_score": 0.93, "max_data_level": 1, "allow_fallback": False},
    "release_advice":    {"min_score": 0.95, "max_data_level": 1, "allow_fallback": False},
}
# score 必须是"企业自己任务集"的评测结果，不是公开榜单分
# 无合格模型时返回 human_handoff / defer —— "停止"也是正确路由
```

来源：https://developer.aliyun.com/article/1761829 ｜性质：第三方

核心原则（可作话术）：**成本优化必须在"质量合格集合"之内进行** —— 先筛出满足安全与质量下限的候选，再在候选内优化成本/延迟/容量；**不是**先找最便宜的再看质量能不能接受。

---

## 5. 路由失败的真实事故与坑

### 5.1 高质量事故案例（强烈建议做成案例页）

**案例 A：同一测试助手"上午满分、下午降级"（静默降级）**
- 现象：企业 AI 测试助手上午分析权限需求能指出"普通客服不得导出完整手机号"；下午高峰期主模型限流，路由器自动切到轻量模型 → **接口仍返回 200、响应甚至更快**，但只生成了页面按钮用例，**没覆盖后端越权导出**。
- 平台可用率没下降，**质量静默降级**。
- 折成数字的风险：文章明确写"若成本下降 30%，但权限漏检从 **0.5% 升到 3%**，这不是优化"。
- 来源：https://developer.aliyun.com/article/1761829 ｜性质：第三方（工程实践/观点文章，日期 2026-09-09；含作者自述场景，非公开事故报告）

**案例 B：网关厂商自己下线路由器（Manifest）**
- 时间线：**2026-03 上线** → **2026-06 弃用** → **2026-09-01 彻底关停**；期间覆盖 **7000 云用户**、**4 个月**使用。
- 官方给出的四条理由：
  1. **复杂度无法仅从 prompt 推断**：prompt 只是触发器，决定复杂度的上下文常要靠后续 tool call / 联网检索才发现（"评估 $GIT_REPO 的测试并改进" 对纯 HTML5 个人站很简单，对 Linux 内核极难）。
  2. **缓存比路由更有效地降本**：缓存读取比未缓存输入便宜 **75%–90%**；前缀缓存在 prompt 开头极有效。**一个"cache-aware 的路由器"会加粘性、一直问同一个模型 —— 它靠"不做路由"来完成工作。**
  3. **路由破坏行为一致性**：工程师在会话中途跳模型会降低整体工作质量，并让人脱离对工具的掌握。
  4. **不确定性本身有成本**：自动 agent 流程里，管理这层额外不确定性（eval、system prompt、可观测性）**可能比省下的更多**；"省下的钱会在别处付掉，而那笔成本更难估"。
- 来源：https://manifest.build/blog/why-we-deprecated-our-llm-router/ ｜性质：**官方**（厂商自述，发布日期 2026-07-31）

**案例 C：中立基准打脸"最贵的最会省钱"**
- RouterArena（arXiv:2510.00202，首个开源路由器对比平台，含 22 页/13 图/9 表）建成后，第三方文章转述其结论：**没有任何路由器在所有指标上最优**；且**某领先商业路由器排到第 12 名**，原因是**过度选择昂贵模型** —— "你买来防止多付钱的东西，在中立基准上正是那个多付钱的"。
- 来源（平台本身）：https://arxiv.org/abs/2510.00202 ｜性质：论文
- 来源（"12 名"与结论转述）：https://www.dreaming.press/posts/2026-06-21-routellm-vs-notdiamond-vs-martian.md ｜性质：第三方（**未核实**：未打开 RouterArena 排行榜逐项确认名次与厂商名）
- 同一篇第三方文章还指出：RouteLLM 的 85%、NotDiamond 的 20–40%、Martian 的"最高 97%"**全部由卖路由的一方自己测**。

### 5.2 坑清单（可直接做成客户检查表条目）

| # | 坑 | 证据 | 来源 | 性质 |
| --- | --- | --- | --- | --- |
| 1 | **静默降级**：限流触发换模型，HTTP 200 掩盖质量下滑 | 案例 A | https://developer.aliyun.com/article/1761829 | 第三方 |
| 2 | **重启 prompt cache 反而更贵**：换模型即冷缓存，命中 0.1x → 1.0x；只有 >10 倍价差才划算 | §3.4 | https://www.toolbit.ai/blog/ai-model-routers-tools-that-choose-the-right | 第三方算例 |
| 3 | **上下文窗口被最小模型卡住**：Azure 明确"更大上下文的调用只有恰好路由到支持它的模型才成功" | Azure 概念页 | https://learn.microsoft.com/en-us/azure/ai-foundry/openai/concepts/model-router | **官方** |
| 4 | **Agent 循环中途换模型降低整体质量**：Manifest 观察到（独立于成本）| 案例 B | https://manifest.build/blog/why-we-deprecated-our-llm-router/ | 官方 |
| 5 | **路由决策可能重复执行外部工具 / 结构化输出不兼容** | 案例 A 的检查项 | https://developer.aliyun.com/article/1761829 | 第三方 |
| 6 | **英文以外不适用**：Bedrock 智能路由**只针对英文优化**（对中国客户是致命项） | AWS 文档 | https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-routing.md | **官方** |
| 7 | **路由器无法吸收你的业务反馈**：Bedrock"不能基于应用自有性能数据调整路由决策" | 同上 | 同上 | **官方** |
| 8 | **模型名单本身是漂移源**：Azure `2025-11-18` 版本是"原地追加新模型"；若开 Auto-update，底层模型集合变化**会影响整体性能与成本** | Azure 概念页 | https://learn.microsoft.com/en-us/azure/ai-foundry/openai/concepts/model-router | **官方** |
| 9 | **限制池子会直接把请求打挂**：OpenRouter `allowed_models` + `excluded_models` 过滤后无可用模型 → **404** | OpenRouter 文档 | https://openrouter.ai/docs/guides/routing/routers/auto-router.md | **官方** |
| 10 | **插件 id 写错会被静默忽略**：`openrouter/auto` 只读 `auto-router` 的设置，`auto-beta` 只读 `auto-beta-router`；发错 id "accepted but silently ignored"，`allowed_models`/`excluded_models`/`cost_tier` 全部失效 | 同上 | 同上 | **官方** |
| 11 | **路由器自身也是成本与延迟**：NotDiamond 自报每步 +100–150ms；第三方称 100–200ms/step | NotDiamond 官方 FAQ | https://www.notdiamond.ai/pricing | 官方（自报） |
| 12 | **供应商数字不可直接采信**：RouterArena 无全指标最优；商业路由器因过度选贵模型排第 12 | §5.1 案例 C | https://arxiv.org/abs/2510.00202 + https://www.dreaming.press/posts/2026-06-21-routellm-vs-notdiamond-vs-martian.md | 论文 + 第三方 |
| 13 | **"路由"一词被混用**：网关(规则路由) / 分类器路由 / 任务级评测与市场信号 / provider 路由是四件不同的事；卖"routing"前必须问清是哪一种 | 分类法 | https://www.toolbit.ai/blog/ai-model-routers-tools-that-choose-the-right | 第三方 |
| 14 | **资产易腐**：Manifest 案例 + RouteLLM 停更 + Martian 转向（第三方称其已改定位为"可解释性研究实验室"，路由不再是门面）—— 2024/2025 年的路由选型文章**已经过期** | —— | https://www.toolbit.ai/blog/ai-model-routers-tools-that-choose-the-right | 第三方（未核实 Martian 现状） |

---

## 6. 直接可用的结论卡（给他做服务话术）

1. **"85% 省费"是 MT Bench 数字**，同源官方数字在 MMLU 是 45%、GSM8K 是 35%，且 MMLU 上只训 Arena 数据等于随机路由。客户问"能省 85% 吗"——答案是"取决于你的流量像不像 MT Bench"。来源：RouteLLM 官方博客 / 论文。
2. **路由器本身常常不收费**（OpenRouter 官方明示无额外费用；Azure 按输入 prompt 费率计费；NotDiamond 收 $0.05/百万 token 路由量）。**真正的隐形成本是延迟、缓存重建、以及质量尾巴**。
3. **先算 cache，再谈路由**：cache read 0.1x vs 冷路由 1.0x，只有目标模型未缓存输入价 > 当前 10 倍才划算；同一厂牌家族内基本不成立。**会话粘性（sticky session）是标配，不是可选项。**
4. **小模型级联的正确提问不是"哪个小模型便宜"，而是"我的流量里有多大比例真的可降"**：70% 可降 → 约 -68%；20% → 约 -19%（第三方算例）。
5. **交付物 = 机器可读路由门禁 + 回归回放**：任务分级（数据等级、风险等级、是否允许自动执行、最低评测版本、是否允许 fallback）+ 100–300 条真实 prompt 回放 + 路由级字段留痕（`chosen_model`/`route_reason`/`eval_version`）。
6. **平台硬限制先过一遍再谈省钱**：Bedrock 只优化英文、不能用你自己的性能数据；Azure 上下文窗口被最小底层模型卡住；OpenRouter 限制池子写错会 404 或静默失效。

---

## 7. 抓取失败与未核实清单（供下一位代理接手）

**抓取失败（本次未取到）**
1. `https://developers.openai.com/api/docs/models/gpt-4o-mini` → **403 Forbidden**
2. `https://www.anthropic.com/pricing` → 跨域重定向到 `claude.com` 未跟随；`https://claude.com/pricing` 抓到的是导航壳，**未取到 API 价目表**
3. `https://ai.google.dev/gemini-api/docs/pricing` → **fetch failed**
4. `https://developers.googleblog.com/en/gemini-25-flash-lite-is-now-stable-and-generally-available/` → **fetch failed**（Gemini 2.5 Flash-Lite 的 GA 公告与价格均未取到）
5. `https://withmartian.com/pricing` → **404**
6. `https://docs.aws.amazon.com/bedrock/latest/userguide/`（用户指定的 intelligent-prompt-routing 路径）→ 只返回标题被截断，改走 `prompt-routing.html` 才成功；**AWS 路由的官方收费口径未取到**
7. `https://aws.amazon.com/bedrock/pricing/` → 内容截断，**未取到任何价目**
8. `https://docs.litellm.ai/blog/auto-router-production-savings`（及其 `.html`）→ **两次 fetch failed**（**优先级最高的补抓项**：51% 省费的一手来源）
9. `https://learn.microsoft.com/en-us/azure/ai-foundry/openai/concepts/model-router` 的 **Azure 定价页（model router 单价）未抓**

**未核实（出现在第三方来源但未回到一手页面）**
1. Claude Haiku 4.5 = $1/$5、Claude Opus 5 = $5/$25、GPT-5.2 = $1.75/$14、gpt-5-nano = $0.05/$0.40、DeepSeek flash = $0.15/$0.60（均为第三方文章转引）
2. OpenRouter 平台费：credits 5.5%（最低 $0.80）、BYOK 超额 5%
3. LiteLLM 的 51% 生产省费（272,876 请求 / 450+ 用户 / 4 个月 / $11,736 vs $23,985）与 Terminal-Bench 27% 降本
4. RouterArena 中"某领先商业路由器排第 12、因过度选择昂贵模型"的具体名次与厂商名
5. Martian 已转向"可解释性研究实验室"、路由不再是门面
6. RouteLLM GitHub 自 2024-08 起未更新
7. "coding agent 单步 126,000 前缀 token / 250 输出 token"的原始 trace 研究
8. Not Diamond Code 2026-08 上线、上架 AWS Marketplace
9. Azure 文档中列出的模型名（`gpt-6-astra`、`gpt-5.6-sol` 等）未独立交叉验证（**但这是官方文档逐字内容，可直接引用文档 URL**）
10. Bedrock 智能路由的最初 Preview 发布时间（仅见第三方 DevelopersIO）
11. 阿里云文章为作者自述场景（非公开事故报告），其"权限漏检 0.5% → 3%"为举例数字
12. 各厂商"省费百分比"（AWS 官方文档未给百分比；Azure 未给百分比）—— **不要把任何第三方宣称的省费写成官方承诺**

---

## 8. 附：全部来源清单（按性质归类）

**论文（2）**
- https://arxiv.org/abs/2406.18665 — RouteLLM: Learning to Route LLMs with Preference Data（v4 2025-02-23）
- https://arxiv.org/abs/2510.00202 — RouterArena: An Open Platform for Comprehensive Comparison of LLM Routers（v3 2025-11-27）

**官方 / 项目方（9）**
- https://www.lmsys.org/blog/2024-07-01-routellm/ — RouteLLM 官方博客（全部核心数字）
- https://openrouter.ai/docs/guides/routing/routers/auto-router.md — OpenRouter Auto Router 官方文档（含"无额外费用"）
- https://learn.microsoft.com/en-us/azure/ai-foundry/openai/concepts/model-router — Azure Model Router 概念页
- https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/model-router — Azure Model Router 操作页
- https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-routing.html — Bedrock 智能提示路由（HTML）
- https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-routing.md — 同页 Markdown（含 `responseQualityDifference: 0.5` 示例）
- https://www.notdiamond.ai/pricing — Not Diamond 官方定价与 FAQ
- https://manifest.build/blog/why-we-deprecated-our-llm-router/ — Manifest 官方弃用说明（2026-07-31）
- https://manifest.build/blog/deprecating-rule-based-routing/ — Manifest 规则路由弃用（未抓取，文中引用）

**第三方（6）**
- https://developer.aliyun.com/article/1761829 — "同一个 AI 测试助手，上午满分、下午降级"（2026-09-09）
- https://www.toolbit.ai/blog/ai-model-routers-tools-that-choose-the-right — 路由成本算术、工具格局、缓存算例、回放方法（更新于 2026-10-06）
- https://www.dreaming.press/posts/2026-06-21-routellm-vs-notdiamond-vs-martian.md — 三方对比与 RouterArena 转述（2026-06-21，**明确标注 AI 撰写**）
- https://dev.classmethod.jp/articles/amazon-bedrock-intelligent-prompt-routing-preview/ — Bedrock 路由 Preview 发布（未抓取正文）
- https://withmartian.com/pricing — Martian 定价页（**404**）
- https://aws.amazon.com/bedrock/pricing/ — AWS Bedrock 定价（**抓取被截断**）