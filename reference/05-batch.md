<!-- 来源：2026-10-22 十四路并行调研的子代理产出，1:1 拷贝，未改写 -->
<!-- 课题：批处理与异步折扣 -->
<!-- 证据等级：文内每个数字都带性质标注（官方 / 论文 / 第三方实测 / 厂商宣传 / 未核实） -->
# 批处理 / 异步推理：官方折扣与适用边界（国际厂商）

> 调研时间：本轮会话（12 分钟限时，同步抓取）
> 服务对象：吉林市个人开发者，准备对外提供「LLM 成本审计 + 降本实施」
> 用法：本文每个数字都带 URL + **性质**标注。给客户报价/承诺前，只引用标「官方」的行。

## 0. 取材说明（可信度分层）

**性质标注口径**

| 标注 | 含义 |
| --- | --- |
| 官方 | 厂商自己的文档站 / 官方产品公告，本轮**实际抓到正文** |
| 官方博客 | 厂商自有站点上的员工技术博客（AWS Builder Center），非产品文档 |
| 二手 | 第三方博客/聚合站，仅作线索，不可作为承诺依据 |
| 未核实 | 本轮**没抓到**权威来源，禁止对外引用数字 |
| 抓取失败 | 明确记录访问失败，避免重复踩坑 |

**本轮抓取结果台账**

| 目标 | 结果 | 说明 |
| --- | --- | --- |
| OpenAI Batch 指南（platform.openai.com / developers.openai.com .md / help.openai.com FAQ） | **抓取失败 ×3** | 全部 HTTP 403（Cloudflare 拦截，IP 111.25.65.135） |
| Anthropic 官方文档（docs.anthropic.com / platform.claude.com 多路径） | **抓取失败 ×4** | 全部跨域重定向到 www.anthropic.com / claude.com，未被跟随 |
| Google Cloud / Vertex 文档（cloud.google.com、docs.cloud.google.com ×3） | **抓取失败 ×3** | `fetch failed`（网络层失败，非 403） |
| AWS Bedrock 文档（batch-inference / supported / create） | 成功 ×3（create 页为 Tab 骨架，无正文） | Markdown 镜像 `*.md` 同页可得 |
| Microsoft Learn：Azure OpenAI 批处理 | 成功（正文完整） | 本轮信息密度最高的一页 |
| AWS Bedrock 定价页 | 成功但被截断（JS 渲染表格） | 未取到折扣数字 |
| claude.com 产品公告「Introducing the Message Batches API」 | 成功（正文完整） | Anthropic 官方公告 |
| AWS Builder Center：Bedrock 批量与 SLA | 成功（正文完整） | **官方博客**，信息量高 |

---

## 1. 四家官方折扣与完成时限对照（核心表）

| 厂商 / 接口 | 折扣 | 完成时限（官方表述） | 单批规模 | 关键限制 | 来源与性质 |
| --- | --- | --- | --- | --- | --- |
| **Anthropic** Message Batches | **50%，且输入与输出都减** | "Each batch is processed in less than 24 hours"；"often much quicker" | **10,000 条查询 / 批** | 不计入常规 API 速率限制（有独立额度） | [claude.com 产品公告](https://claude.com/resources/articles/message-batches-api) · **官方** |
| **Azure OpenAI** Global Batch（OpenAI Batch API 同语义） | **比 global standard 低 50%** | **24 小时目标值**（"24-hour target turnaround at 50% less cost than global standard"）；**超时不自动过期**，可继续跑或取消 | 文件级提交（JSONL） | `completion_window` 只能填 `24h`，填别的直接失败 | [Microsoft Learn](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/batch) · **官方** |
| **AWS Bedrock** Batch Inference | **最高 50%（"up to 50%"）** | **无完成时限保证（no completion-time guarantee）**；存在 timeout window，超窗状态为 `Expired` | 见 [配额页](https://docs.aws.amazon.com/general/latest/gr/bedrock.html)（本轮未抓） | 不支持 provisioned models；Converse 调用类型**不支持 tool calling** | [AWS Bedrock 文档](https://docs.aws.amazon.com/bedrock/latest/userguide/batch-inference.html)（限制）· **官方**；[AWS Builder Center](https://builder.aws.com/content/3GZJGpsMGRLaqvg6TAG8cZXisQR)（50% 与无 SLA）· **官方博客** |
| **OpenAI** Batch API | 业内一致说法为 50% + 24h 窗口，但**本轮未抓到 OpenAI 官方页** | 未核实 | 未核实 | 未核实 | 见下方「抓取失败」——**禁止直接引用**，需以 Azure 官方文档类比并注明 |
| **Google Vertex AI** Batch Prediction | **未核实**（官方页 3 次抓取失败） | 未核实 | 未核实 | Anthropic 公告仅确认 Vertex 上"batch predictions in preview" | [claude.com 公告更新段](https://claude.com/resources/articles/message-batches-api) · **官方**（仅证明功能存在） |

### 1.1 可直接写进审计报告的官方原句（短引用）

| 原文（英文原句） | 出处 | 性质 |
| --- | --- | --- |
| "It processes asynchronous groups of requests with separate quota and offers a 24-hour target turnaround at 50% less cost than global standard." | [Microsoft Learn](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/batch) | 官方 |
| "The service aims to process batch requests within 24 hours, but it doesn't expire jobs that take longer. ... You pay for any completed work." | 同上 | 官方 |
| "Currently the completion window must be set to `24h`. If you set any other value than `24h` your job will fail." | 同上 | 官方 |
| "Responses won't be returned in identical order to the order defined in the `.jsonl` batch file." | 同上 | 官方 |
| "Developers can send batches of up to 10,000 queries per batch. Each batch is processed in less than 24 hours and costs 50% less than standard API calls." | [claude.com 公告](https://claude.com/resources/articles/message-batches-api) | 官方 |
| "offered at a 50% discount for both input and output tokens." | 同上 | 官方 |
| "Amazon Bedrock batch inference saves up to 50% on per-token costs but offers no completion-time guarantee." | [AWS Builder Center](https://builder.aws.com/content/3GZJGpsMGRLaqvg6TAG8cZXisQR) | 官方博客 |
| "Batch inference isn't supported for provisioned models." | [AWS 文档](https://docs.aws.amazon.com/bedrock/latest/userguide/batch-inference.html) | 官方 |
| "Batch inference doesn't support tool calling (function calling) for jobs that use the `Converse` invocation type. Records that include `toolConfig` fail with a 400 error. ... Structured outputs are supported with both invocation types." | 同上 | 官方 |

---

## 2. 适合 / 不适合的工作负载（可直接当审计判断规则）

| 判断维度 | 适合批处理 | 不适合批处理 | 依据 |
| --- | --- | --- | --- |
| 延迟要求 | 非实时、可等数小时到 24h：数据标注/分类、文档摘要、批量翻译、模型评测、历史数据重排 | 用户在等答案的在线请求、客服实时问答、Agent 交互循环 | [claude.com 公告](https://claude.com/resources/articles/message-batches-api)（"non-time-sensitive tasks"、"real-time responses aren't necessary"）；[AWS 官方博客](https://builder.aws.com/content/3GZJGpsMGRLaqvg6TAG8cZXisQR)（离线场景：document indexing / nightly enrichment / historical re-ranking） |
| 有"软截止"（早上出报表） | 可做，但**必须加降级通道**：批处理优先，逼近截止就切同步 | 只有批处理一条路 | [AWS 官方博客](https://builder.aws.com/content/3GZJGpsMGRLaqvg6TAG8cZXisQR)：`BATCH_CUTOFF = SLA_TOTAL − on_demand_drain_time − safety_buffer` |
| 状态依赖 / 多轮 | 单轮、无相互依赖的请求（每条独立 sys+user） | 第 N 条要用第 N−1 条输出（Agent 链路、多轮对话、思维链串联） | 由批处理模型决定：结果**不按输入顺序返回**，且无跨请求状态（[Microsoft Learn](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/batch) 官方） |
| 工具调用 / 函数调用 | 仅当用 Bedrock `InvokeModel` 调用类型、按模型原生格式写 input 时可做 | Bedrock `Converse` 类型带 `toolConfig` 的记录**直接 400 失败** | [AWS 文档](https://docs.aws.amazon.com/bedrock/latest/userguide/batch-inference.html) 官方 |
| 结构化输出 | 支持（Bedrock 两种调用类型都支持 JSON 校验输出） | — | 同上，官方 |
| 模型类型 | 按需（on-demand）模型 | **Bedrock provisioned models 不支持批处理**；Azure 需专门建 `Global-Batch`/`Data Zone Batch` 部署 | AWS 官方文档；[Microsoft Learn](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/batch) 官方 |
| 配额 | 批处理有**独立配额**（不挤占在线额度）：Anthropic 提高速率上限、Azure 独立 enqueued token 配额 | 以为批处理免费送吞吐：大文件仍会撞 enqueued token 上限 | [claude.com 公告](https://claude.com/resources/articles/message-batches-api)、[Microsoft Learn](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/batch) 官方 |

---

## 3. 工程改造代价清单（状态机 / 重试 / 幂等 / 回填）

### 3.1 必须自建的异步状态机（Azure/OpenAI 语义，官方给出全量状态名）

| 状态 | 含义 | 我方要做的动作 |
| --- | --- | --- |
| `validating` | 输入文件校验中 | 只轮询，不发新任务 |
| `failed` | 文件校验失败 | 读 `error_file_id`，修文件重提 |
| `in_progress` | 已通过校验，运行中 | 轮询；**官方建议两次状态查询间隔 ≥60 秒** |
| `finalizing` | 已完成，结果打包中 | 不要提前判定失败 |
| `completed` | 结果就绪 | 下载 `output_file_id`，进入回填 |
| `expired` | 24h 窗口内没做完 | 取部分结果 + 剩余请求转同步补充 |
| `cancelling` / `cancelled` | 取消中（**最长 10 分钟**才生效） | 取消后仍会拿到**部分结果**，要能接住 |

来源：[Microsoft Learn](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/batch) · **官方**

### 3.2 七项改造工作量（含官方依据）

1. **提交器**：JSONL 生成 + 上传（Azure 支持 `expires_after` 设 **14–30 天**：`1209600`–`2592000` 秒，设过期还能提高输入文件上限）。同一个批文件里模型/部署名必须完全一致，否则要把文件拆开提交。[官方](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/batch)
2. **幂等键**：每条请求必须有稳定 `custom_id`（官方明确要求），回填时按 `custom_id` 落库——**不能按行号**，因为官方说响应顺序与输入顺序不一致（"won't be returned in identical order"）。
3. **结果回填器**：分别下载 `output_file_id` 与 `error_file_id`；错误文件用于定位个别失败记录，不要整批重跑。[官方](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/batch)
4. **重试策略**：单条失败 = 单条重试（把失败 `custom_id` 收集成新批次），批量级失败才整批重提。Azure 大文件撞配额时官方提供**指数退避排队**（fail-fast + queueing batch jobs）自动承接下一批。[官方](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/batch)
5. **降级/兜底通道**：AWS 官方给出的生产模式 = Step Functions 状态机 `waitForTaskToken` 挂起等待 + CloudWatch 告警 + EventBridge 状态变更事件 + `States.Timeout`，三路任一触发就 **StopBatchJob → ReconcileRecords（比对已处理/未处理）→ 剩余记录走按需 API 重跑（Distributed Map，官方示例限 20 并发）→ 合并结果**。注意 `waitForTaskToken` 只在 Standard Workflows 可用。[官方博客](https://builder.aws.com/content/3GZJGpsMGRLaqvg6TAG8cZXisQR)
6. **计费对账**：取消/中止时**只对已处理的 token 计费**，可拿到部分结果——审计报告里要按"已处理量"而不是"提交量"算钱。[AWS 停止任务文档，经官方博客引用](https://builder.aws.com/content/3GZJGpsMGRLaqvg6TAG8cZXisQR)
7. **可观测性**：Bedrock 提供 `AWS/Bedrock/Batch` 指标（如 `NumberOfRecordsPendingProcessing`、`NumberOfInputTokensProcessedPerMinute`）与 EventBridge `Batch Inference Job State Change`（`Completed` / `Failed` / `Expired` / `PartiallyCompleted`）——用于发现"提交了但零 token 在飞"的卡死。**注意这些吞吐指标并非所有模型都有，用前先核对文档。** [官方博客](https://builder.aws.com/content/3GZJGpsMGRLaqvg6TAG8cZXisQR)

### 3.3 改造代价的定性结论

- 从同步改成批处理**不是换一个 endpoint**，而是新增一套「提交—轮询/事件—校验—回填—补跑」链路；AWS 官方给出的参考实现需要 Step Functions + Lambda + DynamoDB + S3 + CloudWatch + EventBridge + SNS 七类资源。
- 最小可用版本（MVP）可只用 SQLite/JSON 落盘 + 定时轮询（≥60s 间隔）+ `custom_id` 回填，**可省掉事件总线**；但"软截止降级"与"部分结果合并"这两块必须写，否则一次超窗就全批白等。

---

## 4. 批处理 × prompt caching 能否叠加

**结论：本轮未获得任何一家的官方条款明文，四个厂商全部标「未核实」。**

| 厂商 | 能否叠加 | 状态 | 备注 |
| --- | --- | --- | --- |
| OpenAI / Azure OpenAI | 未知 | **未核实** | 本轮未抓到任何官方说明；Azure 官方批处理页（已抓）**未提及** prompt caching 与批量折扣的叠加规则 |
| Anthropic | 未知 | **未核实** | 官方批处理文档 4 次抓取全部被重定向拦截；产品公告只讲 50% 与 24h，未提缓存 |
| AWS Bedrock | 未知 | **未核实** | 已抓的批处理文档与官方博客均未提 prompt caching |
| Google Vertex | 未知 | **未核实**（官方页抓取失败） | — |

**给客户的合规说法（照抄即可，不含未证实数字）**：

> "批量折扣与缓存折扣是否叠加、叠加后按哪个基数计算，各厂商文档目前没有明确条款。我们不在没有实测的情况下承诺叠加收益；实施阶段会用一次 A/B 小批实测确认，并把厂商账单的用量字段截图附在交付报告里。"

**可直接交给工程执行的验证方法（一次批量即可验证，成本极低）**：

1. 选同一个小模型、同一条长前缀（≥1024 token 可缓存长度），准备两组各 20 条请求。
2. A 组不带任何缓存标记；B 组在长前缀上加缓存控制字段（Anthropic 用 `cache_control`，OpenAI 用自动缓存或 `prompt_cache_key`）。
3. 两组分别提交为**两个独立批次**，取回结果后读出每条 `usage` 里的缓存相关计数（如 `cached_tokens` / `cache_creation_input_tokens` / `cache_read_input_tokens`）。
4. 到账单/用量页核对这两个批次的实际计价基数。
5. 判定：若 B 组在该批次里出现缓存读写字段且单价随之下调，则**可叠加**；若字段存在但单价仍按"批量价 × 全量输入"计，则**不叠加**。

> 补充风险（需在方案里写明、待验证）：缓存通常有 5 分钟级 TTL（另有更长 TTL 选项），而批处理是「提交后统一在后台跑」，命中窗口天然难以对齐；这也是"看似能叠加、实际常常叠不上"的最可能原因——**此句为工程推断，非官方结论，禁止写进对外报告的数字部分**。

---

## 5. 抓取失败清单与替代来源（避免重复踩坑）

| 站点 | 状态 | 替代来源 | 替代源性质 |
| --- | --- | --- | --- |
| platform.openai.com / developers.openai.com / help.openai.com | **403 Cloudflare 全封**（3 次） | [Microsoft Learn：Azure OpenAI 批处理](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/batch) | 官方（微软），语义同源但**不等于 OpenAI 官方** |
| docs.anthropic.com / platform.claude.com | **跨域重定向，未被跟随**（4 次） | [claude.com 产品公告](https://claude.com/resources/articles/message-batches-api) | 官方（Anthropic 自有站点） |
| cloud.google.com / docs.cloud.google.com | **网络层 fetch failed**（3 次） | 暂无（搜索仅得第三方聚合，如 [leanlm.ai/blog/llm-batch-api](https://leanlm.ai/blog/llm-batch-api)） | **二手**，只能当线索 |
| AWS Bedrock 定价页表格 | 抓取成功但内容被截断 | [AWS 文档 batch-inference](https://docs.aws.amazon.com/bedrock/latest/userguide/batch-inference.html)、[AWS 官方博客](https://builder.aws.com/content/3GZJGpsMGRLaqvg6TAG8cZXisQR) | 官方 / 官方博客 |
| AWS Bedrock 配额页（general/latest/gr/bedrock.html） | 本轮未抓（额度用尽） | 同上文档页指向该页 | 官方（待补抓） |
| AWS `batch-inference-create` 页 | 成功但只有 Tab 骨架、无正文 | 同站点其他批处理页 | 官方 |

**待补抓清单（下一轮优先，均未核实）**：OpenAI Batch 官方折扣与 24h 窗口原文；Anthropic 批处理文档全文（含结果 `results_url`、24h 过期与计费条款、缓存支持）；Vertex Batch Prediction 折扣与时限；Bedrock 单任务记录数/超时配额；Bedrock 批处理是否支持 prompt caching。

---

## 6. 交付用检查表（12 项，可直接套客户环境）

| # | 检查项 | 判据 / 官方依据 |
| --- | --- | --- |
| 1 | 该负载能否容忍最长 24h 延迟？ | Anthropic <24h；Azure 24h 目标；Bedrock **无完成时限保证** |
| 2 | 是否存在请求间状态依赖？有则不可整批化 | 结果顺序与输入不一致（Azure 官方） |
| 3 | 是否用了 Bedrock `Converse` + tool calling？ | 带 `toolConfig` 的记录 400 失败（AWS 官方） |
| 4 | 是否跑在 provisioned/预留模型上？ | Bedrock 批处理不支持 provisioned（AWS 官方） |
| 5 | 是否已建 `Global-Batch` 类专用部署？ | Azure 需单独部署类型 + 独立 enqueued token 配额（官方） |
| 6 | `completion_window` 是否写了 `24h`？ | 填其他值直接失败（Azure 官方） |
| 7 | 每条请求是否有稳定唯一 `custom_id` 并落库？ | 官方要求，回填唯一依据 |
| 8 | 是否有"部分结果合并 + 剩余补跑"逻辑？ | `Expired` / `PartiallyCompleted` / `cancelled` 都会只剩部分结果 |
| 9 | 是否有软截止降级到同步的开关？ | AWS 官方参考架构的核心机制 |
| 10 | 状态轮询间隔是否 ≥60 秒？ | Azure 官方建议 |
| 11 | 计费口径是否按"已处理 token"而非"提交量"？ | 取消只收已处理部分（AWS 官方博客） |
| 12 | 缓存叠加收益是否已实测后再写进承诺？ | 四家均无官方明文，**本轮未核实** |

### 6.1 客户沟通话术（口语版，可直接念）

- **"能省多少？"** → "Anthropic 和 Azure 官方都是明确 50%，输入输出都算；AWS 官方写的是'最高 50%'，而且**不保证完成时间**。所以报价我按 50% 上限算，但交付文档里会写明这是上限不是保底。"
- **"多久出结果？"** → "Anthropic 说 24 小时内完成、通常更快；Azure 的 24 小时是**目标值**，超时不会自动取消，你可以等也可以取消，只收已完成部分；AWS 干脆不承诺时间，得自己加超时降级。"
- **"能不能再叠加缓存省更多？"** → "官方没写能叠，我不拍胸脯。花几块钱跑一次 A/B 实测，把账单字段截图给你看，能叠我们才算进收益。"
- **"改造难不难？"** → "要新加一条链路：提交、轮询、校验、回填、补跑。最小版本用脚本加数据库就能跑；如果你们有硬截止，得再加一个'快到期就切同步'的开关。"

---

## 7. 一句话结论

批处理是**最容易落地、单位收益最明确**的降本手段（Anthropic/Azure 官方 50%，输入输出同降；Bedrock 最高 50%），但**代价是延迟不可控**：Anthropic 承诺 24h 内、Azure 24h 只是目标、Bedrock 明确不保证。真正决定成败的不是折扣，而是**状态机、幂等 `custom_id` 回填、以及"超窗降级到同步"的兜底通道**这三件事。