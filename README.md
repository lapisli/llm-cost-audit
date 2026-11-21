# llm-cost-audit

**把 LLM 账单跑成一张可复核的浪费清单 —— 18 项判据，出金额，出证据等级，并且明确告诉你哪些不建议做。**

[![CI](https://github.com/lapisli/llm-cost-audit/actions/workflows/ci.yml/badge.svg)](https://github.com/lapisli/llm-cost-audit/actions/workflows/ci.yml)
[![tests](https://img.shields.io/badge/tests-48%20passing-brightgreen)]()
[![license](https://img.shields.io/badge/license-MIT-blue)]()

---

## 它解决什么问题

你打开 LLM 账单，看到一个数字。然后呢？

大多数「AI 成本优化」资料停在第一步：列一堆手段 —— 缓存、路由、批处理、压缩 —— 却不告诉你**在你这张账单上**哪些真的有钱、能省多少、值不值得动。

这个项目把它做成了一个**能跑的计算器**：

```bash
node scripts/ingest.mjs usage.json --from openai --out bill.json
node scripts/estimate.mjs bill.json
```

```
LLM 成本审计结果
════════════════════════════════════════════════════════════
账单期间   2026-10
总成本     ¥751.5
模型数     1

【已识别节省（identified）】
金额合计   ¥28.78
占总额     3.83%
计算方法   联合反事实：同源组取最大 + 独立项相加 + 总额封顶

【已实现节省（realized）】
数值       null（未做 A/B 对照）
```

注意最后那个 `null`。**它没有给你一个漂亮的百分比。** 这是刻意的。

---

## 三个和别处不一样的地方

### 1. 它敢说「不建议做」

18 项里有 4 项被明确标为不建议做，并给出理由：

| 项 | 为什么劝你别做 |
|---|---|
| **W5 失败与重试** | 429 是被拒绝的请求，通常不计费。把 380 次重试报成节省就是忽悠 |
| **W13 供应商价差套利** | 无可引用的实时价差表；中转站有合规风险，不适合作承重点 |
| **W14 自托管替代 API** | 利用率 7% 才与 API 打平，5% 比 API 还贵。break-even 算错是交付者责任 |
| **W15 微调 / 蒸馏** | 要碰客户训练数据与评测集，交付风险与报价量级不匹配 |

一份只会说「你这里可以省」的报告没有可信度。**说得出哪里不该动，才是专业的标志。**

### 2. 百分比不许相加

把「路由省 85% ＋ 缓存省 90% ＋ 批处理省 50%」加成一个数字，是这个行业最容易被客户当场戳穿的错误。五条理由：分母不同、叠加无条文、杠杆互相反杀、identified ≠ realized、只有可验算的才敢承诺。

代码里的做法是**联合反事实**：

- 同源项（W3/W11 上下文、W2/W10 缓存、W9/W16 调用次数）取组内**最大**，不相加
- 独立项相加
- 总额封顶到账单实际金额
- `厂商宣传` 和 `未核实` 的金额自动排除在合计之外

### 3. 每个数字带证据等级

只用五个词：`官方` / `论文` / `第三方实测` / `厂商宣传` / `未核实`。

**「厂商宣传」的数字不得当作独立证据。** 工具会把它单独列在 `excludedFromTotal` 里，让你看得见但不算进钱。

---

## 快速开始

需要 Node.js 18+，无第三方依赖。

```bash
git clone https://github.com/<your-name>/llm-cost-audit.git
cd llm-cost-audit

# 看 18 项矩阵长什么样（不需要账单）
node scripts/estimate.mjs --list

# 用内置示例跑一遍（数据来自一次真实自审）
node scripts/estimate.mjs examples/sample-bill.json

# 跑测试（48 项）
npm test

# 端到端验收（18 项矩阵 + 三条纪律实测）
npm run selftest
```

### 输入格式

支持四种来源：

```bash
node scripts/ingest.mjs usage.json  --from openai     --out bill.json
node scripts/ingest.mjs usage.json  --from anthropic  --out bill.json
node scripts/ingest.mjs logs.jsonl  --from litellm    --out bill.json
node scripts/ingest.mjs data.csv    --from generic \
  --map model=model,input_tokens=inputTotalTokens,cached_tokens=inputCachedTokens,\
output_tokens=outputTokens,requests=requestCount,cost=totalCost --out bill.json
```

认不出的字段会写进 `warnings`，**不会猜一个值填进去**。

关于 `inputTotalTokens`：多数导出的 `input_tokens` **包含**缓存命中部分。
映射成 `inputTotalTokens` 后，适配器会自动减掉 `cached_tokens` 得到真实未命中量；
如果直接映射成 `inputUncachedTokens`，就会把缓存命中的 token 按未命中价重复计费。

`examples/usage.csv` 是一个可直接跑的样例。

### 账单里自带价格（推荐）

客户手上的合同价永远比公开价准。任何模型都能算，不必等我们收录：

```json
{
  "meta": { "currency": "CNY", "period": "2026-10" },
  "prices": {
    "your-model": { "inputCached": 0.5, "inputUncached": 4, "output": 16 }
  },
  "models": {
    "your-model": {
      "inputCachedTokens": 1970990000,
      "inputUncachedTokens": 65220000,
      "outputTokens": 14200000,
      "requestCount": 11503
    }
  },
  "totalCost": 751.5
}
```

---

## 18 项矩阵

| 编号 | 浪费项 | 证据 | 结论 |
|---|---|---|---|
| W1 | 模型超配：低复杂度功能走旗舰模型 | 论文 | 视情况 |
| W2 | 固定前缀未缓存 | 官方 | 视情况 |
| W3 | 上下文过长 | 第三方实测 | **建议做** |
| W4 | 输出无上限 | 未核实 | 视情况 |
| W5 | 失败与重试浪费 | 未核实 | **不建议** |
| W6 | 可批处理却走同步 | 官方 | **建议做** |
| W7 | 环境未分离 | 未核实 | **建议做** |
| W8 | 重复嵌入 / 重复注入 | 未核实 | 视情况 |
| W9 | Agent 循环失控与隐藏调用 | 官方 | **建议做** |
| W10 | 超长 preamble / 重复工具定义 | 未核实 | 视情况 |
| W11 | 上下文膨胀 | 第三方实测 | **建议做** |
| W12 | 语义缓存未启用 | 论文 | 视情况 |
| W13 | 供应商价差 / 中转站套利 | 未核实 | **不建议** |
| W14 | 自托管替代 API | 第三方实测 | **不建议** |
| W15 | 微调 / 蒸馏 | 未核实 | **不建议** |
| W16 | 多智能体放大 | 官方 | 视情况 |
| W17 | 无成本归因 / 无标签 / 无预算告警 | 未核实 | **建议做** |
| W18 | 错峰调度未做 | 官方 | 视情况 |

每项的完整判据、怎么量、典型幅度，见 [`reference/01-waste-matrix.md`](reference/01-waste-matrix.md)。

---

## 安装为 Agent Skill

这个项目同时是一个 **Agent Skill**，可以装进支持 skills 规范的客户端：

```bash
# 一条命令全装（推荐）
npx skills add <your-name>/llm-cost-audit --all

# 或手动复制
cp -r llm-cost-audit ~/.claude/skills/                    # Claude Code
cp -r llm-cost-audit ~/.codex/skills/                     # Codex
cp -r llm-cost-audit ~/.cursor/skills/                    # Cursor
cp -r llm-cost-audit ~/.config/opencode/skills/           # OpenCode
cp -r llm-cost-audit .agents/skills/                      # 项目内（Codex/Cursor/OpenCode 通用）
cp -r llm-cost-audit .claude/skills/                      # 项目内（Claude Code）
```

装好后，AI 助手在你说「帮我看看这个月 LLM 花了多少钱 / 出个成本审计报告」时会自动加载这套流程。

### 装完先自检

```bash
node scripts/verify.mjs
```

它会检查六件真会出问题的事：frontmatter 是否合规、`name` 与目录名是否一致、
SKILL.md 引用的文件是否都在、所有 `.mjs` 语法、`bin` 是否指向真实文件、
以及**私有目录有没有被误提交**。同时打印各客户端的安装路径。

---

## 项目结构

```
llm-cost-audit/
├── SKILL.md              Agent Skill 主文件（流程 + 硬约束）
├── lib/
│   ├── matrix.mjs        18 项矩阵数据结构
│   ├── prices.mjs        价格表 + 错峰判定 + 内联价回落
│   ├── estimate.mjs      计算器核心
│   └── ingest.mjs        账单适配纯函数
├── scripts/
│   ├── estimate.mjs      CLI（text / json / md）
│   ├── ingest.mjs        四路账单适配 CLI
│   ├── verify.mjs        分发自检（装完跑这个）
│   └── selftest.mjs      端到端验收（CI 用）
├── tests/
│   ├── estimate.test.mjs 26 项（计算器纪律）
│   └── ingest.test.mjs   22 项（四路适配 + 金额解析）
├── reference/            12 份带来源的知识库
├── templates/            报告模板 / Intake 邮件 / 结案模板
├── adapters/dsh/         某个平台的账本适配（参考实现，非通用）
└── examples/
    ├── sample-bill.json  可直接跑的示例账单
    └── usage.csv         CSV 适配示例
```

---

## 已知局限

诚实列出来，避免你踩坑：

1. **价格表需要维护。** 收录了 DeepSeek 官方价与几个 Claude 模型；其他厂商请用「账单内联价格」，或自行补 `lib/prices.mjs` 并注明抓取时间。
2. **需要账单数据才能算钱。** 只有用量没有金额时，能算百分比但算不出绝对金额。
3. **W3 的「可裁剪比例」必须来自你自己的 A/B 实测。** 工具不会替你假设一个压缩比。
4. **它不连任何 API。** 纯本地跑，不读你的密钥，不联网。
5. **`realizedTotal` 永远是 `null`，除非你手动填入 A/B 复测结果。** 这是设计，不是缺陷。

---

## 许可

MIT。见 [LICENSE](LICENSE)。

知识库中的第三方数字保留其原始出处；引用时请一并注明证据等级。
