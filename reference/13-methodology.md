<!-- 来源：2026-10-22 十四路并行调研的子代理产出，1:1 拷贝，未改写 -->
<!-- 课题：审计方法论、对账与认证 -->
<!-- 证据等级：文内每个数字都带性质标注（官方 / 论文 / 第三方实测 / 厂商宣传 / 未核实） -->
# 成本审计的方法论、交付标准与认证路径

> 调研范围：FinOps Framework 结构 + GenAI/AI 工作组产出；AWS/ Azure / GCP 成本优化条目；identified vs realized savings 的行业做法；审计报告标准结构；三项认证的考试内容与费用。
> 调研时间：2026-10-22（本机时间 20:54–21:05）。预算约束：18 次抓取 / 8 次搜索，实际用满 18 次抓取、3 次搜索。
> 性质标注规则：【官方】=厂商/基金会官网原文；【第三方】=咨询/厂商营销或行业博客；【未核实】=未取得官方原文，仅有二手线索。
> **本文件只收录抓到的原文事实；抓不到的一律进「抓取失败/未核实」清单，不做任何推测填充。**

---

## 0. 一页速查：能直接拿去用的硬结论

| # | 结论 | 性质 | 来源 |
|---|---|---|---|
| 1 | FinOps Framework 的顶层由 9 个页面构成：Scopes、Principles、Personas、Phases、Maturity、Domains、Capabilities、Technology Categories、Asset Library | 官方 | [finops.org/framework](https://www.finops.org/framework/) |
| 2 | Domains 共 4 个（已抓到前 3 个完整能力清单，第 4 个 "Manage the FinOps Practice" 被截断） | 官方 | [finops.org/framework/domains](https://www.finops.org/framework/domains/) |
| 3 | FinOps 官方已出版 GenAI/Agentic AI 的成本治理白皮书《Managing AI Value Using FinOps Practice Operations》，给出 5 类挑战 + 最佳实践 + AI Investment Council | 官方 | [finops.org/wg/managing-ai-value...](https://www.finops.org/wg/managing-ai-value-finops-practice-operations/) |
| 4 | 官方认证课已把 "FinOps Certified: FinOps for AI" 更名为 "FinOps Certified: AI Value" | 官方 | [training-faqs](https://www.finops.org/training-certification/training-faqs/) |
| 5 | AWS 成本优化支柱（白皮书发布日 2024-06-27）给出 5 条设计原则；其中「采用消费模型」明确写：开发/测试环境按每周 40 小时 vs 168 小时，**潜在节省 75%** | 官方 | [design-principles](https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/design-principles.html) |
| 6 | Azure Advisor 关机建议的硬阈值：P95 最大 CPU <3%、近 3 天 P100 平均 CPU ≤2%、出网利用率 7 天内 <2% | 官方 | [advisor-cost-recommendations](https://learn.microsoft.com/en-us/azure/advisor/advisor-cost-recommendations) |
| 7 | Azure Advisor 自己承认：建议的节省额按**零售价**计、**不含 RI/Savings Plan**，「列出的节省可能高于实际可达」——这就是 identified vs realized 差距的官方证据 | 官方 | 同上 |
| 8 | AZ-900 考试 45 分钟、有监考，考 3 个域；首次失败后 24 小时可重考；费用按考点所在国家/地区定价（该页未给数字） | 官方 | [azure-fundamentals](https://learn.microsoft.com/en-us/credentials/certifications/azure-fundamentals/) |
| 9 | 转引 Flexera 2024：约 30% 云支出被浪费；转引 Harness：52% 工程负责人把「组织脱节」列为浪费的首要驱动 | 第三方（转引，原始报告未核实） | [finout.io](https://www.finout.io/blog/the-savings-that-never-show-up-why-cloud-cost-reductions-disappear-before-they-count) |
| 10 | FOCP / AWS CCP / AZ-900 的**具体考试费与有效期，本次全部未抓到官方原文** | 未核实 | 见第 6 节 |

---

## 1. FinOps Foundation：Framework 结构

### 1.1 顶层结构（官方）

来源：[https://www.finops.org/framework/](https://www.finops.org/framework/)（【官方】，页面自述："The FinOps Framework provides the operating model for how to establish and excel in the practice of FinOps."）

| 组成 | 作用（官方页面导航原文语境） | 链接 |
|---|---|---|
| Overview | 总览 | [framework](https://www.finops.org/framework/) |
| Scopes | 技术范围（云之外的技术也要纳入） | [scopes](https://www.finops.org/framework/scopes/) |
| Principles | 原则 | [principles](https://www.finops.org/framework/principles/) |
| Personas | 角色 | [personas](https://www.finops.org/framework/personas/) |
| Phases | 阶段（Inform / Optimize / Operate） | [phases](https://www.finops.org/framework/phases/) |
| Maturity | 成熟度模型 | [maturity-model](https://www.finops.org/framework/maturity-model/) |
| Domains | 域 = 业务成果 | [domains](https://www.finops.org/framework/domains/) |
| Capabilities | 能力 | [capabilities](https://www.finops.org/framework/capabilities/) |
| Technology Categories | 技术类别 | [technology-categories](https://www.finops.org/framework/technology-categories/) |
| Asset Library | 资产库 | [finops.org/assets](https://www.finops.org/assets/) |

配套资产（官方导航可见）：FOCUS 数据规范（[focus.finops.org](https://focus.finops.org/)）、KPIs（[/wg/finops-kpis/](https://www.finops.org/wg/finops-kpis/)）、术语表（[/assets/terminology/](https://www.finops.org/assets/terminology/)）、FinOps Assessment（[/wg/finops-assessment/](https://www.finops.org/wg/finops-assessment/)）。
版权：**CC BY 4.0**——"Read how use or adaptation requires attribution"。**这对个人开发者极重要：官方框架内容可改编进你的交付物，只要署名。**

### 1.2 四个 Domain 及其 Capabilities（官方）

来源：[https://www.finops.org/framework/domains/](https://www.finops.org/framework/domains/)（【官方】）

| Domain | 官方定位摘要 | Capabilities（已抓到） |
|---|---|---|
| **Understand Usage & Cost** | 采集做 FinOps 所需的全部信息：直接与推计成本、用量、合同承诺、可观测性、利用率、可持续性数据等；并定义组织元数据用于分类、分摊、汇总 | Data Ingestion、Allocation、Reporting & Analytics、Anomaly Management |
| **Quantify Business Value** | 把用量与成本连到业务价值：映射到预算、用历史+计划做预测、建立并度量技术与组织 KPI、跨团队/业务单元/跨组织对标 | Planning & Estimating、Forecasting、Budgeting、KPIs & Benchmarking、Unit Economics |
| **Optimize Usage & Cost** | 只在资源产生价值时使用、并以可接受的最低成本采购；涵盖架构现代化、可持续性、许可与按量 SaaS | Architecting & Workload Placement、Rate Optimization、Usage Optimization（**该页在此处被截断，后续能力名未抓到**） |
| **Manage the FinOps Practice**（第 4 个） | **未抓到**（页面截断处即前 3 个域之后） | 未抓到；已知其中有 **FinOps Practice Operations** 能力，见 1.3 |

> 官方原文要点（可用于话术）："Domains are the outcomes of a FinOps practice." / "every organization using cloud ... will perform activities in each of the FinOps Domains."

### 1.3 FinOps Practice Operations 的官方定义（可直接引用）

来源：[https://www.finops.org/wg/managing-ai-value-finops-practice-operations/](https://www.finops.org/wg/managing-ai-value-finops-practice-operations/)（【官方】转述其 Framework 页面 [capabilities/finops-practice-operations](https://www.finops.org/framework/capabilities/finops-practice-operations/)）

- 官方定义原文：FinOps Practice Operations 是 "driving a culture of accountability by running an effective FinOps team that empowers the FinOps practice through continuous implementation of FinOps strategy and processes."

---

## 2. GenAI / AI 相关工作组产出（本课题最核心的新资料）

### 2.1 《Managing AI Value Using FinOps Practice Operations》（官方白皮书）

来源：[https://www.finops.org/wg/managing-ai-value-finops-practice-operations/](https://www.finops.org/wg/managing-ai-value-finops-practice-operations/)（【官方】）

**Summary 原文要点**：管理 AI 投资的复杂度与快速增长，需要 build proactive、value-driven business partnerships。可落地最佳实践包括：① 建立清晰的 **AI ownership**；② 把成本追踪到 **token 或 GPU 粒度**；③ 采用 **incremental funding model**，支持高频 "fail-fast" 评审；④ 建立跨职能的 **AI Investment Council**。该页目录为：Challenges in Practice Operations → Recommended Best Practices → Managing with an AI Investment Council → Example AI Investment Council Charter → Conclusion → Acknowledgments。

**AI 给 FinOps 带来的 5 类挑战（官方原文列表，逐条可用于开场话术）**：

| # | 挑战（官方原文译述） |
|---|---|
| 1 | 同时进行的 AI 项目数量巨大 |
| 2 | 开发、运行的速度极快，留给决策的时间极短 |
| 3 | 大量 AI 服务/用例/工具是全新的，团队没有准确管理或预测的经验 |
| 4 | 组织内所有人（直至高管层）都高度重视 AI |
| 5 | AI 使用者和构建者极其多样（尤其传统工程团队之外），且能迅速达到很大规模 |

> 使用限制：该页正文在 "Establish Ownership and Accountability" 之后被截断，因此**完整最佳实践清单与 Example AI Investment Council Charter 的具体条款未抓到**（见第 6 节）。

**Token 层面的官方后续参考**：页面明确把 [Tokenomics Foundation](https://www.tokeneconomics.com) 列为深入 token 成本驱动因素的参考，并提到其《State of Tokenomics: September 2026》报告（官方导航横幅，链接 [tokeneconomics.com/state-of-tokenomics](https://www.tokeneconomics.com/state-of-tokenomics/)）。

### 2.2 官方培训侧的 GenAI 内容

来源：[training-faqs](https://www.finops.org/training-certification/training-faqs/)（【官方】）
- FAQ 中有一条明确问题："Why was FinOps Certified: FinOps for AI renamed to FinOps Certified: AI Value?" → 说明官方已有面向 AI 价值的认证课程，且 2026 年发生了更名。**答案正文在折叠项里，未抓到。**

- 另有 FAQ 条目：What training should I take? / Are training discounts available? / Do you offer scholarships? / What does the year on my Credly badge and certificate represent? / 可否公司发票、是否收 VAT 等（**均为折叠项，答案未抓到**）。
  → 对低预算者的可执行动作：**去这一页展开 "Are training discounts available?" 与 "Do you offer scholarships?"**，这是唯一已知的官方折扣入口。

---

## 3. AWS / Azure / GCP 成本优化条目

### 3.1 AWS Well-Architected 成本优化支柱（官方）

来源：[welcome.html](https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/welcome.html)、[design-principles.html](https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/design-principles.html)（【官方】）

- 白皮书**发布日：2024-06-27**（官方页面标注 "Publication date: June 27, 2024"）。
- Well-Architected 共 **6 大支柱**：Operational Excellence、Security、Reliability、Performance Efficiency、Cost Optimization、Sustainability。
- 成本优化支柱的 **5 个目标 / 最佳实践域**（官方原文列表）：
  1. Practice Cloud Financial Management
  2. Expenditure and usage awareness
  3. Cost effective resources
  4. Manage demand and supply resources
  5. Optimize over time
- **5 条设计原则**（官方原文，含唯一一个明确数字）：

| 设计原则 | 官方原文关键数字/表述 |
|---|---|
| Implement cloud financial management | 必须投入时间与资源建设 Cloud Financial Management 能力，类比 Security / Operations 能力 |
| **Adopt a consumption model** | 只按消费付费；开发测试环境通常每周只用 8 小时/天 × 5 天 → 不用时停机，**潜在节省 75%（40 小时 vs 168 小时）** |
| Measure overall efficiency | 度量业务产出与交付成本，看到「提高产出/增加功能/降低成本」带来的收益 |
| Stop spending money on undifferentiated heavy lifting | 把机架、上架、供电等交给 AWS，用托管服务消除运维负担 |
| Analyze and attribute expenditure | 云让成本可精确归因到营收流与工作负载 owner，从而度量 ROI |

> 可复现要点：AWS 官方每页都提供 `View a markdown version of this page`（如 `design-principles.md`），**适合低成本抓取与做检查表**。

### 3.2 Azure 成本优化：Advisor 的量化规则（官方，抓得最实的一节）

来源：[https://learn.microsoft.com/en-us/azure/advisor/advisor-cost-recommendations](https://learn.microsoft.com/en-us/azure/advisor/advisor-cost-recommendations)（【官方】，页面标注 Last updated 2026-02-18）

**关机（Shutdown）建议的判定阈值**：

| 条件 | 阈值 |
|---|---|
| P95（所有核心求和的 CPU 最大值） | **< 3%** |
| P100（近 3 天平均 CPU，所有核心求和） | **≤ 2%** |
| 出网（Outbound Network）利用率 | 7 天内 **< 2%** |
| 是否看内存 | **不看**——官方说明实测 CPU + 出网已足够 |

**规格下调（Resize）建议的目标水位**：

| 场景 | 目标 |
|---|---|
| 面向用户（user-facing）的工作负载 | 新 SKU 上 P95 CPU 与出网利用率 **≤ 40%**；P99 内存利用率 **≤ 60%** |
| 非面向用户 | P95 CPU 与出网 **≤ 80%**；P99 内存 **≤ 80%** |
| 其他硬约束 | 新 SKU 必须支持同等 Accelerated Networking 与 Premium Storage；必须在该区域可用；必须更便宜 |

**数据口径（做「锁定基线」时的关键，官方原文）**：
- 默认回看 **7 天**，可配置为 **7 / 14 / 21 / 30 / 60 / 90 天**；改配置后最多 **48 小时**才会刷新建议。
- 指标 **每 30 秒采样**，聚合到 1 分钟，再聚合到 30 分钟（聚合到 30 分钟时取「平均值的最大值」）。
- VMSS：实例数建议用「各实例指标的平均」，SKU 变更建议用「各实例指标的最大」。

**官方承认的节省额失真（identified vs realized 的官方一手证据）**：
> 原文（Limitations）："The savings associated with the recommendations are based on retail rates and don't take into account any temporary or long-term discounts... the listed savings **might be higher than actually possible**." 并且 "The recommendations don't take into account the presence of Reserved Instances (RI) / Savings plan purchases"，在某些跨系列场景下照做甚至**可能让成本上升**。

**Blog 型节流建议（官方列出的常见「不建议照做」场景）**：为即将到来的流量预置、算法未考虑的指标、正在做 SKU 测试、需要保持 SKU 同构、灾备用途 → 官方给的处理是 **Dismiss / Postpone**。

### 3.3 Azure 完整成本优化检查清单（**抓取失败**）

- 第一次尝试 `learn.microsoft.com/en-us/azure/cost-management-billing/costs/cost-optimization-checklist` → **HTTP 404**。
- 替代线索（未抓取）：同页 Next steps 指向 [Advisor cost recommendations（full list）](https://learn.microsoft.com/en-us/azure/advisor/advisor-reference-cost-recommendations) —— **这是下一次抓取的首选目标**。

### 3.4 Google Cloud 成本优化建议（**抓取失败**）

- `https://cloud.google.com/architecture/framework/cost-optimization` → `TypeError: fetch failed`。
- `https://docs.cloud.google.com/architecture/framework/cost-optimization` → `TypeError: fetch failed`（同一站点第 2 次失败，按约束停止重试）。
- 搜索给出的可用替代入口（未抓取正文）：
  - [Google Cloud Well-Architected Framework：成本最佳化支柱（繁体中文镜像）](https://docs.cloud.google.cn/architecture/framework/cost-optimization?hl=zh-tw)（【未核实】仅见标题）
  - [金融服务视角：费用优化](https://docs.cloud.google.cn/architecture/framework/perspectives/fsi/cost-optimization?hl=zh-cn)（【未核实】仅见标题）
  > **注意：Google Cloud 同样有「Well-Architected Framework」，其成本支柱与 AWS 命名体系相近——这解释了为什么可以在交付物里统一用「支柱 / 检查表」措辞。但本次未取得原文，不要引用 GCP 的具体条目。**

---

## 4. 如何设计「锁定基线」与「与原始账单对账」（identified vs realized）

### 4.1 已抓到的官方口径（可直接写进合同）

| 要点 | 原文/出处 | 性质 |
|---|---|---|
| 工具算出来的节省是 **identified（识别额）**，不等于账单上减少的 **realized（实现额）** | Azure Advisor Limitations 原文（见 3.2） | 官方 |
| 识别额按**零售价**计算，不含折扣与 RI/Savings Plan | 同上 | 官方 |
| 照做建议在某些情况下**可能反而更贵** | 同上 | 官方 |
| 官方做法是把不适用的建议标记为 **Dismiss / Postpone**，而不是删掉 | 同上 | 官方 |
| AWS 侧的口径是看 design principle「Measure overall efficiency」——度量产出与成本，而非单看成本下降 | AWS design-principles | 官方 |

### 4.2 行业做法（第三方，注意这是**厂商营销内容**）

来源：[finout.io 博客](https://www.finout.io/blog/the-savings-that-never-show-up-why-cloud-cost-reductions-disappear-before-they-count)（【第三方】，发布日期 2026-08-10）

该文把「节省不落地」拆成 5 个漏点，**结构本身可以直接借来做审计报告的「风险章节」**：

| # | 漏点 | 文中给出的数字/佐证 |
|---|---|---|
| 1 | 没有人对节省负责（a recommendation without a named individual owner defaults to no one） | 转引 Harness《FinOps in Focus》：**52%** 工程负责人把组织脱节列为浪费首要驱动（【第三方转引，原始报告未核实】） |
| 2 | 决策只活在会议纪要 / Slack 里，没有追踪机制与审计轨迹 | 无数字 |
| 3 | 优化 ticket 卡在 backlog，永远「下个 sprint」 | 建议把优化纳入 sprint 规划或与预算问责挂钩 |
| 4 | **实现后的节省与建模不符**——ticket 关了，没人回去看账单是否真的少了 | 举例：预测 $50K，没人验证 |
| 5 | 新浪费产生速度快于旧浪费被清理 | 需要持续检测而非季度评审 |
| — | 总量判断 | 转引 Flexera 2024 State of the Cloud：约 **30%** 云支出被浪费（闲置、超配、未监控的数据传输费）【第三方转引，未核实】 |
| — | 成熟度 | 转引 Flexera 2026：**63%** 组织已建立 FinOps 团队，但差距源于执行失败而非分析失败【第三方转引，未核实】 |

> 该文还提出一个可以直接照抄的行业术语与交付形态：**"system of record"（记录系统）**——每条建议都登记、状态可追、完成以真实账单影响核验。

### 4.3 可复现的对账方法论（**本文综合设计，非引用**）

下面这张表是**基于上述官方口径推导出的操作方案**，请标注为「本方案设计」而不是「行业标准」：

| 步骤 | 动作 | 判据（有官方依据的标 ★） |
|---|---|---|
| 1. 锁定基线 | 抓取审计起始日的账单快照；同时记录当期承诺折扣与 RI/Savings Plan 覆盖情况 | ★ Advisor 明确：不看 RI/SP 会高估节省 |
| 2. 明确口径 | 报告中同时给出「按零售价的识别额」与「按实际有效单价的识别额」两个数 | ★ Advisor 用零售价 |
| 3. 冻结变量 | 基线窗口内若有新增业务量、迁移、大促，需单列并从节省中剔除 | 本方案设计 |
| 4. 单一 owner | 每条建议指定**一个具名责任人**，不是团队 | 第三方文（Harness 52%） |
| 5. 登记在案 | 每条建议进台账：发现日 / 责任人 / 状态 / 预期月度节省 | 第三方文（system of record） |
| 6. 实现日校验 | 落地后按同一粒度指标回看实际账单，与预测对比，差额写回台账 | ★ Advisor 承认「实现后不一定如模型」 |
| 7. 报告双数 | 报告结论同时写 identified 与 realized，并标注两者的时间差 | 本方案设计 |
| 8. 不适用即标记 | 不适用的建议用 Dismiss/Postpone 语义保留，删除会被视为隐瞒 | ★ Advisor 的 Dismiss/Postpone |

---

## 5. 成本审计 / 优化报告的标准结构

> ⚠️ **诚实声明**：本次**没有抓到任何一份「成本审计报告官方模板」**（AWS/Azure/GCP/FinOps 均未提供具名报告模板的页面被抓到）。下面这份结构是**用已抓到的官方框架 + 第三方文中的漏点清单拼出来的提案**，请以「本方案设计」标注，不要对外宣称是行业标准。

| 章节 | 内容 | 依据 |
|---|---|---|
| 0 摘要 | 一句话结论 + 三个数：基线月成本、identified 节省、已确认 realized 节省 | 本方案设计 |
| 1 范围与口径 | 账期、账户/订阅清单、币种、是否含税、是否含承诺折扣 | ★ Advisor「retail rates / 不含 RI-SP」 |
| 2 数据来源与可复现性 | 每个数字写清来源（账单导出 / 厂商建议页 / 监控指标）与抓取时间 | 本方案设计 |
| 3 基线锁定 | 基线快照 + 变量冻结说明（新增业务、迁移、季节性） | 本方案设计 |
| 4 发现（按 Domain 归类） | 用 FinOps 四域归类：理解用量与成本 / 量化业务价值 / 优化用量与成本 / 管理实践 | ★ FinOps Domains |
| 5 建议台账 | 每条：现象 / 依据（引官方阈值）/ 动作 / 预期节省 / 责任人 / 风险 | ★ Advisor 阈值 + 第三方台账 |
| 6 identified vs realized 对照 | 明确区分，并写清「为何可能高于实际」 | ★ Advisor Limitations |
| 7 不适用与已驳回项 | 用 Dismiss/Postpone 语义列出，并写原因 | ★ Advisor Dismiss/Postpone |
| 8 持续化机制 | 回看周期（Azure 官方支持 7/14/21/30/60/90 天）、告警、复盘节奏 | ★ Advisor 回看窗口 |
| 9 附录 | 术语表（引 FinOps 官方 Terminology）、变更记录 | ★ FinOps 资产库 |

**交付话术（建议，非引用）**：因为 FinOps 框架是 CC BY 4.0，你可以把官方 Domain/Capability 名称直接写进报告目录并署名，专业度和可信度立刻上一个台阶。原文授权页：[how-to-use](https://www.finops.org/introduction/how-to-use/)。

---

## 6. 认证：考试内容与费用（**费用全部未抓到，见下**）

### 6.1 三项认证对照

| 项目 | FinOps Certified Practitioner (FOCP) | AWS Certified Cloud Practitioner (CLF-C02) | Microsoft Azure Fundamentals (AZ-900) |
|---|---|---|---|
| 官方页面 | [finops.org 培训目录](https://www.finops.org/training-certification/) | [aws.amazon.com 认证页](https://aws.amazon.com/certification/certified-cloud-practitioner/) | [learn.microsoft.com 认证页](https://learn.microsoft.com/en-us/credentials/certifications/azure-fundamentals/) |
| 抓取结果 | 认证详情页 **403**（learn.finops.org 被 CloudFront 拦截） | 页面 **HTTP 200 但在「Interested in cloud offerings in the China region」版权块处即被截断，未含费用** | **HTTP 200，内容抓到** |
| 考试时长 | **未抓到** | **未抓到** | **45 分钟**（官方原文 "You will have 45 minutes to complete this assessment."） |
| 监考 | 未抓到 | 未抓到 | **有监考**（"This exam will be proctored"），可能有交互题 |
| 考试内容/域 | 未抓到 | 未抓到（搜索可见第三方整理的 4 个域，见下） | **3 个域**：Describe cloud concepts / Describe Azure architecture and services / Describe Azure management and governance |
| 语言 | 未抓到 | 未抓到 | 含 **Chinese (Simplified)**、Chinese (Traditional) 等 14 种 |
| 重考政策 | 未抓到 | 未抓到 | **首次失败可 24 小时后重考**；后续重考间隔不同（见 [retake-policy](https://learn.microsoft.com/en-us/credentials/support/retake-policy)） |
| 费用 | **未抓到** | **未抓到** | 官方页只写 **"Price based on the country or region in which the exam is proctored."（按考点所在国家/地区定价），页面未给数字** |
| 有效期 | 未抓到 | 未抓到 | 未抓到 |
| 学生优惠入口 | 见 2.2（官方 FAQ 有 discount / scholarship 条目，答案未抓到） | 未抓到 | **官方支持学生/教育者经 Certiport 报名**（[Certiport 报名入口](https://certiport.pearsonvue.com/Certifications/Microsoft/Schedule)）；另有 [Exam Replay 优惠](https://learn.microsoft.com/en-us/credentials/certifications/deals) |

### 6.2 AZ-900 官方可引用要点（唯一抓全的一项）

来源：[https://learn.microsoft.com/en-us/credentials/certifications/azure-fundamentals/](https://learn.microsoft.com/en-us/credentials/certifications/azure-fundamentals/)（【官方】，Last Updated 07/20/2026）
- 级别：**Beginner**；角色：Administrator；产品：Azure。
- 定位：演示对云概念的基础理解，以及 Azure 的计算 / 网络 / 存储，和 Azure 的安全、治理与管理工具。
- 学习资源：官方**考试沙盒**（[Launch the sandbox](https://go.microsoft.com/fwlink/?linkid=2226877)）与**免费练习题**（[practice assessment](https://learn.microsoft.com/en-us/credentials/certifications/practice/assessment?assessment-type=practice&assessmentId=23&practice-assessment-type=certification)）——低预算备考的关键，**零成本**。
- 学习指南：[aka.ms/AZ900-StudyGuide](https://aka.ms/AZ900-StudyGuide)。
- 官方强烈建议用**个人 MSA 账号**报名：用组织（工作/学校）AAD 账号报名，一旦离开组织，考试记录会丢失且不可恢复。
- 通过后可申请 ACE 学分（[college-credit](https://learn.microsoft.com/en-us/credentials/certifications/college-credit)）——**对大学生身份有额外价值**。

### 6.3 费用线索（均**未核实**，禁止直接引用数字）

本次使用的 3 次搜索，返回的全部是二手页面，**没有一次给出可核实的官方费用数字**。可选后续来源（未抓取正文）：

| 认证 | 待查的官方入口 |
|---|---|
| AZ-900 费用 | Microsoft Q&A 提问页 [How much is the exam fees for AZ900?](https://learn.microsoft.com/en-my/answers/questions/4386340/how-much-is-the-exam-fees-for-az900)（**社区问答，非官方定价页**）；官方定价应按地区查 Microsoft Learn 的 "exam pricing" 页面（**本次未找到并抓取**） |
| AWS CCP 费用/有效期 | AWS 官方认证页与考试政策页（**页面抓到但被截断在价格之前**）；第三方整理见 [CLF-C02 fact-sheet（GitHub 原文）](https://raw.githubusercontent.com/PatrickWiloak/cloud-data-ai-security-zero-to-hero/refs/heads/main/exams/aws/foundational/cloud-practitioner-clf-c02/fact-sheet.md)（**第三方**，本次未抓取） |
| FOCP 费用/题量/时长 | 官方学习平台 [learn.finops.org](https://learn.finops.org/)（**403**）；第三方备考文 [certland 2026 备考指南](https://certland.net/blog/finops-certified-practitioner-focp-study-guide-2026/)（**403 Cloudflare**）；经销商报价页 [Global Knowledge FOCP voucher](https://www.globalknowledge.com/fr-fr/products/linux/focp)（**第三方渠道价，非官方**） |

> **给客户的诚实话术**：涉及具体考试费时，一律说「以报名时官网显示的当地货币价格为准」，并现场打开官方报名页截图。**绝不报一个可能过期的美元数字。**

---

## 7. 抓取失败 / 未核实清单（必须随报告一起交给下一位）

### 7.1 抓取失败（明确记录了失败原因）

| # | URL | 结果 |
|---|---|---|
| 1 | `learn.microsoft.com/en-us/azure/cost-management-billing/costs/cost-optimization-checklist` | **HTTP 404** |
| 2 | `cloud.google.com/architecture/framework/cost-optimization` | **fetch failed** |
| 3 | `docs.cloud.google.com/architecture/framework/cost-optimization` | **fetch failed**（同站第 2 次失败，已按约束停止） |
| 4 | `learn.finops.org/page/finops-certified-practitioner` | **HTTP 403 CloudFront**（"Request blocked"） |
| 5 | `certland.net/blog/finops-certified-practitioner-focp-study-guide-2026/` | **HTTP 403 Cloudflare** |
| 6 | `aws.amazon.com/certification/certified-cloud-practitioner/` | HTTP 200 但**正文截断**，未含价格/时长/有效期 |
| 7 | `emnode.com/learn/lesson/identified-vs-realized-cloud-savings/` | HTTP 200 但**正文截断**，只剩标题（"Identified vs. realised cloud savings: the FinOps gap"） |
| 8 | `finops.org/wg/managing-ai-value-finops-practice-operations/` | HTTP 200 但**正文截断**于 "Establish Ownership and Accountability" |
| 9 | `finops.org/framework/domains/` | HTTP 200 但**截断**于第 3 个域的第二个能力之后（第 4 域缺失） |
| 10 | `finops.org/training-certification/`、`training-faqs/` | HTTP 200，但**课程列表与 FAQ 答案均在折叠/JS 组件内，未抓到实质内容** |

### 7.2 未核实（有线索、无官方原文）

1. FOCP 的考试费、题量、时长、有效期、维持要求（CE 学分）——**全部未获取**。
2. AWS CCP（CLF-C02）的考试费、时长、有效期（业界通说为 3 年，但**本次未取得官方原文，禁止引用**）、域占比。
3. AZ-900 的具体费用数字；有效期（业界通说永久有效，**未核实**）。
4. FinOps Framework 第 4 个 Domain「Manage the FinOps Practice」的完整能力清单。
5. 《Managing AI Value》白皮书的完整最佳实践清单与 AI Investment Council Charter 模板。
6. 「identified vs realized savings」的 FinOps **官方术语定义**（emnode 页截断；官方 Terminology 页未抓）。
7. Google Cloud 成本优化支柱的任何具体条目。
8. Azure「成本优化检查清单」完整条目（只有 Advisor VM 规则）。
9. Flexera 30% 浪费 / 63% 建 FinOps 团队、Harness 52% —— **均为第三方转引，原始报告未核实**。

### 7.3 下一次抓取的优先顺序（按性价比排序）

1. `finops.org/framework/capabilities/finops-practice-operations/`（补全官方定义）
2. `finops.org/wg/unlocking-ai-business-value-with-finops/`（搜索已命中的另一篇 AI 工作组文章）
3. `learn.microsoft.com/en-us/azure/advisor/advisor-reference-cost-recommendations`（Azure 完整建议清单）
4. `docs.cloud.google.cn/architecture/framework/cost-optimization?hl=zh-cn`（Google 用 **.cn 镜像 + hl=zh**，本次未试，**中文站点可能可达**）
5. `finops.org/assets/terminology/`（拿 identified/realized 的官方定义）
6. `aws.amazon.com/certification/policies/`（AWS 考试政策：费用、有效期）
7. `learn.finops.org` 的价格页（注意 CloudFront 403，建议换 `finops.org/training-certification/` 下的具体课程页，或直接用浏览器打开）

---

## 8. 给他（吉林市个人开发者、英语弱、预算极低）的落地建议

| 建议 | 依据 |
|---|---|
| 报告目录直接采用 FinOps 官方四域命名，**CC BY 4.0 允许改编，署名即可** | ★ 官方授权页 |
| 审计里凡引用阈值，一律引 Azure Advisor 那三个数字（P95<3% / P100≤2% / 出网<2%），这是**唯一抓到的、可复现的厂商官方量化判据** | ★ 官方 |
| 报告永远给两个数：identified（零售价口径）与 realized（账单口径），并主动说明为什么前者偏高 | ★ Advisor Limitations |
| 每条建议必须落到**一个具名责任人**，并把这条写进服务流程 —— 这是第三方文里 52% 组织失败的主因 | 第三方 |
| 零成本备考：AZ-900 官方沙盒 + 官方练习题 + aka.ms/AZ900-StudyGuide 全免费，且有简中 | ★ 官方 |
| 学生身份可走 Microsoft 的 Certiport 学生/教育者报名通道与 Exam Replay 优惠；FinOps 官方 FAQ 里有 discount / scholarship 两个待展开条目 | ★ 官方 |
| 英语弱 → 优先 AZ-900（有简体中文），FinOps 课程语言未确认，需先到官方训练目录确认是否有中文 | ★ 官方 + 未核实项 |

---

*本文件所有 URL 均为本次实际访问或搜索结果中返回的链接，未编造。凡标注【第三方】/【未核实】的数字，对外交付前必须回到原始报告核实。*