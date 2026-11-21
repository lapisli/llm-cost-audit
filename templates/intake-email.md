# Intake 邮件模板（中文 / 英文两版）

> **用途**：审计流程**第 1 步（Intake）**发给客户的资料索取邮件，复制即用（`< >` 换成当单信息）。
> **适用场景**：**首单**（首次接触，默认免费诊断 / 完整审计档）；**追加单**（老客户第二次起：删掉「做什么 / 不做什么」整段，换成一句回顾 + 增量清单）。
> ⚠️ **本模板的金额、折扣、分成比例与降幅承诺必须与 `SKILL.md`「报价底线」一致；SKILL.md 没写的一律不写，不许编数字。**

---

## 一、中文版

### 主题行（三选一）
1. `<客户名>` 的 LLM 成本审计：需要 3 份数据（只读，不动你的生产配置）
2. 开始审计前先要这些账单与用量导出 —— `<客户名>`
3. LLM 成本审计 Intake：资料清单、传输方式与降级方案

### 正文

你好 `<联系人>`：

我们按 **`<档位：免费诊断 / 完整审计 / 实施+持续>`** 启动本次 LLM 成本审计。这封是第 1 步 Intake：说清我们要什么、不要什么、怎么传。

**我们做什么**

1. **锁定基线**：确定「什么都不做本来会花多少」，写清时间窗、数据来源与它的漏洞。
2. **账单归一化**：各家导出统一成 provider / model / tag / 用量 / 成本 一张表。
3. **逐项跑检查表**：11 项浪费模式（W1–W11）+ 6 项修法杠杆 = 17 项，每项标「命中 / 未命中 / 不适用」并给证据。
4. **拆两个节省数字**：「已识别节省」（动手前估算）与「已验证节省」（对账后实测），**分开报，绝不合并**。
5. **交付报告**：Spend Map、单位经济、发现清单、路线图、**「不建议做」一页**，以及让你能自己复核的算式与单价来源附录；给 `.md` 与 `.html` 两种格式。

**我们不做什么（请先看）**

- **只读，不改你的生产配置**：不部署、不改代码、不动线上参数；实施档的改动由你方执行或另行书面确认。
- 不需要代码仓库、不需要能写或能部署的凭据、不需要完整提示词与回复正文（抽样须逐个功能单独书面批准）。
- **不承接**：① 微调 / 蒸馏 ② 自托管实施 ③ 便宜供应商套利（provider arbitrage）的实施 —— 理由分别是：要碰训练数据与评测集、break-even 依赖你的基础设施、没有可靠的实时价差数据。
- 实施承诺只覆盖三步：**quick win（一天内）→ batch / 缓存（一周内）→ 规则版 routing**。
- 报告给**估算区间，不保证实际节省额**；不构成财务或税务建议。

**需要你提供的数据**

**① 必需（缺了没法开工）**

| 要什么 | 从哪导出 | 格式 | 拿不到怎么办 |
|---|---|---|---|
| 近 **1–3 个月** API 账单 / 用量 | OpenAI Platform → Usage & Cost；Anthropic Console；Google Cloud Billing（成本表 / BigQuery）；Azure Cost Management；AWS Bedrock → Cost Explorer / CUR | CSV，原样导出 | 官网截图（含账期与合计）+ 一条逐日明细，标「截图口径，未独立核验」 |
| 供应商清单：哪几家、谁是主力 | 账单后台 | 邮件一行 | 从导出反推，可能不全 |
| 审计时间窗 | 你定 | 文字 | 默认取最近一个完整自然月并说明 |
| 一句话：产品做什么、多少用户 | 你写 | 文字 | 只能出「成本 / 请求」，出不了「成本 / 用户」 |

**② 有则更好（提高诊断深度）**

| 要什么 | 从哪导出 | 格式 | 拿不到怎么办 |
|---|---|---|---|
| 维度标签：功能 / 端点 / 环境 / 租户 | 请求加 `tag` / `metadata` 后聚合；部分厂商可按项目或 key 分组 | CSV 含 tag 列 | Spend Map 只能按模型拆；W1 / W3 / W7 只能给下界或「无法判定」 |
| 缓存读 / 写分列（`cached_input_tokens`） | Usage 导出的缓存字段 | CSV | 算不出**缓存命中率**；W2 只给「理论可缓存量」下界，或临时采 24 小时网关日志 |
| 失败与重试数据（4xx/5xx、重试次数） | 应用 / 网关日志 | CSV / 日志 | W5 从 Measured 降为 Estimated |
| 合同折扣与承诺用量（RI、节省计划、阶梯价） | 采购 / 财务 | 文字 + 截图 | 按**零售价**算，已识别节省偏高，附录注明 |

**③ 可选（进一步提高归因精度）**

| 要什么 | 从哪导出 | 格式 | 拿不到怎么办 |
|---|---|---|---|
| 只读 Admin key（Read + Billing 作用域，可随时吊销） | 供应商控制台 | 用完即吊销 | 走账单导出，只是无法独立交叉核对 |
| 网关日志（LiteLLM / Helicone / Portkey / Langfuse） | 网关后台，**可删掉提示词与回复正文** | CSV / JSONL | 到不了「哪次调用」，W9 / W11 只能从账单侧估 |
| 单次调用级 trace（OTel GenAI span 或 Langfuse） | 埋点 / 自托管导出 | OTLP / JSONL | 同上；这是行为性诊断的前提 |
| 嵌入 / 向量库调用量与重复率 | 向量库后台 | CSV | W8 标「未评估」 |
| 单次请求的模型调用次数分布（agent 产品必给） | 编排层日志 | CSV | W9 用平均值代替尾部，会低估 |

**数据敏感性与传输**

- **能接受**：账单与用量导出、聚合元数据、脱敏 tag 名、去掉正文的网关日志、**只读**凭据。
- **不接受**：生产写权限、能改配置或部署的凭据、源代码、完整提示词与回复正文、用户个人信息（PII）。
- **怎么传**：优先用**你自己的**云盘 / 对象存储生成的**带时效**分享链接，或 SFTP / SSH，或你方 IT 既有安全通道。
- **请不要**用公开聊天工具（微信 / QQ / 公开频道）或来源不明的网盘；**不要把 key 贴在邮件正文里**。
- 凭据与数据**分开传**；只读 key 用完立即吊销，审计结束后按你的要求删除本单数据。

**时间承诺**

- **起算点**：「必需」四项**齐备**之日，不是这封邮件发出之日。
- **回执**：收到后 **1 个工作日内**回你「已收到 / 还缺什么」（工作约定，非报价条款）。
- **报告交付**：自起算点起 **______ 个工作日**，按当单范围开工前书面确认；技能没有固定 SLA，**不要照抄别家的宣传天数**。
- **实施档另计**：上线后做 **≥7 天** A/B 对生产基线，再与原始账单对账出「已验证节省」。

**报价口径（照技能底线，不另加条款）**

- 首单：**$300–800 固定费**审计。
- 分成：**只在月 API 支出超过 $5,000 时**才谈，比例锚定 **20%**（按已验证节省计）；达不到只走固定费。
- 对外降幅承诺 **40–60%**，每一项都有官方单价支撑、你能自己验算。
- 「不省不收费」不在默认口径内，属可选项，需单独谈。
- 两个数永远分开报：已识别节省 / 已验证节省。

**不确定要提供什么？先回这封邮件说明你的情况**（如「只有月度总账单」「用中转站没有原始账单」「分散在四个账号」），我们按第三节的降级方案给你一个能开工的最小集。

---

## 二、English version

### Subject lines (pick one)
1. LLM cost audit for `<client>`: 3 exports we need (read-only, no production changes)
2. Before your token cost audit starts — the data we need
3. LLM cost audit intake: checklist, transfer options, fallbacks

### Body

Hi `<name>`,

We're starting your LLM cost audit at the **`<tier: free diagnostic / full audit / implementation + monitoring>`** level. Step 1 is Intake: what we need, what we don't, how to send it.

**What we do**

1. **Lock the baseline** — what you would have spent doing nothing, with window, data source and known gaps written down.
2. **Normalize the bills** into one table: provider / model / tag / usage / cost.
3. **Run a 17-item matrix**: 11 waste patterns (W1–W11) + 6 remediation levers, each marked hit / not found / not applicable, each with evidence.
4. **Report two separate savings numbers** — identified (pre-change estimate) and realized (reconciled to the original invoice) — never merged.
5. **Deliver the report**: spend map, unit economics, findings, roadmap, a **"what we do NOT recommend"** page, and a method appendix so you can recompute every number. `.md` and `.html`.

**What we do not do**

- **Read-only. We do not touch your production configuration** — no deploys, no code changes, no live parameter changes.
- No repositories, no write-capable credentials, no prompt or response bodies (sampling needs per-feature written approval).
- **Out of scope**: fine-tuning / distillation; self-hosting implementation; provider-arbitrage implementation (no reliable real-time price data).
- Implementation covers three steps only: **quick wins (same day) → batch / prompt caching (within a week) → rule-based routing.**
- Estimated ranges, **not guaranteed savings**; not financial or tax advice.

**Data we need**

**Tier 1 — required (no start without these)**

| Item | Export / format | If unavailable |
|---|---|---|
| API bills / usage, last **1–3 months** | OpenAI Platform → Usage & Cost; Anthropic Console; Google Cloud Billing (cost table / BigQuery); Azure Cost Management; AWS Bedrock → Cost Explorer / CUR. CSV, as-is | Console screenshots with period + totals plus one line-item day, labelled "screenshot, not independently verified" |
| Provider list, primary vendor | Billing console | Inferred from exports; gaps flagged |
| Audit window | You decide | Defaults to your last full calendar month |
| One line: product + rough user count | You | Cost per request only, no cost per user |

**Tier 2 — better to have (shifts diagnosis depth)**

| Item | Export / format | If unavailable |
|---|---|---|
| Dimensional tags: feature / endpoint / environment / tenant | Add `tag` / `metadata`, aggregate; some consoles group by project or key. CSV with tag column | Spend map splits by model only; over-specification, context bloat, env separation degrade to lower bounds |
| Cache read / write split (`cached_input_tokens`) | Usage export cache fields. CSV | **Cache hit rate** not computable; theoretical lower bound, or a 24-hour gateway capture |
| Failure and retry counts (4xx/5xx) | App or gateway logs. CSV | Failed-request waste drops from measured to estimated |
| Committed discounts (RI, savings plans, tiers) | Procurement. Text + screenshot | List price only; identified savings read high, noted in appendix |

**Tier 3 — optional (finer attribution)**

| Item | Export / format | If unavailable |
|---|---|---|
| Read-only Admin key (Read + Billing scope, revocable) | Provider console | We work from your exports; no independent cross-check |
| Gateway logs (LiteLLM / Helicone / Portkey / Langfuse) | Gateway export; **strip prompt / response bodies**. CSV / JSONL | No per-call view; agent-loop and context-bloat items estimated from the bill |
| Per-call traces (OTel GenAI spans or Langfuse) | Instrumentation / self-hosted. OTLP / JSONL | Same; prerequisite for behavioral diagnosis |
| Embedding volume and duplication | Vector DB console. CSV | Duplicate-embedding waste marked not assessed |
| Model calls per user request (agent products) | Orchestration logs. CSV | Average instead of tail; waste understated |

**Data sensitivity and transfer**

- **Accepted**: bills and usage exports, aggregated metadata, de-identified tag names, gateway logs with bodies stripped, **read-only** credentials.
- **Not accepted**: production write access, deploy-capable credentials, repositories, full prompt / response bodies, personal data.
- **How to send**: your own cloud storage with a time-limited link, SFTP/SSH, or your internal secure channel.
- **Please do not** use public chat tools (WeChat, QQ, public channels) or unknown file-sharing sites, and never paste keys into email bodies.
- Send credentials **separately**; revoke read-only keys right after use; we delete engagement data on request.

**Timeline**

- **Clock starts** when the four required items are complete, not when this email is sent.
- **Acknowledgement** within **1 business day**, listing what is still missing (a working convention, not a contract term).
- **Report delivery**: **______ business days** from that point, confirmed in writing per scope. The skill fixes no SLA, so we agree it per engagement instead of quoting someone else's marketing.
- **Implementation tier is separate**: an **A/B run of at least 7 days** against the production baseline, then reconciliation to the original invoices for realized savings.

**Pricing (per our skill's floor — nothing added)**

- First engagement: a **$300–800 fixed-fee audit**.
- **Revenue share only above $5,000/month** in API spend, anchored at **20%** of verified savings; below that, fixed fee.
- Publicly we commit to a **40–60%** reduction range, each line backed by an official unit price you can check.
- "No savings, no fee" is not the default; it is separately negotiated.
- Two numbers, always separate: identified and realized savings.

**Not sure what to send? Reply and describe your situation** — "all we have is a monthly total", "we buy through a reseller with no original invoice", "it's spread across four accounts" — and we'll hand you the minimum viable set from the fallback table below.
