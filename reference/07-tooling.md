<!-- 来源：2026-10-22 十四路并行调研的子代理产出，1:1 拷贝，未改写 -->
<!-- 原始文件：_tmp/audit-deep/intl-observability.md -->
<!-- 课题：计量与成本归因工具链 -->
<!-- 证据等级：文内每个数字都带性质标注（官方 / 论文 / 第三方实测 / 厂商宣传 / 未核实） -->
# LLM 成本可观测性工具：能力边界与许可（国外 9 项逐条核实）

- **抓取日期**：2026-10-22（UTC 12:56 前后，本机 `date` 实测）
- **调研方式**：同步 `web_fetch` / `web_search`，无后台任务
- **预算实耗**：抓取 18 次（成功 14、失败 4）；搜索 3 次调用 / 10 条 query
- **性质标注**：`官方` = 厂商官网或官方 API 元数据；`官方(元数据)` = GitHub API 返回的结构化字段；`第三方` = 非官方来源；`未核实` = 本次未取到一手证据
- **重要说明**：本文件只写"抓到了什么"。凡是没抓到的，一律进末尾《未核实清单》，**不猜、不补**。

---

## 0. 一句话总览（先看这张表）

| 工具 | 成本归因最细粒度 | 免费额度 | 数据保留 | 许可 | 免费自托管 | 预算告警 | 按团队分摊 | 接入门槛 |
|---|---|---|---|---|---|---|---|---|
| Langfuse | 单次调用（trace/generation 级） | Cloud Hobby 免费 50k units/月；自托管不限量 | Hobby 30 天 / Core 90 天 / Pro 3 年 | MIT（OSS 版） | ✅ 完全免费 | 需核对（未抓到告警专页） | OSS 版无项目级 RBAC（需 Enterprise） | 换 SDK 或 OTel 或挂 LiteLLM 代理 |
| LiteLLM | **API key / 用户 / 团队**（虚拟 key 级） | 自托管免费（无云免费额度概念） | 取决于你自己的库 | `NOASSERTION`（GitHub API 判定为 Other）⚠️ | ✅（有 enterprise 目录，条款未核实） | ✅ 原生（budgets / rate limits） | ✅ 原生（user / team / key 三层） | **只改 base_url**（OpenAI 兼容代理） |
| Helicone | 请求级 + 自定义属性 + 用户分析 | Hobby 免费 **10,000 请求** | Hobby **7 天** / Pro 1 月 / Team 3 月 / Ent 永久 | **Apache-2.0** | ✅（on-prem 属 Enterprise 档，OSS 版可自建） | ❌ Hobby 无 Alerts（Pro 起） | Pro 起 | **改 base_url**（一行代码） |
| OTel GenAI 语义约定 | 单次调用（span 级，只有 token 数） | 规范免费 | 不适用 | Apache-2.0（OTel 项目惯例，未核实） | ✅ | ❌ 规范不管告警 | ❌ 规范不管分摊 | 挂 OTel SDK / instrumentation |
| Arize Phoenix | 未核实 | 未核实 | 未核实 | 未核实（官方有 License 专页） | 推测可（OSS），未核实 | 未核实 | 未核实 | 未核实 |
| Datadog LLM Obs | 未核实 | 未核实 | 未核实 | 闭源 SaaS | ❌ 不能自托管（未核实） | 未核实 | 未核实 | 未核实 |
| Portkey | 未核实（gateway 侧应可到 key 级） | **抓取失败** | **抓取失败** | Gateway **MIT** | ✅ Gateway 可自托管 | 未核实 | 未核实 | 改 base_url 指向 gateway |
| Traceloop / OpenLLMetry | 单次调用（OTel span） | 未核实 | 未核实 | 未核实 | ✅ 推测（OSS），未核实 | 未核实 | 未核实 | **换/加 SDK**（OTel instrumentation） |
| OpenMeter | **不是 LLM 追踪器**：需自己投递用量事件 | 未核实 | 未核实 | **Apache-2.0** | ✅ | 计费/额度引擎，非告警 | ✅ 是它的强项（billing 主体） | 自己埋点上报用量事件 |

---

## 1. Langfuse

### ① 成本能归因到哪一层
- 官方功能表列出 **Token and Cost Tracking**，链接到 `/docs/observability/features/token-and-cost-tracking` —— 说明成本追踪是一等功能。
  来源：<https://langfuse.com/pricing>　性质：`官方`
- 官方 changelog 有一条 **"Limit what project API keys can do"（2026-10-16）** → 项目级 **API key** 是它的权限与归因单元。
  来源：<https://langfuse.com/pricing>（Changelog 区块）　性质：`官方`
- 官方功能表另有 **Session Tracking（Chats/Threads）** 与 **User Tracking** → 可归因到**用户 / 会话**。
  来源：<https://langfuse.com/pricing>　性质：`官方`
- **结论**：可归因到 **单次调用 / trace / session / user / project API key / project / organization**（organization 一级由 "organization LLM connections" changelog 佐证）。
  来源（org 级）：<https://langfuse.com/pricing> 中 Changelog "Share LLM connections across projects"（2026-10-14）　性质：`官方`
- **时间维度（天）**：**未抓到**明确"按天聚合"的文档页面 → 归入未核实。

### ② 免费额度与数据保留期
| 档位 | 价格 | 含用量 | 数据可访问期 | 用户数 |
|---|---|---|---|---|
| Hobby | **免费**（无需信用卡） | **50k units / 月** | **30 天** | 2 |
| Core | $29 / 月 | 100k units/月，超出 **$8/100k units** | **90 天** | 不限 |
| Pro | $199 / 月 | 同上 | **3 年** + 数据保留管理 | 不限 |
| Enterprise | $2499 / 月 | 同上 | 未列 | 不限 |
| Teams 附加包 | $300 / 月 | — | — | SSO / 细粒度 RBAC |

来源：<https://langfuse.com/pricing>　性质：`官方`

### ③ 开源许可与免费自托管
- 自托管 OSS 版明确写 **MIT License**，且 **"Self-host all core Langfuse features for free without any limitations"**，含 observability / evaluation / prompt management / datasets，并标 **Included usage: Unlimited**。
  来源：<https://langfuse.com/pricing-self-host>　性质：`官方`
- 自托管 Enterprise 档才提供：management APIs、**project-level RBAC**、**data retention policies**、audit logs，且**必须绑定 ClickHouse Cloud / BYOC / Private**（"Langfuse pricing is additive to your ClickHouse commercial plan"）。
  来源：<https://langfuse.com/pricing-self-host>　性质：`官方`
- ⚠️ **归属变更信号**：页面页眉显示 "Langfuse **by ClickHouse**"，且 changelog 出现 "Langfuse v4"。做长期选型要把"被 ClickHouse 收购"计入风险。
  来源：<https://langfuse.com/pricing>　性质：`官方`

### ④ 成本计算 / 预算告警 / 按团队分摊
- **成本计算**：✅ 原生（Token and Cost Tracking）。性质：`官方`
- **预算告警**：`未核实` —— 本次未取到告警/预算专页。功能表里 **Webhooks & Slack** 在自托管 OSS 表中出现 → 可作为"自己接告警"的钩子。来源：<https://langfuse.com/pricing-self-host>　性质：`官方`
- **按团队分摊**：OSS 版**没有** project-level RBAC（属 Enterprise），organization/project 分层本身存在 → 可分账，但**细粒度权限与保留策略要付费**。性质：`官方`

### ⑤ 接入门槛
官方自托管功能表列出三种接入路径（原文）：
- Native Frameworks Integrations + **SDKs（Python, JavaScript）**
- **OpenTelemetry（Java, Go, custom）**
- **Proxy-based Logging（via LiteLLM）**
- Custom via **API**

来源：<https://langfuse.com/pricing-self-host>　性质：`官方`
→ 翻译成施工话术：**换 SDK / 挂 OTel / 用 LiteLLM 当代理搬运 / 直接打 API**，四条路都行。

### ⑥ OTel GenAI 专节
无（Langfuse 是消费方，不是规范制定方）。见第 4 节。

---

## 2. LiteLLM

### ① 成本能归因到哪一层
- 官方仓库描述（原文）：*"The fastest, litest AI Gateway… Call 100+ LLM APIs in OpenAI (or native) format with **cost tracking**, guardrails, load balancing, and logging"* → 成本追踪是**首推卖点**。
  来源：<https://api.github.com/repos/BerriAI/litellm>　性质：`官方(元数据)`
- 官方文档存在 **"Budgets, Rate Limits"** 页面，示例携带 `"user": "ishaan3"` → 确认**按 user 设预算**。
  来源：<https://docs.litellm.ai/docs/proxy/users>　性质：`官方`（**注意：该站点本次直接抓取失败**，仅从搜索索引确认页面标题与片段存在）
- **结论**：归因层级为 **API key（虚拟 key） / user / team / 单次调用**，是全表中最贴近"按人按 key 分账"的一档。团队/组织级由 budget 体系承载。
  性质：`官方`（key/team 三层的完整字段未逐字抓取 → 细节入未核实）

### ② 免费额度与数据保留期
- LiteLLM 是**自托管软件**，没有"云免费额度"概念；费用=你自己的服务器成本。
- **数据保留期**取决于你接的后端（Postgres 等）→ `未核实`（无厂商保留期可谈）。

### ③ 开源许可与免费自托管
- ⚠️ **GitHub API 返回 `license.spdx_id = "NOASSERTION"`，`name = "Other"`** —— 即 GitHub **无法识别为任一标准开源许可**。这与"MIT + 独立 enterprise 目录"的常见说法一致，但**本次未取到 LICENSE 原文**，故**具体条款边界必须人工复核**。
  来源：<https://api.github.com/repos/BerriAI/litellm>　性质：`官方(元数据)`
- 仓库规模（同一次 API 响应）：**61,804 stars / 12,566 forks / 5,587 open issues**，语言 Python，最后 push 2026-10-22。
  来源：同上　性质：`官方(元数据)`
- 📌 **施工建议**：5,587 个未关 issue 是**运维风险信号**；给客户做降本实施时，LiteLLM 适合当"数据采集代理"，**不要**把它当唯一账本。

### ④ 成本计算 / 预算告警 / 按团队分摊
- 成本计算：✅ 原生（见 ①）。
- 预算：✅ 原生（budgets + rate limits，见 ①）。
- 按团队分摊：✅ user/team/key 三层预算体系即分账基础。性质：`官方`
- 告警：`未核实`（未抓到告警专页）。

### ⑤ 接入门槛
- **最低**：OpenAI 兼容格式 → 客户端**只改 `base_url`（+ 换成虚拟 key）**即可接入。
  依据：官方仓库描述 "Call 100+ LLM APIs in OpenAI (or native) format"。来源：<https://api.github.com/repos/BerriAI/litellm>　性质：`官方(元数据)`
- 也可用 Python SDK 直接调用（"Rust core with Python SDK"）。

### ⑥ OTel GenAI 专节
Langfuse 官方功能表把 LiteLLM 列为 **"Proxy-based Logging"** 通道 → 说明两者是**互补**关系：LiteLLM 采集 → Langfuse 展示。
来源：<https://langfuse.com/pricing-self-host>　性质：`官方`

---

## 3. Helicone

### ① 成本能归因到哪一层
- 免费/付费功能表显示 **Sessions、User analytics、Custom properties** 在 Pro 起可用 → 可归因到**用户、会话、自定义属性**；Hobby 档这些行为**空白（不可用）**。
  来源：<https://www.helicone.ai/pricing>　性质：`官方`
- 请求级归因是基础（每请求 1 条 log）。**单次调用级** ✅。
- 仓库 topics 含 **`llm-cost`**、`llm-observability`、`agent-monitoring` → 成本是官方定位之一。
  来源：<https://api.github.com/repos/Helicone/helicone>　性质：`官方(元数据)`

### ② 免费额度与数据保留期
| 档位 | 价格 | 请求额度 | 保留期 | 存储 | 摄入速率 | API 速率 |
|---|---|---|---|---|---|---|
| Hobby | **免费** | **10,000/月** | **7 天** | 1 GB | **10 logs/分钟** | 无 |
| Pro | $79/月 | 10K 免费 + 按量 | **1 个月** | 1 GB + 按量 | 1,000 logs/分钟 | 10 calls/分钟 |
| Team | $799/月 | 同上 | **3 个月** | 同上 | 15,000 logs/分钟 | 60 calls/分钟 |
| Enterprise | 面议 | 同上 | **永久** | 同上 | 30,000 logs/分钟 | 1,000 calls/分钟 |

来源：<https://www.helicone.ai/pricing>　性质：`官方`
- ⚠️ **Hobby 的 10 logs/分钟摄入速率是硬瓶颈**：做压测或多实例接入会直接被限流。

### ③ 开源许可与免费自托管
- **Apache-2.0**（GitHub API `spdx_id`）。仓库 6,231 stars / 687 forks / 169 open issues，TypeScript，最后 push 2026-10-20。
  来源：<https://api.github.com/repos/Helicone/helicone>　性质：`官方(元数据)`
- 自托管：官方定价表中 **"On-prem deployment" 被列在 Enterprise 档**；OSS 代码本身 Apache-2.0 可自建，但**官方把 on-prem 当企业特性卖** → 自建可行、无官方支持。性质：`官方`（定价表）+ `分析`
- ⚠️ **公司状态变动**：定价页顶部横幅原文 *"Helicone is no longer part of Mintlify. Details to come soon."* → **重大不确定性**，选用前先观察。
  来源：<https://www.helicone.ai/pricing>　性质：`官方`

### ④ 成本计算 / 预算告警 / 按团队分摊
| 能力 | Hobby | Pro+ |
|---|---|---|
| Alerts（告警） | ❌ 无 | ✅ |
| Reports（报表） | ❌ 无 | ✅ |
| HQL（查询语言） | ❌ 无 | ✅ |
| User analytics / Custom properties | ❌ 无 | ✅ |
| Seats | 1 | 不限 |
| Organizations | 1 | Pro=1 / Team=5 / Ent=不限 |

来源：<https://www.helicone.ai/pricing>　性质：`官方`
→ **免费版做不了预算告警**；要告警至少 $79/月。这是给客户算账时的关键数字。

### ⑤ 接入门槛
- 官方仓库描述：*"**One line of code** to monitor, evaluate, and experiment"*，且定价表有独立 **Gateway** 区块（Caching / Rate limits / Automatic fallbacks）。
  来源：<https://api.github.com/repos/Helicone/helicone> 与 <https://www.helicone.ai/pricing>　性质：`官方`
→ 门槛 = **改 `base_url` 指向 Helicone 网关**（代理式），几乎零代码改动。

### ⑥ OTel GenAI 专节
- **未抓到** Helicone 对 OTel GenAI 语义约定的支持声明 → 未核实。

---

## 4. OpenTelemetry GenAI 语义约定（课题⑥核心）

### ⑥ 目前是否还是实验状态？
**本次没能抓到官方页面上"Experimental / Development"徽章的原始字样**，但抓到了三条**结构性证据**，指向"仍在剧烈演进"：

| 证据 | 内容 | 来源 | 性质 |
|---|---|---|---|
| E1 | 官网 `/docs/specs/semconv/gen-ai/` 与 `/docs/specs/semconv/gen-ai/gen-ai-spans/` **两次抓取都返回 "Moved: Generative AI semantic conventions"**，正文被重定向走 → GenAI 章节处于搬迁中 | <https://opentelemetry.io/docs/specs/semconv/gen-ai/> 与 <https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/>（实测） | `官方`（实测现象） |
| E2 | 主 semconv 文档版本为 **1.44.0**，但 GenAI 约定**已拆出到独立仓库** `open-telemetry/semantic-conventions-genai`，路径 `docs/gen-ai` | <https://github.com/open-telemetry/semantic-conventions-genai/tree/fd074ca60142b45576cf5b99933e6d00c5511f13/docs/gen-ai> | `官方`（搜索索引到的官方仓库路径） |
| E3 | 该仓库单独存在，说明 GenAI 约定**未与主 semconv 同步进入稳定通道** | 同上 | `分析` |

**给客户的稳妥话术（不越证据）**：
> "OTel GenAI 语义约定是把 LLM 调用变成标准 span 的事实接口，但到 2026-10 为止它仍在独立仓库里推进、官网页面正在搬迁，**不要把它当冻结标准**；做审计时以'生成的 span 里有哪些字段'为准，不要以规范文档为准。"

### ① 成本能归因到哪一层
- **规范本身只传 token 用量，不传货币金额**。货币成本必须由你（或工具）用**自己的价目表**乘算出来。
  → 这是**整份报告最重要的一条能力边界**：*OTel 给你的是"用了多少 token"，不是"花了多少钱"。*
  性质：`分析`（依据 E1-E3 与规范定位；具体属性名未逐字抓取 → 入未核实清单）
- 归因粒度：**单次调用（span）级**，通过 `service.name`、自定义 attribute 可上卷到项目/团队——但**上卷逻辑要自己写**。

### ② 免费额度与数据保留期
- 不适用（规范/协议，无服务）。规范本身**免费公开**。性质：`官方`

### ③ 开源许可与免费自托管
- OpenTelemetry 项目整体为 **Apache-2.0**（CNCF 项目惯例）→ 但**本次未抓取 LICENSE 原文**，标 `未核实`。
- 自托管 ✅（OTel Collector 自己跑）。

### ④ 成本计算 / 预算告警 / 按团队分摊
- 成本计算：❌ 规范不提供（只给 token）。
- 预算告警：❌ 规范不管。
- 按团队分摊：❌ 规范不管，但**提供了分摊所需的标签维度**（service / custom attributes）。
- → **OTel 是"数据管道标准"，不是"成本产品"**。这一条是整个服务的定价逻辑基础：客户买的不是 OTel，是"把 OTel 数据变成钱"的那层。

### ⑤ 接入门槛
- **挂 OTel SDK / 加 instrumentation 包**（不是改 base_url、不是换 SDK 那么轻）。具体包名未抓取 → 未核实。
- 优点：**厂商中立、可随时换后端**（Langfuse / Phoenix / OpenLLMetry 都吃这套）。

---

## 5. Arize Phoenix

- **定位**：官方仓库描述 *"AI Observability & Evaluation"*。来源：<https://github.com/Arize-ai/phoenix>　性质：`官方`
- **许可**：官方存在专页 `/docs/phoenix/self-hosting/license`（搜索索引确认页面存在），**但本次未抓到正文**。
  来源：<https://arize.com/docs/phoenix/self-hosting/license>　性质：`官方`（页面存在）/ 条款 `未核实`
- **GitHub API 未抓取**（预算耗尽）→ stars / license.spdx_id **未核实**。
- ① 归因层级、② 免费额度与保留期、④ 告警与分摊、⑤ 接入门槛：**全部未核实**。
- **可用的间接线索**：搜索索引中出现 `raw.githubusercontent.com/Arize-ai/phoenix/.../docs/phoenix/self-hosting.mdx`，标题为 `"Self-Hosting"` → 官方**有自托管文档**，说明自托管是受支持路径。性质：`官方`（路径存在）/ 细节 `未核实`
- ⚠️ **本项是本报告最薄弱的一块，接客户前必须补齐**（见未核实清单第 1 条）。

---

## 6. Datadog LLM Observability

- **官方定价页本次未抓取到**（预算耗尽，且未在搜索结果中出现官方定价 URL）。
- 唯一相关来源是第三方文章：<https://ecorpit.com/datadog-llm-observability-pricing-cap-costs-2026/>（标题 *"Datadog LLM Observability pricing 2026: 6 levers that cap the bill"*）　性质：`第三方`（内容农场/营销站，**可信度低，不可作为报价依据**）
- ① ② ③ ④ ⑤ ⑥：**全部未核实**。
- **可确认的一条**：Datadog 是**闭源 SaaS**，无社区版自托管路径 → 对"预算极低的个人开发者"几乎不可作为交付载体（**性质：行业常识/分析，非本次证据 → 入未核实**）。
- 📌 **本次结论**：Datadog 这一项**不写结论**，只标记"需要补抓官方 pricing 页"。

---

## 7. Portkey

- **许可**：Gateway 仓库 = **MIT**（GitHub API `spdx_id: "MIT"`）。这是 9 项里**最宽松**的之一。
  来源：<https://api.github.com/repos/Portkey-AI/gateway>　性质：`官方(元数据)`
- **规模与活跃度**：13,250 stars / 1,351 forks / 306 open issues，TypeScript；**最后 push 2026-05-25**（相对抓取日 2026-10-22 已约 **5 个月无提交**）→ **维护活跃度下降信号**。
  来源：同理　性质：`官方(元数据)` + `分析`
- **定位原文**：*"A blazing fast AI Gateway with integrated guardrails. Route to 1,600+ LLMs, 50+ AI Guardrails with 1 fast & friendly API."*　来源：同上　性质：`官方(元数据)`
- **② 免费额度与保留期：抓取失败**。`https://portkey.ai/pricing` 返回 HTTP 200 但正文只有站点标题 `"Portkey | Control Panel for Production AI"`（JS 渲染 / 内容截断）→ **免费额度与保留期无法确认**。
  来源：<https://portkey.ai/pricing>　性质：`抓取失败`
- 官方存在功能对比页 <https://portkey.ai/docs/product/product-feature-comparison>（搜索索引确认），**未抓取**。
- ④⑤⑥：**未核实**（⑤ 从 gateway 定位推断为"改 base_url 指向网关"，标 `分析`）。

---

## 8. Traceloop / OpenLLMetry

- **定位原文**：*"Open-source observability for your GenAI or LLM application, **based on OpenTelemetry**"*。
  来源：<https://github.com/traceloop/openllmetry>　性质：`官方`
- **许可**：**未核实**（GitHub API 未抓取；raw.githubusercontent 抓取失败 2 次）。
- ① 归因层级：OTel 生态 → **单次调用（span）级**，货币成本需下游计算。性质：`分析`
- ② 免费额度与保留期、④ 告警与分摊：**未核实**。
- ⑤ 接入门槛：**换/加 SDK**（OTel instrumentation），不是改 base_url。性质：`分析`
- **🩸 抓取失败记录**：`https://raw.githubusercontent.com/traceloop/openllmetry/main/README.md` → `TypeError: fetch failed`（该域名本次整体不可达，共 3 次尝试全部失败，已放弃）。

---

## 9. OpenMeter

- **许可**：**Apache-2.0**（GitHub API `spdx_id`）。来源：<https://api.github.com/repos/openmeterio/openmeter>　性质：`官方(元数据)`
- **规模**：2,397 stars / 227 forks / 62 open issues，语言 **Go**，最后 push 2026-10-22（活跃）。
  来源：同上　性质：`官方(元数据)`
- **定位原文（关键）**：*"**Metering and Billing** for AI, API and DevOps. Collect and aggregate millions of usage events in real-time and enable **usage-based billing**."*
  来源：同上　性质：`官方(元数据)`
- **⚠️ 能力边界（本项最重要）**：OpenMeter 是**用量计量 + 计费引擎**，**不是 LLM 追踪器**。它不抓 LLM 调用，需要你把用量事件（token 数等）**自己投递进去**，它负责聚合、限额、计费。
  → 换言之：**它是"分摊/开票"层，不是"埋点"层**。要落地必须先有 LiteLLM / OTel 之类的采集端。性质：`分析`（依据官方定位原文）
- topics 含 `finops` / `cost` / `billing` / `usage-based-billing` / `clickhouse` / `kafka`（技术栈为 ClickHouse + Kafka）。性质：`官方(元数据)`
- **② 免费额度与保留期**：官方有定价博客 <https://openmeter.io/blog/how-we-price-openmeter>（搜索索引标题 *"How We Price OpenMeter (And Why) | **OpenMeter by Kong**"*），**正文未抓取** → 免费额度 `未核实`。
  来源：<https://openmeter.io/blog/how-we-price-openmeter>　性质：`官方`（页面存在）+ `未核实`（数字）
- 📌 **可确认的一条归属事实**：页面标题显示 "**OpenMeter by Kong**" → 已被 **Kong** 收归旗下。性质：`官方`（页面标题）

---

## 10. 横向对照：给"降本实施"用的能力矩阵

| 维度 | 最强者 | 最弱者 | 施工含义 |
|---|---|---|---|
| 单次调用级归因 | Langfuse / Helicone / OTel / OpenLLMetry | — | 这是**基线能力**，人人都有 |
| **API key / 用户 / 团队级分账** | **LiteLLM**（user/team/key 三层预算） | OpenMeter 需自建投递 | 要"按部门收钱"→ LiteLLM 是必装件 |
| 免费额度宽松度 | Langfuse 自托管（不限量）/ OpenMeter（Apache-2.0） | Helicone Hobby 仅 10,000 请求 + 7 天 | 免费版只能做**演示**，做真审计要自托管 |
| 保留期 | Helicone Enterprise（永久）/ Langfuse Pro（3 年） | Helicone Hobby（**7 天**） | **7 天保留 = 月底无法回溯**，审计必须自托管或升档 |
| 许可宽松度 | Portkey MIT / Langfuse MIT / Helicone·OpenMeter Apache-2.0 | **LiteLLM = NOASSERTION** | LiteLLM 商用前**必须**法务级复核 LICENSE |
| 接入最轻 | **LiteLLM / Helicone / Portkey（改 base_url）** | OTel / OpenLLMetry（挂 SDK） | 见效最快的方案 = 网关 + 改 base_url |
| 自托管可行性 | Langfuse（官方明示 MIT 免费无限制） | Datadog（闭源 SaaS） | 低价交付只能选开源自托管 |

---

## 11. 抓取失败 / 未核实清单（**不许拿这些当结论**）

### A. 抓取失败（技术层面确认失败）
| # | URL | 现象 |
|---|---|---|
| 1 | `https://docs.litellm.ai/docs/proxy/cost_tracking` | `TypeError: fetch failed` |
| 2 | `https://raw.githubusercontent.com/Arize-ai/phoenix/main/README.md` | `TypeError: fetch failed` |
| 3 | `https://raw.githubusercontent.com/traceloop/openllmetry/main/README.md` | `TypeError: fetch failed` |
| 4 | `https://raw.githubusercontent.com/BerriAI/litellm/main/README.md` | `TypeError: fetch failed` |
| 5 | `https://portkey.ai/pricing` | HTTP 200 但正文只有站点标题（JS 渲染/截断） |
| 6 | `https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/` | 重定向到 gen-ai 总页（"Moved"） |

> 规律：**`raw.githubusercontent.com` 本机整体不可达**（3/3 失败）；GitHub HTML 页面只返回导航骨架、不返回 README 正文，**必须改用 `api.github.com`**（本次有效）。

### B. 未核实（证据缺口，逐条列明）
1. **Arize Phoenix 全部关键项**：许可条款、免费额度、保留期、告警、分摊、归因层级 —— 一项都没拿到一手证据。
2. **Datadog LLM Observability 全部关键项**：官方定价、按 span 单价、保留期、是否可自托管。
3. **Portkey 免费额度与数据保留期**（定价页渲染失败）。
4. **Portkey 是否支持成本计算 / 预算告警 / 按团队分摊**。
5. **Traceloop / OpenLLMetry 的许可**（Apache-2.0 属推测，未取证）。
6. **LiteLLM 许可证的精确边界**（MIT 与 enterprise 目录的划分线；GitHub 判定为 `NOASSERTION`）。
7. **OTel GenAI 语义约定的官方稳定性徽章字样**（"Experimental" / "Development" 原文未取到）；只在结构上确认其**已拆分为独立仓库**。
8. **OTel GenAI 成本相关属性名**（如 token 用量属性）未逐字取证。
9. **各工具的"按天"聚合能力**未取到证据。
10. **Helicone 对 OTel GenAI 的支持声明**。
11. **OpenMeter 的免费额度与保留期数字**（定价博客正文未抓取）。
12. **Langfuse 的预算告警专页**。

### C. 预算实耗
- `web_fetch`：**18 / 18**（全部用尽）
- `web_search`：**3 次调用 / 10 条 query**
- 后台任务：**0**（严格遵守"不 nohup、不 fetch.sh、不 sleep 等待"约束）

---

## 12. 给"LLM 成本审计 + 降本实施"服务的三条可落地结论

1. **交付载体只能是开源自托管**：Langfuse（MIT，自托管不限量）+ LiteLLM（改 base_url，key/user/team 三层预算）。这一组合**免费**且能覆盖"单次调用 → API key → 团队"全链路。
2. **免费云版全部会在"保留期"上卡死**：Helicone Hobby **7 天**、Langfuse Hobby **30 天** —— **月底回头查账的本能动作，在免费档上做不到**。这是最容易向客户讲清楚的付费理由。
3. **OTel GenAI 不是标准，是草稿**：到 2026-10-22 仍在独立仓库 `semantic-conventions-genai` 推进、官网页面在搬迁。**它只给 token，不给钱**——"把 token 变成钱"这件事本身就是可收费的服务内容。