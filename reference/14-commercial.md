<!-- 来源：2026-10-22 十四路并行调研的子代理产出，1:1 拷贝，未改写 -->
<!-- 原始文件：_tmp/audit-deep/biz-pricing.md -->
<!-- 课题：同业费率、合同条款与获客 -->
<!-- 证据等级：文内每个数字都带性质标注（官方 / 论文 / 第三方实测 / 厂商宣传 / 未核实） -->
# 成本审计业务：真实定价、合同条款与获客（可引用证据集）

调研时间：本轮（同步抓取，无后台任务）
服务对象：吉林市个人开发者，准备对外提供「LLM 成本审计 + 降本实施」
性质标注约定：**官方** = 该公司自己发布的条款/定价页；**厂商宣传** = 该公司自己发布的能力/业绩声明（未独立验证）；**第三方** = 非当事方的公开文章；**第三方汇总** = 非当事方整理的对比表（数字来自其引注）；**SERP 摘要** = 仅搜索引擎结果标题/摘要可见，页面未能打开（403）；**未核实** = 有线索但本轮未取得可引用页面。

---

## 0. 抓取结果总览（透明记录）

| 目标 | 结果 | 说明 |
| --- | --- | --- |
| llmcfo.com `/` | ✅ 200 | 首页全文 |
| llmcfo.com `/terms` | ✅ 200 | 条款全文（官方，最有价值） |
| llmcfo.com `/pricing` | ✅ 200 | 定价全文（官方） |
| upwork.com 服务页 1（LLM cost audit） | ❌ 403 Cloudflare | **抓取失败** |
| upwork.com 服务页 2（30–50% 降幅审计） | ❌ 未抓（同域已被墙） | **抓取失败**，同站不重复试 |
| pro.fiverr.com 具体 gig | ❌ 403（PXC 验证） | **抓取失败** |
| reinforcedx.com AI 成本优化咨询页 | ✅ 200 | 对照公司 A |
| cloudcostroom.com 绩效费白皮书 | ✅ 200 | 对照公司 B |
| cloudcostroom.com `/pricing/` | ✅ 200 | 对照公司 B 定价页 |
| usage.ai 节省分成定价对比 | ⚠️ 200 但正文被截断（只剩导航） | 未取得数字 |
| pricinglink.com 云成本收费指南 | ❌ 403 | **抓取失败** |
| awsnegotiations.com `/pricing` | ❌ 403 Cloudflare | **抓取失败** |
| milkstraw.ai 八家同业费率对比文 | ✅ 200 | 对照公司 C + 第三方汇总表（关键） |
| billloweringguys.com `/services` | ✅ 200 | 对照公司 D（SaaS 谈判，价格模式可借鉴） |
| llmcfo.com `/pricing` 复访 | ✅ 200 | 同上 |
| aibusiness.vc AI 自由职业者费率卡 | ❌ 429 Vercel 验证 | **抓取失败** |
| uphunt.io Upwork 目录分析 | ✅ 200 | 第三方分析，价格锚 |

---

## 1. LLM CFO（llmcfo.com）：服务定义与合同条款（一手，官方）

### 1.1 服务构成（三件套，一个费率）

| 组件 | 内容 | 计费 | 来源 |
| --- | --- | --- | --- |
| **Tidal Audit** | 只读审计：发票 + 网关日志 + 用量日志；产出「钱花在哪、按模型/工作负载/团队拆分、该砍什么、预期省多少」的书面文档 + 按美元影响力排序的清单；约 1 周 | **免费** | https://llmcfo.com/pricing （官方） |
| **Tidal Gateway** | 一个 LiteLLM 网关，**部署并运营在客户自己的云里**：路由、回退、缓存、批处理、按团队预算与硬止损 | 含在 20% 里，无 licence / 平台费 | https://llmcfo.com/ 、https://llmcfo.com/pricing （官方） |
| **Tidal Telemetry** | 实时成本视图（按 provider / model / feature / team / workflow），作为月度节省账单的证据 | 含在 20% 里；telemetry.llmcfo.com 可单独申请试用 | https://llmcfo.com/ （官方） |

### 1.2 定价条款（官方，逐条）

| 条款 | 原文实质 | 性质 | 来源 |
| --- | --- | --- | --- |
| 审计费 | 免费，只读，约一周，无首付 | 官方 | llmcfo.com/terms §3 / llmcfo.com/pricing |
| 实施与持续 | **已验证月度节省的固定 20%**；相对「签约前锁定的基线」计量，并与原始厂商发票对账 | 官方 | llmcfo.com/terms §3 |
| 不省不收费 | No savings, no fee；某月账单没降，该月费用为 0（原文自注："这不是营销意义上的保证，百分比乘以零就是零"） | 官方 | llmcfo.com/pricing §2 |
| 排除厂商降价 | **Provider price cuts are excluded**（OpenAI/Anthropic 降清单价时，客户账单降、其费用不涨） | 官方 | llmcfo.com/terms §3、/pricing §3 |
| 基线锁定 | 任何改动上线**前**锁定，双方会签，取自客户原始发票而非任一方控制的看板；**按单位工作量归一化**（每请求/每对话/每处理文档） | 官方 | llmcfo.com/pricing §3 |
| 对账 | 按月对发票；账单上列出算式；有争议的行在解决前先剔除 | 官方 | llmcfo.com/pricing §3 |
| 最低消费/锁定期 | 无首付、无最低消费、无最低合作期限；取消提前 **30 天**通知 | 官方 | llmcfo.com/terms §3 |
| 一次性范围工作 | 迁移、架构评审、为财务团队搭建归因/chargeback = 有明确终点的范围工作，**按固定费**，写进 engagement letter | 官方 | llmcfo.com/pricing §6、/terms §3 |
| 费率是否随工作量变 | 固定 20%，**无论**是客户工程师照其规格实施，还是他们自己写并运营改动 | 官方 | llmcfo.com/pricing §2 |
| 承诺/目标 | 目标降幅 **40–60%**；时间 3–5 周（kickoff → 首张对账后的发票）；自述来源是"公开基准 + 我们自己的工程工作，不是客户声称" | 官方（自我限定） | https://llmcfo.com/ |

### 1.3 技术杠杆与自我声明的占比（注意口径）

| 杠杆 | 自我声明占「杠杆范围」 | 说明 |
| --- | --- | --- |
| 模型路由 | 30–50% | 分类/抽取走小模型，推理走旗舰 |
| 语义缓存 | 20–40% | embedding 指纹 + <10ms 命中 |
| 提示压缩 | 15–30% | LLMLingua 类技术，逐项 A/B |
| 批处理/异步 | 10–50% | 批处理端点最高 5 折 |
| 供应商套利 | 20–35% | 同一任务不同厂商差 2–3 倍 |
| 回退链 | 5–15% | 智能重试 + 分层回退 |

来源：https://llmcfo.com/ （官方）。
⚠️ 口径提醒：这些百分比是"占该杠杆可动空间"，**不是**占总节省，也不是叠加总和。对外报价时若把它们当总降幅加总会失真。

### 1.4 合同条款（用户已掌握部分的补全）

| 条款 | llmcfo 的写法 | 性质 | 来源 |
| --- | --- | --- | --- |
| 质量与回滚 | 每次改动 A/B 测试**至少 7 天**；SLO 按端点 kickoff 时约定；回归自动回滚；对 SLO 带内的输出波动不担责 | 官方 | llmcfo.com/terms §4 |
| 数据访问 | **默认只读**；只处理厂商发票、网关日志、聚合元数据；prompt 内容仅在有逐功能明确批准时抽样 | 官方 | llmcfo.com/terms §5 |
| IP 归属 | 客户拥有其数据/模型/prompt；llmcfo 授予客户**永久许可**继续使用为其构建的优化配置（缓存规则、路由树、压缩后 prompt）；llmcfo 保留方法论与工具的权利 | 官方 | llmcfo.com/terms §6 |
| 保密 | **任何数据交换前先签互相 NDA**；基线、节省、架构属保密，除非客户书面同意才公开 | 官方 | llmcfo.com/terms §7 |
| 责任上限 | 总责任上限 = **前 12 个月已付费用**；不含间接/附带损失（含厂商宕机、模型行为变化、第三方服务故障） | 官方 | llmcfo.com/terms §8 |
| 适用法律 | 美国特拉华州；除非另行约定，争议在特拉华约束性仲裁 | 官方 | llmcfo.com/terms §9 |
| 条款变更 | 服务实质性变化时更新；**在履行的合作按签约时生效的条款执行** | 官方 | llmcfo.com/terms §10 |
| 合规声明 | **明确不声称** SOC 2 / GDPR / HIPAA 认证（原文："Not yet — we're being honest"）；可签互相 NDA 与 DPA | 官方 | https://llmcfo.com/ |
| 覆盖厂商 | OpenAI、Anthropic、Gemini & Vertex、Bedrock、Azure OpenAI、Groq、Together、Mistral、Cohere、Fireworks、OpenRouter；网关侧 LiteLLM / Helicone / Langfuse | 官方 | https://llmcfo.com/ |
| 报价脚本 | 30 分钟 discovery、默认只读、NDA + DPA 可提供、无承诺；1 个工作日内回复 hello@llmcfo.com | 官方 | https://llmcfo.com/ |
| 稀缺话术 | "Now taking the first cohort of audit engagements · Limited slots" + 页脚 "Est. 2026" | 官方（营销） | https://llmcfo.com/ |

### 1.5 该公司自己承认的绩效定价两个失效模式（对新人极有价值）

| 失效模式 | 其控制手段（官方原文实质） | 来源 |
| --- | --- | --- |
| 绩效定价**奖励砍成本、牺牲质量** | SLO 在改动上线前按端点约定；每次改动 A/B ≥7 天；回归自动回滚，**连带把对应费用也带走**——"一个让产品变差的节省不是节省，不计费" | https://llmcfo.com/pricing §5 |
| 绩效定价**奖励抬高基线** | 基线取自"我们到来之前你已经收到的发票"，"没有哪个版本的数字是我们能自己画出来的" | https://llmcfo.com/pricing §5 |

另有两条可直接抄的自辩话术（官方）：不拿股权、不拿成功奖金——"现金 + 可测量的行项是唯一诚实的形式，因为这是唯一你能拿一份不是你出的文档来核对我们算术的形式"；节省衰减则费用随之衰减（费绑每月实测降幅，不绑签约时的预测）。
来源：https://llmcfo.com/pricing

---

## 2. 同类公司对照（3 家，均有真实价格/模式证据）

### 2.1 对照 A：ReinforcedX（reinforcedx.com）—— 企业级固定费 + 明确不做分成

| 项目 | 内容 | 性质 | 来源 |
| --- | --- | --- | --- |
| 定位 | AI 成本优化咨询（LLM Platform × Enterprise），4 周标准交付 | 厂商宣传 | https://reinforcedx.com/ai-consulting/ai-cost-optimization-consulting |
| 收费模式 | **固定费**（页面无价格，走 Contact Sales / Book a Demo）；明确"不加价、不转售 token"，客户直付 OpenAI/Azure/Anthropic/Google | 厂商宣传 | 同上 |
| 反面话术 | 原文："If a vendor needs to resell tokens to 'save' you money, walk away."（如果某家供应商需要坐在计费链路上才能替你省钱，转身就走） | 厂商宣传 | 同上 |
| 交付节奏 | W1 花费与 trace 基线 → W2 路由与缓存设计 → W3 带 evals 的影子运行 → W4 交接看板与策略；含预算/告警/runbook + **30 天 on-call**；看板归客户、运行在客户自己的可观测栈 | 厂商宣传 | 同上 |
| 质量门槛 | 黄金集不过，便宜模型就不上线；"没有 LLMOps 的成本优化只是发票好看一点的品质回归" | 厂商宣传 | 同上 |
| 归因口径 | **cost per successful task**（每个成功任务成本），把缓存命中、重试、judge 调用放在同一本账；区分 API 浪费与 ChatGPT Enterprise / Copilot 席位浪费 | 厂商宣传 | 同上 |
| 明确不承诺 | "On the next provider invoice after router and cache go live… **We do not promise a percentage before we see your traces**"（看到你的 trace 之前不给百分比承诺） | 厂商宣传 | 同上 |
| 线索获取 | 邮箱换 3 份 lead magnet：15 页《LLM Cost-per-Task Playbook》PDF、XLSX 基线工作表、7 页路由/缓存 eval 清单 | 厂商宣传 | 同上 |

**对你的意义**：这是对「按节省分成」最尖锐的行业反驳，客户很可能会拿这段话质问你。必须准备好回答（见 §6 话术）。

### 2.2 对照 B：Cloud Cost Room（cloudcostroom.com）—— 三模式并存，绩效费为其主推

| 项目 | 内容 | 性质 | 来源 |
| --- | --- | --- | --- |
| 三模式 | ① 固定费（按范围报价，无公开价）② **绩效费：不省不收费**，从已实现、已验证节省中分成 ③ Managed FinOps 月度托管（连续监控、异常响应、月度评审、承诺管理、董事会级报告） | 厂商宣传 | https://cloudcostroom.com/pricing/ |
| 分成比例 | 页面**未公开具体百分比**（只写"约定份额"）→ 具体费率数字**未核实** | 厂商宣传 | 同上 |
| 何时用哪种（其原话实质） | 固定费：范围明确、要可预算（迁移清理、融资前整理、一次性承诺策略）；绩效费：想让账单降并且**宁愿等我们证明后再付**，多数首单推荐；托管：问题是持续性的，而这几乎总是持续性的 | 厂商宣传 | 同上 |
| 风险归属话术 | "We carry the entire downside"（我们承担全部下行风险）；"我们既不转售云、也不拿厂商佣金，唯一赚钱方式是降低你的账单" | 厂商宣传 | 同上 |
| 业绩声明 | 自 2019 年、**500+ 环境**、**$420M** 云支出、AWS 平均降 **31%** | 厂商宣传（未独立验证） | https://cloudcostroom.com/white-papers/the-performance-fee-finops-model-explained 、milkstraw.ai 引注 |
| 白皮书目录（=绩效费合同要点清单） | 1 不省不收费如何逐步运作 2 基线：反事实问题与如何对双方公平 3 已实现节省的计量口径（对比 on-demand / 对比此前 run rate）4 绩效分成是多少、与固定费随时间如何对比 5 增长处理：把节省与"新工作负载推高的账单"分开 6 何时固定费或托管更合适 7 **保护客户的合同条款，以及要警惕的条款** | 厂商宣传 | https://cloudcostroom.com/white-papers/the-performance-fee-finops-model-explained |
| 方法 | See → Cut → Lock → Run；**先清理闲置、再 rightsize、最后才买承诺**；FOCUS 视图归一化多云 | 厂商宣传 | https://cloudcostroom.com/pricing/ |
| 线索获取 | 邮箱换白皮书 PDF + 基线工作表样例；订阅 newsletter《The Cloud Cost Brief》；多城市办公（Fort Lauderdale · Austin · London · Singapore）做信任信号 | 厂商宣传 | cloudcostroom.com 两页页脚 |

### 2.3 对照 C：MilkStraw AI（milkstraw.ai）—— 20% 分成 + 用「自己扛承诺风险」做差异化

| 项目 | 内容 | 性质 | 来源 |
| --- | --- | --- | --- |
| 费率 | **已实现节省的固定 20%**，无前期费用，**节省到账后才开票** | 厂商宣传 | https://www.milkstraw.ai/blog/aws-cost-reduction-providers-that-only-charge-after-savings |
| 差异化机制 | 三年期 Savings Plans / RI 由 MilkStraw 持在自有 AWS 账户，再把该账户转移进客户 AWS 组织；用量骤降时**由它吸收承诺风险**；费率 20% 只对已落地的节省计费 | 厂商宣传 | 同上 |
| 折扣数量级 | m6g.large / us-east-1：三年全预付 Savings Plan 约比 on-demand 低 **48%**，一年全预付约 **31%** | 厂商宣传（引 AWS 定价逻辑） | 同上 |
| 规模声明 | 100+ 初创客户；引 Thndr 的 Senior SRE 证言 | 厂商宣传 | 同上 |
| 它明确警告的坑 | "无前期费用 ≠ 无承诺风险"：谁合法持有 Savings Plan/RI、利用率不足时谁付 AWS、关系终止时在用承诺如何处置、需要哪些 IAM 权限且能否在不搁浅承诺的前提下撤销 | 厂商宣传（但属行业事实） | 同上 |
| 它给买方的先做顺序 | 先清闲置、再 rightsize、最后对更精简的基线做承诺自动化——"对超配机队买三年折扣不是降本，是把浪费按更低单价锁定" | 厂商宣传 | 同上 |

### 2.4 对照 D：Bill Lowering Guys（SaaS 采购谈判，非 LLM，但定价结构可直接借鉴）

| 档位 | 价格 | 条款 | 来源 |
| --- | --- | --- | --- |
| One-Time Audit | **节省的 30%** | 一份合同、一次谈判、一个费用；2–3 周出结果；**不省钱不收 $0**；客户保留节省的 70% | https://billloweringguys.com/services （厂商宣传） |
| SaaS Watchdog | **$99/月 + 每次谈判节省的 20%** | 含季度栈评审、续约日历与提醒、月度节省报告、专属客户经理；**首季度若节省不足月费则退款** | 同上 |
| Enterprise | 定制 | 面向 SaaS 支出 **$500K+**；无限次谈判、全栈审计与整合方案、高管节省看板、合同生命周期管理 | 同上 |
| 门槛 | 一次性计划建议单合同 **≥ $25K/年**；Watchdog 适合 SaaS 总支出 **≥ $100K** | 让"分成"有意义的规模门槛 | 同上 |
| 宣称 | 典型省 **20–40%**；24 小时内给免费估算 | 厂商宣传 | 同上 |
| 获客 | 退出弹窗 lead magnet：**42 页**谈判战术 + 邮件脚本 playbook | 厂商宣传 | 同上 |

**对你的意义**：$99/月 + 20% 是"月费 + 分成"混合模式的真实标价样本；30% 是"一次性高分成"的真实样本。你的客户预算远小于它（$25K/年是它的最低门槛），所以要另设门槛。

### 2.5 第三方汇总：8 家「按节省收费」厂商的公开费率（关键对照表）

来源：https://www.milkstraw.ai/blog/aws-cost-reduction-providers-that-only-charge-after-savings （**第三方汇总**，数字来自该文给出的引注链接；其中 MilkStraw 自身为其自述）

| 厂商 | 产品 | 计费触发 | 公开费率 | 是否另有固定费 |
| --- | --- | --- | --- | --- |
| Vantage | Autopilot（插件） | 已实现节省（购买的承诺） | **5%** | 是（需付费订阅档） |
| Glassity | 平台级 | AWS 账单上的已验证节省 | **10%** | 否 |
| MilkStraw | MilkBox | 已实现节省 | **20%** | 无前期费用 |
| Usage.ai | 承诺优化 | 产生的节省 | **EC2 约 20%，RDS 等更复杂服务更高** | 无最低、无前期 |
| LLM CFO | 全平台 | 已验证月度节省 | **20%（固定）** | 否（网关与遥测运营含在 20% 内） |
| CloudFix | RightSpend（插件） | **净新增**节省 | 费率不公开；30 天免费试用 | 是（更广平台为固定档位） |
| ProsperOps | ADM | 已实现节省 | 费率不公开 | 是（ARM 按受管资源收固定月费） |
| nOps | 仅 Autonomous Rate Optimization | 已实现节省 | 费率不公开 | 是（可见性模块固定费） |
| Koritsu AI | FinOps 服务 | 账单验证的已实现节省 | 不公开（AWS Marketplace 上架） | 否（无前期费） |

该文给出的三条可直接抄进你合同/话术的洞见（**第三方**）：
1. **费率百分比没有基线重要**："10% 的费对可信基线，可能比 25% 的费对虚高基线更便宜。这个区别活在合同机制里，不在标题数字里。"
2. **合同清单（原文五问）**：基线公式（on-demand 等价？混合费率？上一账期？）／排除项（客户主动变更、AWS 降价、既有折扣、credits）／归属顺序（哪些节省算供应商的、哪些算早已存在的动作）／验证来源（预测值还是实际账单数据）／开票时点（月末还是季度）。
3. **先做免费的**：AWS Cost Optimization Hub 免费提供 rightsize、闲置资源、RI/SP 建议；付钱的价值在实施、持续承诺采购、账单验证与"绩效风险转移"。

---

## 3. Upwork / Fiverr 实际标价（证据强度诚实分级）

| 平台 | 存在性证据（真实标题） | 价格 | 强度 | URL |
| --- | --- | --- | --- | --- |
| Upwork Project Catalog | "You will get **an LLM cost audit with measured savings and a ranked fix plan you can ship**" | 页面 403 → **价格抓取失败** | 仅证明存在该产品化服务 | https://www.upwork.com/services/product/development-it-an-llm-cost-audit-with-measured-savings-and-a-ranked-fix-plan-you-can-ship-2053226461578951701 |
| Upwork Project Catalog | "You will get **audit and reduction of your LLM API costs by 30 to 50 percent**" | 页面未抓（同域 403）→ **价格抓取失败** | 标题即含 30–50% 降幅承诺 | https://www.upwork.com/services/product/development-it-audit-and-reduction-of-your-llm-api-costs-by-30-to-50-percent-2045807812287475244 |
| Fiverr | "Yusuf_nxt: I will optimize and reduce your openai gpt API costs **for $600**" | **$600** | **SERP 摘要**（页面 403，未在页面复核） | https://pro.fiverr.com/yusuf_nxt/optimize-and-reduce-your-openai-gpt-api-costs |
| Upwork 官方 | 《Upwork Hourly Rate: Rates by Skill & Experience in 2026》 | 未抓取 → **未核实** | 官方页面存在 | https://www.upwork.com/resources/upwork-hourly-rates |

### 3.1 第三方给出的 Upwork 目录价格锚（**第三方**，非 Upwork 官方）

来源：https://uphunt.io/blog/upwork-project-catalog-2026-productized-services-vs-proposals

| 规则 | 数字 | 备注 |
| --- | --- | --- |
| 底价档合理区间 | **$400–$2,000** | 低于 $400 招低质买家与无限改稿；高于 $2,000 客户要 discovery call、转化率下降 |
| 什么时候目录能赢 | 单一交付物、价格 **<$5,000**、买家想跳过提案评审 | 三个条件同时成立 |
| 交付时长承诺 | 底档 **24/48/72 小时** | 作者称"这是最大杠杆，也是最多人不愿承诺的" |
| 平台费 | 自由职业者侧 **10%** | 目录、时薪、固定价一致 |
| 定价梯级 | 底档 <$2,000；中档 = 底档 2–3 倍；高档 = 底档 5–8 倍 | — |
| 漏斗数字 | 目录买家 **35–45%** 会复购或升级（作者自称"用户报告数字"） | **强度弱：未核实** |
| 反面清单 | "**AI agent 与 LLM 集成工作**"被点名属于目录打包会输的品类（范围中途会变） | 建议：目录只放**小审计/快照评审/90 分钟咨询**作为 $400–$1,500 的入口，转化到定制合同 |
| 新账号门槛 | 目录搜索排序权重含 JSS、总收入、徽章；新号应先完成 **3–6 个**定制合同再上目录 | 对你的冷启动直接适用 |
| SEO | Upwork 目录页会被 Google 抓取并为长尾词排名（标题与描述 SEO 同样重要） | 标题写法：交付物 + 时间，而不是技能名 |

### 3.2 从上面能得出的真实价位判断（我的推断，非引用）

- **海外个人报价带**：Fiverr 类"优化 OpenAI 账单"成品服务 ≈ **$600**（SERP 摘要）；Upwork 目录底档 **$400–$2,000**（第三方）。即：如果只卖"审计 + 报告"，海外市场价是**几百到两千美元**，不是上万。
- **分成模式在这个价位几乎无法落地**：$600 一次性 vs llmcfo 的 20% 分成——后者的算术只有在客户月支出达到数万美元时才成立（llmcfo 示例基线 $165,000/月 → 月费 $16,500）。
- 结论：**分成模式要求客户规模**；小客户只能走固定费，这与 Cloud Cost Room 的"固定费用于范围明确、可预算的工作"以及 ReinforcedX 的纯固定费一致。

---

## 4. 合同要点清单（可直接当检查表用）

合并来源：llmcfo `/terms`（官方）+ Cloud Cost Room 白皮书目录（厂商宣传）+ MilkStraw 五问清单（第三方汇总）。最后一列是"你（吉林市个人开发者）需要额外注意的"。

| # | 条款 | 行业已有做法（附来源） | 你要写什么 |
| --- | --- | --- | --- |
| 1 | **基线定义** | llmcfo：改动前锁定、双方会签、取自原始发票、按单位工作量归一化（官方）；第三方的五问之一：基线公式是 on-demand 等价 / 混合费率 / 上一账期？（第三方汇总） | 写清"基线 = 你签约前 3 个自然月的原始 provider 发票月均值" + "按每 1,000 次请求的美元成本归一化"，避免用量波动被当成节省 |
| 2 | **对账口径** | llmcfo：按月对发票、账单列出算式、争议行先剔除（官方）；Cloud Cost Room：验证来源要写"实际账单数据"而非预测值（厂商宣传） | 约定对账周期、谁出数据（必须客户自己的账单后台导出）、争议处理 SLA |
| 3 | **排除项** | llmcfo：排除厂商降价（官方）；第三方清单：排除客户主动变更、AWS/厂商降价、既有折扣、credits（第三方汇总） | 逐条列排除：①厂商官降 ②客户自行实施的优化 ③用量自然下降 ④客户自己谈下的折扣/信用额度 ⑤模型下线导致的价格变化 |
| 4 | **归属顺序** | 第三方五问："哪些节省算供应商的、哪些算早已存在的动作"（第三方汇总）；Cloud Cost Room：先清闲置、再 rightsize、最后承诺（厂商宣传） | 写"仅对经双方书面确认由乙方实施上线的改动所产生的增量节省计费"，并附改动清单（changelog）作为证据 |
| 5 | **责任上限** | llmcfo：总责任上限 = 前 12 个月已付费用；不含间接/附带损失（官方） | 个人开发者必写：上限设为"已收服务费总额"，并明确不含客户业务损失、模型输出错误、厂商宕机 |
| 6 | **NDA** | llmcfo：任何数据交换前先签互相 NDA（官方）；Cloud Cost Room：可签互相 NDA 与 DPA（厂商宣传） | 双向 NDA + 只读访问承诺；先签 NDA 再要发票 |
| 7 | **知识产权** | llmcfo：客户拥有数据/模型/prompt；授予客户其所建配置（缓存规则、路由树、压缩 prompt）的**永久许可**；自己保留方法论与工具权利（官方） | 同样切分：交付的配置归客户，你的模板/脚本/方法论归你 |
| 8 | **数据访问边界** | llmcfo：默认只读、只碰发票/网关日志/聚合元数据、prompt 内容需逐功能批准（官方） | 写"只读 API key 或账单后台导出"；绝不索取生产 prompt 全文 |
| 9 | **质量保护** | llmcfo：每次改动 A/B ≥7 天、按端点约定 SLO、回归自动回滚且**连带取消该部分费用**（官方）；ReinforcedX：黄金集不过不上线（厂商宣传） | 用"回滚即不计费"来反向证明你不敢乱降质量 |
| 10 | **取消/退出** | llmcfo：30 天通知、无多年度锁定（官方）；Cloud Cost Room：不省不收费（厂商宣传） | 30 天通知 + 交接义务（把运行手册交出去），这是差异化卖点而非损失 |
| 11 | **承诺风险**（若涉及） | MilkStraw 提醒：无前期费 ≠ 无承诺风险；要问谁合法持有 SP/RI、利用率不足谁付、终止时承诺怎么办、需要哪些 IAM 权限（厂商宣传） | 个人开发者**不要**替客户持有任何承诺；只做建议，写清"所有采购决定与承诺由客户自行下达" |
| 12 | **合规声明** | llmcfo：明确不声称 SOC 2 / GDPR / HIPAA，但可签 NDA/DPA（官方） | 别谎称有认证；个人身份反而适合强调"只读 + 只碰聚合数据 + 可随时撤销的 key" |
| 13 | **适用法律/仲裁** | llmcfo：Delaware + 约束性仲裁（官方） | 中国个人对外接单：写"适用法律 + 争议解决方式"要具体；跨境小额争议仲裁成本高于标的，考虑先写协商条款 |
| 14 | **一次性工作单独定价** | llmcfo：迁移、架构评审、归因/chargeback 搭建按固定费（官方） | 把"一次性"和"持续"拆成两份报价，避免把月费模式硬套在一次性项目上 |

---

## 5. 定价模式对比：固定费 / 月费 / 按节省分成

| 维度 | 一次性固定费 | 月费（retainer） | 按节省分成 |
| --- | --- | --- | --- |
| 真实市场样本 | ReinforcedX 4 周（价格未公开，Contact Sales）｜Cloud Cost Room 模式①｜llmcfo 用于迁移/架构评审/归因（官方）｜Upwork 目录底档 **$400–$2,000**（第三方）｜Fiverr **$600**（SERP 摘要） | Bill Lowering Guys Watchdog **$99/月 + 20% 每次谈判**（厂商宣传）｜Cloud Cost Room Managed FinOps（未公开价，厂商宣传）｜Providing "持续" 属性的还有 llmcfo 的 20%/月（官方） | **5%** Vantage Autopilot｜**10%** Glassity｜**20%** MilkStraw、Usage.ai(EC2)、llmcfo｜**30%** Bill Lowering Guys 一次性｜CloudFix/ProsperOps/nOps/Koritsu 费率不公开（以上见 §2.5 来源） |
| 适用条件 | 范围明确、有明确终点、客户要可预算成本（迁移清理、融资前整理、架构评审、建归因体系）——Cloud Cost Room 与 llmcfo 口径一致（厂商宣传/官方） | 问题是持续性的；客户要连续监控、异常响应、续约/承诺管理（Cloud Cost Room 厂商宣传） | 客户账单规模足够大、基线干净、你能拿到账单数据、客户宁愿你先证明再收钱（Cloud Cost Room 厂商宣传） |
| 你的收益确定性 | 最高（先收钱） | 中（依赖续约） | 最低（当月不省则当月为 0，llmcfo 官方原文承认"百分比乘以零就是零"） |
| 客户接受门槛 | 低（几百到几千美元级别海外已有成交证据） | 中（$99/月 级别的样本存在） | **高**：llmcfo 示例基线是 **$165,000/月**；分成的算术在月支出几千美元的客户身上不成立 |
| 主要风险 | 客户觉得"报告我自己也能写"；一次性后无复购 | 客户随时可砍；你需要持续交付证据（月报） | ①奖励砍质量→需 SLO + A/B + 自动回滚（llmcfo 官方自述控制）②奖励抬基线→需用客户既有的原始发票（llmcfo 官方自述控制）③厂商降价/客户自行动作被误计→需排除条款（第三方清单）④现金流滞后（节省到账才开票，MilkStraw 厂商宣传） |
| 行业反面意见 | — | — | ReinforcedX 明确攻击："If a vendor needs to resell tokens to 'save' you money, walk away."（厂商宣传） |
| 对个人开发者的建议（我的综合，非引用） | **主推**：先卖 $300–$800 的固定费审计做入口（对齐 Upwork 目录底档 $400–$2,000 的区间下沿） | **第二级**：$99–$300/月的持续监控 + 月度报告（对齐 BLG 的 $99/月样本） | **只在客户月 LLM 支出 > $5,000 时提议**分成；比例 20% 是市场主流锚（llmcfo、MilkStraw、Usage.ai 均为 20%），**不要**开口就要 30%（BLG 的 30% 是 SaaS 合同谈判、单合同 ≥$25K/年 的场景） |

---

## 6. 他们怎么获客（只写有证据的）

| 渠道 | 证据 | 性质 | 来源 |
| --- | --- | --- | --- |
| **SEO 内容矩阵（研究文章）** | llmcfo 建了至少 6 篇 research guide：LLM usage metering & billing、AI chargeback & showback、AI FinOps、LLM token usage tracking、LLM cost monitoring、agent spend guardrails；页面自称 "Guides cited by Microsoft Copilot" | 自我宣传（**引用声明未验证**） | https://llmcfo.com/ |
| **按厂商切分的关键词落地页** | 页脚存在 `/audit/openai`、`/audit/bedrock`、`/audit/vertex-ai`；另有工具对比页 `/research/litellm-vs-helicone-vs-langfuse`、`/benchmarks`、`/case-studies`、`/templates` | 官方（页面结构本身可核） | https://llmcfo.com/ |
| **免费工具（获客磁铁）** | `/tools/cache-savings-calculator`（缓存节省计算器）；telemetry.llmcfo.com 可单独申请试用 | 官方 | https://llmcfo.com/ |
| **免费审计本身即获客** | 原文：审计免费因为它是一份真交付物，"你可以拿走这份文档自己全部实施。很多团队就是这么做的，而这是正当的结果，不是销售流程的失败" | 官方 | https://llmcfo.com/pricing §1 |
| **稀缺/首批话术** | 首页顶部："✦ Now taking the first cohort of audit engagements · Limited slots ✦" | 官方（营销） | https://llmcfo.com/ |
| **低门槛约谈入口 + 快速响应** | 30 分钟 discovery、默认只读、NDA/DPA 可提供、hello@llmcfo.com 承诺 1 个工作日内回复 | 官方 | https://llmcfo.com/ |
| **邮箱换 lead magnet（咨询型）** | ReinforcedX：15 页 playbook PDF + XLSX 基线工作表 + 7 页 eval 清单 | 厂商宣传 | https://reinforcedx.com/ai-consulting/ai-cost-optimization-consulting |
| **行业/用例批量落地页** | ReinforcedX 有 BPO、HR、金融、客服、催收、医疗、招聘、保险、房产等 10+ 行业页与 10+ 用例页（页内导航可见） | 厂商宣传 | 同上 |
| **退出弹窗 lead magnet** | Bill Lowering Guys：42 页谈判战术 + 邮件脚本 playbook，作为离站弹窗 | 厂商宣传 | https://billloweringguys.com/services |
| **Newsletter（订阅式内容）** | Cloud Cost Room：The Cloud Cost Brief（"云定价变动时通知你"）；页脚职位/多地办公室做信任信号 | 厂商宣传 | https://cloudcostroom.com/pricing/ |
| **白皮书做教育型内容** | Cloud Cost Room 发布《The Performance-Fee FinOps Model Explained》整篇白皮书，其内容本身就是获客资产 | 厂商宣传 | https://cloudcostroom.com/white-papers/the-performance-fee-finops-model-explained |
| **GitHub / 开源工具** | 仅见 MilkStraw 页脚有 GitHub 组织链接（github.com/milkstrawai），**是否有开源获客工具未核实**；llmcfo 未见开源证据 | 未核实 | milkstraw.ai 页脚 |
| **社区运营** | 本轮**未取得**可引用证据 | 未核实 | — |
| **冷邮件** | 本轮**未取得**可引用证据（403/未抓来源里无此内容） | 未核实 | — |

---

## 7. 直接可用的对外话术（英文短句，来自真实同业用语；标注来源或标"自拟"）

| 场景 | 可抄的句子 | 来源 |
| --- | --- | --- |
| 说清收费 | "Free read-only audit, then a flat 20% of verified monthly savings. No savings, no fee." | llmcfo 官方改写（原句见 llmcfo.com/pricing） |
| 说清"验证" | "The baseline is locked and countersigned before any change ships, built from your raw provider invoices, normalised per unit of work." | llmcfo 官方改写 |
| 排除厂商降价 | "Provider price cuts are excluded. If OpenAI drops a list price, your bill falls and my fee does not rise." | llmcfo 官方改写 |
| 说不抬基线 | "The baseline comes from invoices you already received before I arrived. There is no version of that number I get to draw." | llmcfo 官方改写 |
| 说不砍质量 | "Every change is A/B tested for at least seven days against your production baseline. A regression rolls back automatically and takes the fee with it." | llmcfo 官方改写 |
| 回答"你会不会转售 token" | "You keep paying the provider directly. I never sit in the billing path and take no markup and no vendor commission." | ReinforcedX / Cloud Cost Room 官方用语改写 |
| 回答"你能不能保证 40–60%" | "I do not promise a percentage before I see your traces. The audit produces a real number, and you can implement it yourself." | ReinforcedX + llmcfo 官方用语改写 |
| 个人身份的可信度 | "Read-only by default. Invoices, gateway logs, aggregated metadata only. Prompt content only with per-feature written approval." | llmcfo 官方改写 |
| 合规诚实 | "I am an independent developer, not SOC 2 certified. I sign a mutual NDA, and you can revoke my read-only key at any time." | 自拟（参照 llmcfo 的"不谎称认证"立场） |
| 退出无锁 | "Cancel any time on 30 days' notice. The routing rules, cache configs and measurement setup are yours and stay yours." | llmcfo 官方改写 |

---

## 8. 我给你的三条落地建议（推断，非引用）

1. **先把「审计」做成 $300–$800 的固定费交付物**，不要一上来就谈分成。证据：Fiverr 同类成品服务 $600（SERP 摘要）；Upwork 目录底档 $400–$2,000（第三方）；分成在客户月支出几千美元时算术不成立（llmcfo 示例基线 $165,000/月，官方）。
2. **分成只在月 LLM 支出 > $5,000 的客户上开价，比例锚定 20%**。证据：20% 是市场主流（llmcfo 官方 20%、MilkStraw 自述 20%、Usage.ai EC2 ~20%，见 §2.5）。
3. **合同必须同时写齐四件事才有资格谈绩效费**：基线公式 + 排除项（尤其厂商降价与客户自行动作）+ 验证来源（客户自己的原始账单）+ 责任上限（前 12 个月已付费用的写法见 llmcfo 官方，个人更应把上限压到"已收服务费总额"）。

---

## 9. 本轮未取得的点（诚实清单）

- Upwork 两个 LLM 成本审计 listing 的**具体标价与描述全文**（403，仅得标题）
- Fiverr gig 的**完整套餐价格结构**（基础/标准/高级档）（403，仅得 SERP 标题里的 $600）
- Upwork 官方 2026 时薪统计页数据（未抓）
- Cloud Cost Room 绩效费的**具体分成百分比**（页面只写"约定份额"）
- CloudFix / ProsperOps / nOps / Koritsu 的**具体费率**（其自身未公开）
- pricinglink.com、awsnegotiations.com、aibusiness.vc 的定价数据（403/429）
- 该行业的**社区运营与冷邮件**获客证据
- llmcfo 是否真的被 Microsoft Copilot 引用（仅为该站自我声明）
- MilkStraw 的 GitHub 组织是否发布开源获客工具