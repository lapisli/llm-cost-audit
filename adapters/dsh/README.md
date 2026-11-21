# DSH 适配器（参考实现）

这三个脚本读的是 **DeepSeek Harness (DSH)** 的本地账本与会话日志格式。
它们**不能直接用于其他环境** —— 保留在这里，是因为它们证明了这套方法在真实系统上跑通过，也可以作为你写自己适配器的参考。

## 为什么单独放

`scripts/` 下的 `estimate.mjs` 与 `ingest.mjs` 是通用的：输入统一 JSON，不依赖任何特定平台。
这三个脚本依赖具体的文件路径与二进制格式，混在通用脚本里会让人误以为开箱即用。

## 文件

| 文件 | 读什么 | 干什么 |
|---|---|---|
| `audit-cost.mjs` | `<DSH_HOME>/storages/usage-stats-cache.json`（v7 格式） | 账本总览 / 每模型·每日·每小时成本 / 时段分档计价 / 反事实对比 |
| `friction-scan.mjs` | `<DSH_HOME>/sessions/**/session.v4.jsonl.zstd` | 会话日志里的摩擦事件：重试 / prune / 隐藏调用 |
| `ab-context.mjs` | 同上两者 | 7 天 A/B 复测：平均上下文/请求对照 |

## 用法

```bash
# 显式指定 DSH_HOME，或设置同名环境变量
node adapters/dsh/audit-cost.mjs --home /path/to/dsh-home --out cost.json
node adapters/dsh/friction-scan.mjs --home /path/to/dsh-home --last 10
node adapters/dsh/ab-context.mjs --home /path/to/dsh-home --base 2026-10-01:2026-10-07 --test 2026-10-08:2026-10-14
```

全部只读，不修改任何文件。

## 想给自己的平台写适配器？

不需要照抄这三个。正确做法是：

1. 从你的平台导出用量数据（模型、缓存命中 token、未命中 token、输出 token、请求数、金额）
2. 用 `scripts/ingest.mjs --from generic --map ...` 归一化，或者直接手写统一 JSON
3. 交给 `scripts/estimate.mjs`

统一 JSON 的契约见 [`examples/sample-bill.json`](../../examples/sample-bill.json)。
如果你的平台能导出 CSV，通常一个 `--map` 就够了，不用写代码。

## 账本格式（供参考）

`usage-stats-cache.json` v7 结构：

```json
{
  "version": 7,
  "sessions": {
    "<session-id>": {
      "kind": "chat",
      "consumed": { "input": 0, "cachedInput": 0, "output": 0 },
      "title": "...",
      "days": { "2026-10-01": { ... } },
      "hours": { "09": { ... } }
    }
  }
}
```

字段名可能随版本变化。脚本里已按 v7 写死，遇到新版本需要同步更新。
