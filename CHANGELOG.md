# Changelog

所有重要变更记录在此。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [2.0.0] - 2026-11-22

首个可分发版本。从「个人自用脚本集合」重写为「跨客户端 Agent Skill + CLI 工具」。

### 新增

- **`lib/estimate.mjs`** —— 18 项浪费矩阵计算器
  - 三项纪律写进代码：联合反事实（百分比不相加）、`realizedTotal` 恒为 `null`、「厂商宣传」「未核实」不计入合计
  - `scope` 字段区分 `per-model` / `global`，避免跨模型重复计入
  - 模型不在价格表时判 `unmeasurable`，不返回 `0`
- **`lib/ingest.mjs`** —— 账单适配层，支持 OpenAI / Anthropic / LiteLLM / 通用 CSV
  - `inputTotalTokens` 自动推算未命中 token（`总输入 − 缓存命中`），避免重复计费
- **`lib/render-html.mjs`** —— 自包含 HTML 报告，无 CDN、无 JS 依赖、可打印
- **`scripts/verify.mjs`** —— 分发自检，11 项（frontmatter、名称一致、引用文件、matrix doc、语法、bin、私有目录、运行时冒烟）
- **`scripts/selftest.mjs`** —— 端到端验收，16 项（矩阵完整性、四路适配器、价格表、三条纪律用示例账单实测）
- **`tests/`** —— 60 项单元测试（estimate 26 + ingest 22 + render-html 12）
- **`.github/workflows/ci.yml`** —— Node 20 / 22 / 24 三版本矩阵，测试 → 自检 → 验收三道门
- **`README.md` / `LICENSE` / `package.json` / `examples/`**

### 变更

- `SKILL.md` 重写为通用跨端格式（frontmatter + 相对路径资源），可在 Claude Code / Codex / Cursor / OpenCode 加载
- DSH 专用适配器移到 `adapters/dsh/`，明确标注「参考实现，非通用」
- 商业敏感文档（中转站合规、国内获客、同业费率、案例库）移入 `private/`，不进 git
- `scripts/ingest.mjs` 拆分为 `lib/ingest.mjs`（纯函数）+ 薄 CLI 壳，与 estimate 结构对齐

### 修复

- `num()` 不认 `¥` `￥` `€` `£`，人民币账单金额被解析成 `null`
- `adaptOpenAI()` 返回缺 `totalCost` 键，与其余三个适配器契约不一致
- CSV 适配器把含缓存的 `input_tokens` 直接当未命中，导致缓存部分重复计费
- 模型不在价格表时 `null - null = 0` 被当成「节省 ¥0」，改为判 `unmeasurable` 并给出原因
- W18 错峰调度在高峰占比 18.1% 时仍报 ¥68.01，改为只出指标不折钱（合计从 ¥96.79 修正为 ¥28.78）
- W2 只算第一个模型，多模型账单静默丢数据
- `matrix.mjs` 中 W13 的 `doc` 指向已私有化的 `reference/10-gateway-cn.md`
- HTML 报告的缺失数据区把对象数组直接字符串化，渲染出 `[object Object]`
- README 里 Cursor 项目内路径写成 `.cursor/skills/`，实际应为 `.agents/skills/`

### 已知局限

- 价格表只覆盖 5 个模型（DeepSeek ×2 + Claude ×3），其余模型需在账单里用 `prices` 字段内联
- W3 的压缩比需要外部传入（`contextTrimRatio`），无法从账单自动推断
- 未做真实客户端加载验证（开发机未安装 Claude Code / Codex / Cursor / OpenCode）
- `reference/` 里的价格与政策会过时，用前必须核对官方页面

## [1.0.0] - 2026-10-22

初始版本：18 项矩阵、知识库、报告模板、Intake 邮件模板。个人自用，未对外分发。
