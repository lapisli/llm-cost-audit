#!/usr/bin/env node
/**
 * compare.mjs —— 两期账单对比 CLI
 *
 * 用法：
 *   node scripts/compare.mjs before.json after.json
 *   node scripts/compare.mjs before.json after.json --format json
 *   node scripts/compare.mjs before.json after.json --format md --out diff.md
 *
 * 这是薄壳：逻辑在 lib/compare.mjs。
 */

import fs from 'node:fs';
import path from 'node:path';
import { compare, formatCompareText } from '../lib/compare.mjs';

function parseArgs(argv) {
  const args = { _: [], format: 'text' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--format') args.format = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--help' || a === '-h') args.help = true;
    else args._.push(a);
  }
  return args;
}

function readBill(p) {
  const abs = path.resolve(p);
  if (!fs.existsSync(abs)) {
    console.error(`找不到账单文件：${abs}`);
    process.exit(2);
  }
  try {
    return JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch (e) {
    console.error(`账单 JSON 解析失败（${abs}）：${e.message}`);
    process.exit(2);
  }
}

function renderMd(r) {
  const cur = r.after.currency === 'USD' ? '$' : '¥';
  const money = (v) => (Number.isFinite(v) ? cur + v.toFixed(2) : '—');
  const p = (v) => (Number.isFinite(v) ? `${v > 0 ? '+' : ''}${v.toFixed(2)}%` : '—');
  const L = [];
  L.push('## 两期账单对比');
  L.push('');
  L.push('| 指标 | 基线期 | 对比期 | 变化 |');
  L.push('|---|---|---|---|');
  L.push(`| 总成本 | ${money(r.before.totalCost)} | ${money(r.after.totalCost)} | ${p(r.delta.totalCostPct)} |`);
  L.push(`| 请求数 | ${r.before.requestCount} | ${r.after.requestCount} | ${p(r.delta.requestCountPct)} |`);
  L.push(
    `| 每千次请求成本 | ${money(r.before.costPer1kRequests)} | ${money(r.after.costPer1kRequests)} | ${p(r.delta.costPer1kRequestsPct)} |`
  );
  L.push(
    `| 每百万 token 成本 | ${money(r.before.costPerMillionTokens)} | ${money(r.after.costPerMillionTokens)} | ${p(r.delta.costPerMillionTokensPct)} |`
  );
  L.push(
    `| 缓存命中率 | ${r.before.cacheHitRate != null ? (r.before.cacheHitRate * 100).toFixed(1) + '%' : '—'} | ${r.after.cacheHitRate != null ? (r.after.cacheHitRate * 100).toFixed(1) + '%' : '—'} | ${p(r.delta.cacheHitRatePct)} |`
  );
  L.push('');
  L.push(`**剔除用量变化后的已实现节省：${money(r.realizedSaving)}**`);
  L.push('');
  L.push('> 注意：');
  for (const c of r.caveats) L.push(`> - ${c}`);
  L.push('');
  return L.join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('*/')[0]);
    return;
  }

  if (args._.length < 2) {
    console.error('用法：node scripts/compare.mjs <基线期.json> <对比期.json> [--format text|json|md] [--out file]');
    process.exit(2);
  }

  const before = readBill(args._[0]);
  const after = readBill(args._[1]);
  const result = compare(before, after);

  let output;
  if (args.format === 'json') output = JSON.stringify(result, null, 2);
  else if (args.format === 'md') output = renderMd(result);
  else output = formatCompareText(result);

  if (args.out) {
    fs.writeFileSync(path.resolve(args.out), output, 'utf8');
    console.error(`已写出：${path.resolve(args.out)}`);
  } else {
    console.log(output);
  }
}

main();
