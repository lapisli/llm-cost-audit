<!-- 来源：2026-10-22 十四路并行调研的子代理产出，1:1 拷贝，未改写 -->
<!-- 原始文件：_tmp/audit-deep/cn-gateway.md -->
<!-- 课题：国内网关与中转站成本结构 -->
<!-- 证据等级：文内每个数字都带性质标注（官方 / 论文 / 第三方实测 / 厂商宣传 / 未核实） -->
# 国内 AI 网关与成本治理生态（调研报告）

> 用途：为「LLM 成本审计 + 降本实施」服务建立可引用的能力底稿与话术。
> 调研方式：只用 web_search / web_fetch 同步抓取，未启动任何后台任务。
> 预算执行：搜索 6 次、抓取 14 次（上限 8/18 以内），成功 8 条可用来源。
> 性质标注约定：**【官方】**=厂商/项目官方文档或官方发布；**【媒体】**=正规媒体调查报道；**【第三方】**=第三方技术文章/实测解读（含源码引用）；**【厂商宣传】**=厂商营销页；**【未核实】**=未能验证。

---

## 0. 三句话结论（可直接作为开场话术）

1. **国产开源网关（One API / New API）已经能按「用户 + key」记账，但记的是"额度"不是"钱"**：额度 = `ceil((输入token + 输出token × 补全倍率) × 模型倍率 × 分组倍率)`，1 美元 = 500,000 额度（默认配置）。**【第三方/源码解读】** [ssdnodes](https://www.ssdnodes.com/learn/lang/zh-hans/one-api-billing-multipliers-and-quota-math)
2. **真正的成本归因断点在"网关账 ≠ 上游账单"**：网关按你配置的倍率收费，上游降价/缓存折扣它一概不知；Apache APISIX 官方也明确写「定价、预算和账单核对仍由外部系统负责」。**【官方】** [APISIX](https://apisix.incubator.apache.org/zh/blog/2025/03/06/what-is-an-ai-gateway/)
3. **国内"API 中转站"的毛利=订阅制与按量付费之间的价差 + 高低端模型掺水**；其中"号池模式"已被律师定性为高危黑灰产，2026 年已有站长因涉嫌非法经营罪被刑事拘留。**【媒体】** [中国经营报 2026-07-27](http://dianzibao.cb.com.cn/html/2026-07/27/12/content_340927.htm?div=0)

---

## 1. ① 各平台成本统计与额度管理能力对比

| 平台 | 按用户计费 | 按 key（令牌）计费 | 单次调用级用量留痕 | 缓存 token 计价 | 按次计费 | 结论与出处 |
|---|---|---|---|---|---|---|
| **One API**（songquanpeng/one-api） | ✅ 每用户 quota | ✅ 每 user 建多个 token，可设过期/额度/模型白名单 | ✅ 消费日志含 user_id、channel_id、prompt_tokens、completion_tokens、model_name、token_name、quota、content | ❌ v0.6.10 结算式只有 prompt/completion 两项，缓存命中按全价扣 | ❌ | 【第三方/源码解读】[ssdnodes](https://www.ssdnodes.com/learn/lang/zh-hans/one-api-billing-multipliers-and-quota-math)；实际部署与功能描述【第三方】[1Panel 指南](https://awesome.1panel.cn/archives/one-api-self-hosted-guide) |
| **New API**（Calcium-Ion/new-api，MIT，兼容 One API 数据库） | ✅ | ✅ 为用户/应用生成独立 Token，可设过期时间、用量上限、模型访问白名单 | ✅ 有「Usage Logs / Logs & Statistics / Get Logs by Token / Get Personal Log Statistics」等接口与页面 | ✅ 缓存读取、缓存写入分别乘倍率（默认 1.0 / 1.25，Claude 1 小时档 = 5 分钟档 ×1.6） | ✅ 公式：模型固定价格 × 分组倍率 × 500,000 配额单位 | 【官方】[New API 文档索引](https://docs.newapi.pro/llms.txt)、[用法与计费](https://docs2.newapi.pro/en/docs/plugins/billing)；公式与缓存细节【第三方/源码解读】[ssdnodes](https://www.ssdnodes.com/learn/lang/zh-hans/one-api-billing-multipliers-and-quota-math)；功能清单【第三方】[1Panel 指南](https://awesome.1panel.cn/archives/new-api-self-hosted-guide) |
| **Higress**（阿里，CNCF Sandbox） | ✅ Key Auth 插件做多租户（consumers + allow 列表） | ✅ 统一上游 key + 网关侧多租户 key | ⚠️ 开源侧靠插件/WASM 自行扩展；官方博文把"开箱即用的用量观测与分析"归到**商业版 Higress/MSE** | 未见说明 | 未见说明 | 【官方/厂商内容】[higress.cn 博文](https://higress.cn/en/blog/ai_plugin/)：限流（Key Rate Limit）用于"限制高成本大模型消耗"；用量观测需商业版 + MSE 日志中心按 `x-mse-consumer` 分组统计 |
| **Apache APISIX AI Gateway** | ⚠️ 网关自身不做"用户账单"，只做 token 感知限流（本地或 Redis 计数器） | ✅ consumer/credential 维度限流 | ⚠️ 开启 AI 代理日志后，若上游返回则可记录 model、耗时、输入/输出 token、首 token 时间 | 未见说明 | ❌ | 【官方】[什么是 AI 网关](https://apisix.incubator.apache.org/zh/blog/2025/03/06/what-is-an-ai-gateway/)：原文「定价、预算和账单核对仍由外部系统负责」「定义预算、成本分摊规则和业务审批」不属于网关职责 |
| **FastGPT** | ⚠️ 有「积分消耗」体系（官方 FAQ 页存在于搜索索引），但**抓取 404**，字段与粒度未知 | 未核实 | 未核实 | — | — | 【未核实】[积分消耗](https://doc.fastgpt.io/zh-CN/docs/faq/points_consumption)（404） |
| **Dify** | ⚠️ 有监控/用量分析概念（社区文章标题即为「在 Dify 中分析和监控大模型调用成本并自动生成账单」），但官方页抓取失败 | 未核实 | 未核实 | — | — | 【未核实】`docs.dify.ai/llms.txt` 与 `enterprise-docs.dify.ai/.../analysis` 均抓取失败/404；仅有一篇第三方问答页 [php.cn](https://m.php.cn/faq/2618712.html) |
| **Coze 扣子** | ⚠️ 按**积分**统一计费，非按用户维度配额 | ⚠️ 以资源包/积分抵扣，非按 key | ⚠️ 计费项可分（模型/插件/音视频/知识库空间），但无单次调用账单明细证据 | — | ⚠️ 智能体调用按次（1,000 积分≈500 次调用） | 【官方】[扣子专业版资源包](https://docs.coze.cn/coze_pro_resource_pack.md)：豆包/DeepSeek 按 Token 使用量计费并可用积分抵扣；**扣子提供 100 次/天智能体调用免费额度**；方舟模型、微调模型费用由火山方舟按 Token 单独收取 |

### 1.1 额度公式与"对不上账"的五个成因（可做成客户的核账清单）

| 成因 | 具体机制 | 数值/证据 |
|---|---|---|
| 模型倍率查表落空 | One API 未命中内置表 → 静默返回 **30**（≈$0.06/1K token），面板不报错只安静多扣 | 【第三方/源码解读】[ssdnodes](https://www.ssdnodes.com/learn/lang/zh-hans/one-api-billing-multipliers-and-quota-math) |
| New API 未配价 | 未命中返回 **37.5**，但默认直接拒绝请求（提示"模型 %s 的价格尚未由管理员配置"），不扣额度 | 同上 |
| 分组倍率未配 | 分组名不在倍率表 → 记 `group ratio not found` 日志并按 1 计算 | 同上 |
| 输出 token 被放大 | 补全倍率兜底规则：claude-3×5、其他 claude×3、gemini/mistral×3、gpt-4o×4、deepseek×2 | 同上 |
| 预扣造成"额度先掉一大块" | One API 预扣 = `PreConsumedQuota(500) + promptTokens + max_tokens`，结束后只补差额；余额 >100× 预扣额则跳过预扣 | 同上 |

> **换算锚点**：One API `QuotaPerUnit = 500 * 1000.0`，即 **500,000 额度 = 1 美元**，倍率 1 ≈ $0.002/1K token。【第三方/源码解读】上引 ssdnodes

### 1.2 场景化对账示例（可直接演示给客户）

固定 1000 输入 + 1000 输出 token 时，四种倍率组合的扣除额度：

| 模型倍率 | 分组倍率 | 补全倍率 | 扣除额度 |
|---|---|---|---|
| 1 | 1 | 1 | 2000（唯一"看起来对得上"的情况） |
| 1 | 1 | 3 | 4000 |
| 1 | 0.5 | 3 | 2000（数字与第一行相同，成因完全不同） |
| 2.5 | 1 | 3 | 10000（第一行的 5 倍） |

【第三方/源码解读】[ssdnodes](https://www.ssdnodes.com/learn/lang/zh-hans/one-api-billing-multipliers-and-quota-math)

---

## 2. ② 国内「API 中转站」的真实成本结构与毛利来源

### 2.1 合规 / 不合规必须分开说：律师给出的三级风险梯度

| 类别 | 模式 | 合规判断要点 | 性质 |
|---|---|---|---|
| 第一类：官方授权聚合（模型网关） | 办妥增值电信业务等资质，与**境内**大模型厂商签官方代理协议，只接入授权模型 | "更接近合规"，但目前大体只能覆盖境内大模型 | 【媒体】中国经营报引北京大成(上海)律师彭凯 |
| 第二类：API 额度转售 | 以低于官方标价的"倍率""折扣"卖额度赚差价 | 额度来源正规则属正常渠道经销；但"长期能以官方一折甚至更低供应，上游来源是否正当就要打问号" | 同上 |
| 第三类：高危黑灰产（号池模式） | "号池""自有账号""反代 API""一卡一号" | 批量注册/购买境外账号 + 自动化脚本维持活跃 + 境外服务器反代 + 远低于官方价打包转售 | 同上；**已有站长因涉嫌非法经营罪被刑事拘留** |

来源：【媒体】[中国经营报 2026-07-27 第12版《"Token中转站"：AI风口下的风险生意》](http://dianzibao.cb.com.cn/html/2026-07/27/12/content_340927.htm?div=0)

### 2.2 真实成本与毛利数字（全部来自同一篇媒体调查）

| 项目 | 数字 | 性质 |
|---|---|---|
| 境外包月订阅账号成本 | 约 **200 美元/账号**（"号池模式"把一个订阅账号拆成按量接口零售） | 【媒体】 |
| 全国 Token 日均调用量 | 截至 2026 年 3 月突破 **140 万亿次** | 【媒体】引官方数据 |
| 市面低价套餐 | "Gemini3.1 Pro 酒馆专用 API" **60 余元**、标注"15 天无限调用"；"Opus4.7"接口 **70 余元** | 【媒体】记者在购物/二手平台实测 |
| 充值兑换比 | 充值 50 元兑 110 美元额度；100 元兑 250 美元；200 元兑 560 美元；500 元兑 1700 美元 → **最高 1:3.4** | 【媒体】某"Claude Code 中转"公司价目表 |
| 掺水套利毛利 | 按官方高端模型 25 美元/百万输出 token 收费、实际用 0.28 美元/百万输出 token 的开源模型服务 → 每百万输出 token 赚约 **24.7 美元（≈人民币 180 元）** | 【媒体】 |
| 严格一折售卖的套利空间 | 每百万 token 仍有约 **2.2 美元**稳定套利 | 【媒体】 |
| 官方定价参照 | Claude Opus：输入 5 美元/百万 token、输出 25 美元/百万 token；开源模型输出成本低至 0.28 美元、输入低至 0.05 美元 → 差距可达数十倍 | 【媒体】 |
| 算法服务报价 | 数字人"成长系列"因口型+动作实时生成，每小时算力预估 **5000 元至 2 万元** | 【媒体】 |
| 第三方集成商报价 | 单套产品标价多为 2980 元，另按 Token 消耗每月 30 元至 3000 元 | 【媒体】 |
| 行业自述关键词 | "Token 倒卖、接口转发""无运维、无技术支撑""封号、限流、断供频发""缺少 DDoS 防御""低价引流、暗中加价 10%~50%、模糊计费、偷跑 Token、乱扣费" | 【媒体】引从业业务员描述 |

### 2.3 不合规要点名的风险（合规话术素材）

- **刑事风险**：以"反向代理 + 账号池"模式运营、涉嫌非法经营罪的上海某站长已被刑事拘留。**【媒体】**
- **监管动向**：2026 年 4 月中央网信办部署"清朗·整治 AI 应用乱象"专项行动（重点整治未按规定履行大模型备案登记义务、AI 数据安全、技术滥用）；2026 年 4 月、6 月国家安全部两度发布提示，6 月点名"AI 中转站"风险，提示不使用无明确来源、无运营资质、无安全保障的"三无"平台。**【媒体】**
- **数据黑箱**：记者在某中转站买到的账号上"还看到了上一位用户留下的信息资料"；中伦(上海)律师刘新宇：普通用户很难完全验证中转站是否留存数据，因为用户输入先到达的是中转站服务器而非模型服务商。**【媒体】**
- **行业内洗牌**：仅 2026 年 5 月就有大批中转站停摆、关停；境外账号封禁趋严（Claude 需"一卡一号"，继续消费有信用卡被冻结风险）。**【媒体】**
- **常见认知误区**（律师点名）："规模小可以豁免""我只是技术搬运不担责""服务器在境外就不受中国法律约束""薅免费额度无伤大雅"。**【媒体】**

### 2.4 对客户可直接念的三句合规话术

1. "中转站本身是中性的，合不合规看四件事：**上游来源是否合法、手段是否正当、资质是否齐备、数据如何处理**。"（律师原话要义）
2. "凡是**长期**能给你官方价一折以下额度的，来源正当性都要打问号——因为正常经销没有这个价差空间。"
3. "你现在把提示词交给中转站，等于先交给它服务器；**能验证的只有合同和资质，不是技术**。"

---

## 3. ③ 企业自建 AI 网关的常见开源方案

| 方案 | 定位 | 成本/计费相关能力 | 出处与性质 |
|---|---|---|---|
| **One API**（songquanpeng/one-api，MIT） | Go 单体、最容易上手，OpenAI 格式统一代理 30+ 厂商 | 用户/令牌额度、分组倍率、消费日志（不含缓存计价） | 【第三方】[1Panel 指南](https://awesome.1panel.cn/archives/one-api-self-hosted-guide)、[ssdnodes](https://www.ssdnodes.com/learn/lang/zh-hans/one-api-billing-multipliers-and-quota-math) |
| **New API**（Calcium-Ion/new-api，MIT） | One API 社区增强版，数据库完全兼容可直接迁移 | 缓存分级计价、按次计费、可视化统计控制台、Stripe/EPay 收款、订阅套餐、用户组差异化定价 | 【官方】[New API 文档](https://docs.newapi.pro/llms.txt)；【第三方】[1Panel](https://awesome.1panel.cn/archives/new-api-self-hosted-guide) |
| **Higress**（alibaba/higress，CNCF Sandbox） | 基于 Envoy 的云原生网关，WASM 插件生态 | Key Auth 多租户 + Key Rate Limit 限流；开箱即用用量观测在商业版/MSE | 【官方/厂宣】[higress.cn](https://higress.cn/en/blog/ai_plugin/)、CNCF Sandbox 标识见同页页脚 |
| **Apache APISIX AI Gateway**（ASF，Apache-2.0） | 同一网关同时跑 API 与 AI 流量，AI 插件化 | `ai-proxy` / `ai-proxy-multi`（加权轮询、一致性哈希、重试、fallback）/ `ai-rate-limiting`（token 感知限流）/ 提示词与 RAG 插件 / AI 代理日志 | 【官方】[什么是 AI 网关](https://apisix.incubator.apache.org/zh/blog/2025/03/06/what-is-an-ai-gateway/) |
| **FastGPT / Dify** | 不是网关，是 AI 应用/编排平台 | 自带用量与积分体系，适合"应用侧"归因，不适合替代网关 | 【未核实】见 §1 表格说明 |

> 选型判断要点（来自 APISIX 官方的那句边界）：网关能做**限流、路由、token 计数、日志导出**，但「**定义预算、成本分摊规则和业务审批**」明确不属于网关职责。→ 这正是"成本审计 + 降本实施"服务的落点。**【官方】**
> 另一条边界：只调用单一供应商的原型应用未必要上专用网关；网关价值随应用数、供应商数、共享策略增加而显现。**【官方】**

---

## 4. ④ 目前国内哪个开源项目能做到「单次调用级」成本归因

**结论：One API / New API 是当前最贴近"国内开源 + 单次调用级归因"的答案，证据是它的消费日志表字段。**

One API 每次结算写一条消费日志，`RecordConsumeLog` 接收字段为：
`user_id、channel_id、prompt_tokens、completion_tokens、model_name、token_name、quota、content`（main 分支另记 request_id、is_stream、elapsed_time）。
→ **一次请求一行，同时带用户维度（user_id）、key 维度（token_name）、模型维度、token 数、扣减额度、本次用到的三个倍率（content 字段）**，这就是单次调用级的成本归因数据基础。**【第三方/源码解读】**[ssdnodes](https://www.ssdnodes.com/learn/lang/zh-hans/one-api-billing-multipliers-and-quota-math)

可直接复制的核账 SQL（原文给出）：
```sql
SELECT id, model_name, token_name, prompt_tokens, completion_tokens, quota, content
FROM logs ORDER BY id DESC LIMIT 5;
```
`content` 字段形如 `模型倍率 x.xx，分组倍率 x.xx，补全倍率 x.xx`，代回公式即可定位偏差来源。**【第三方/源码解读】**

New API 在此基础上提供官方查询能力：`Get All Logs`、`Get Logs by Token`、`Get Personal Log Statistics`、`Get Log Statistics`、`Logs & Statistics` 管理页。**【官方】**[New API 文档索引](https://docs.newapi.pro/llms.txt)

New API 官方对「Usage Logs」页的原文说明：**「Here you can view the logs of API calls, and see the Token Group, model, and cost used. Regular users can view their own logs, while administrators can view other users' logs.」**
→ 即：**每次 API 调用一行日志，含 Token 分组、模型、本次成本；普通用户只看自己的，管理员可看他人**——满足"单次调用级 + 按用户/按 key"的最小归因要求。**【官方】**[New API Usage Logs](https://docs2.newapi.pro/en/llms.mdx/guide/console/usage-log)

**补强方案（非国内项目，但自托管开源、按次记录）：Langfuse** —— 对**每一次 LLM generation** 记录 `usage_details`（按 usage type，如 input/output/cached_tokens/audio_tokens）与 `cost_details`（每个 usage type 的美元成本）；成本可"ingested（上游返回）"或"inferred（按模型定义的价格表推算）"，并提供自定义模型定义与价格分层；模型定义可用 API 管理（`POST /api/public/models`）。**【官方】**[Langfuse Token & Cost Tracking](https://langfuse.com/docs/observability/features/token-and-cost-tracking)
→ 可直接用来做"**网关账 vs 上游账单**"的两套账核对与对客户的证据呈现。（Langfuse 的许可证与国内可用性**【未核实】**）

**缺口**：Higress 开源版的 `ai-statistics` 插件文档页本次抓取 404，无法确认其输出的 token 指标能否直接落成"单次调用级成本"。**【未核实】**

---

## 5. 审计执行清单（把上面结论变成动作）

| # | 动作 | 判据 / 阈值 | 执行者 |
|---|---|---|---|
| 1 | 拉网关 `logs` 表最近 N 行，取 `content` 里的三个倍率 | 模型倍率 = **30** → One API 查表落空多扣；= **37.5** → New API 未配价 | 审计方（SQL） |
| 2 | grep 网关容器日志 | 出现 `model ratio not found` / `group ratio not found` → 配置缺口 | 审计方 |
| 3 | 用一次真实请求核对 | `ceil((prompt + completion×补全倍率) × 模型倍率 × 分组倍率)` 是否等于日志 quota | 审计方 |
| 4 | 检查缓存折扣是否被吃掉 | One API v0.6.10：缓存命中按全价 → 上游给的折扣变成你的亏损 | 审计方 |
| 5 | 检查是否命中"按次计费" | New API 中该模型的配额消耗与 token 数无关 → 别再去数 token | 审计方 |
| 6 | 双账核对 | 用上游控制台账单 vs 网关日志（网关账只作内部分摊，上游账单才是付款事实） | 客户财务 + 审计方 |
| 7 | 对中转站客户做供应商体检 | 问四件事：上游来源、资质（增值电信业务许可证等）、数据出境路径、备案情况 | 客户 |
| 8 | 拆分预扣影响 | 请求进行中余额偏低属正常预扣；重点查"崩在预扣与结算之间"未退回的请求 | 审计方 |

---

## 6. 本次抓取失败 / 存疑清单

| 目标 | 结果 | 处理 |
|---|---|---|
| `https://www.cnr.cn/.../t20260728_527733647.shtml`（央广网转载同题报道） | 抓取成功但**编码损坏**（GBK 被按 UTF-8 解码成乱码），正文不可用 | 改用同源《中国经营报》数字报（成功） |
| `https://www.htx.com.ht/news/...relay-station...`（英文版中转站亲历） | **抓取失败**（fetch failed） | 放弃 |
| `https://enterprise-docs.dify.ai/en/3.1.x/use/monitoring/analysis`（Dify 用量分析） | **404** | Dify 计费/统计能力记【未核实】 |
| `https://docs.dify.ai/llms.txt` | **抓取失败** | 同上 |
| `https://higress.cn/docs/latest/plugins/ai-statistics/` | **404**（OSS NoSuchKey） | Higress 开源版单次调用 token 指标记【未核实】 |
| `http://dianzibao.cb.com.cn/.../content_340930.htm`（同版"合规问答"篇） | **404** | 未取得 |
| `https://cloud.tencent.cn/developer/article/2739795`（自建网关 vs 第三方中转选型） | 抓取成功但**正文为空**（只有页面框架） | 不引用 |
| FastGPT 官方计费页正文 | **404**（`https://doc.fastgpt.io/zh-CN/faq/points_consumption`） | 记【未核实】 |

## 7. 待核实（不要写进客户交付物）

1. FastGPT、Dify 的**官方**成本统计粒度（是否到每条消息/每次调用）。
2. Higress 开源版 `ai-statistics` 插件实际输出的字段与是否含 token 成本。
3. Langfuse 的开源许可证条款与国内自托管可用性。
4. LiteLLM / Kong AI Gateway / Portkey / Envoy AI Gateway 在国内企业的实际采用情况（本次未取得可靠中文来源）。
5. 中转站毛利区间是否有第三方独立复现数据（本次仅有单一媒体调查的个案数字）。
6. "140 万亿次/日"的原始官方出处（媒体转述，未见一手链接）。