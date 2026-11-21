#!/usr/bin/env node
/**
 * estimate.mjs —— 通用节省计算器 CLI
 *
 * 用法：
 *   node scripts/estimate.mjs <bill.json>                  # 人类可读表格
 *   node scripts/estimate.mjs <bill.json> --format json    # 完整结果 JSON
 *   node scripts/estimate.mjs <bill.json> --format md      # Markdown 报告片段
 *   node scripts/estimate.mjs <bill.json> --out result.json
 *   node scripts/estimate.mjs --list                       # 列出 18 项矩阵
 *
 * 这是薄壳：所有计算在 lib/estimate.mjs，本文件只负责读入、格式化、写出。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { estimate } from '../lib/estimate.mjs';
import { WASTE_ITEMS, EVIDENCE, VERDICT } from '../lib/matrix.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = { _: [], format: 'text' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--format') args.format = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--list') args.list = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else if (a.startsWith('--')) args[a.slice(2)] = true;
    else args._.push(a);
  }
  return args;
}

const STATUS_LABEL = {
  hit: '命中',
  miss: '未命中',
  unmeasurable: '待核实',
  indicator: '指标',
  avoid: '不建议',
  error: '异常',
};

const VERDICT_LABEL = {
  [VERDICT.RECOMMEND]: '建议做',
  [VERDICT.CONDITIONAL]: '视情况',
  [VERDICT.AVOID]: '不建议做',
  [VERDICT.NA]: '不适用',
};

function fmtMoney(n, currency = 'CNY') {
  if (!Number.isFinite(n)) return '—';
  const sym = currency === 'USD' ? '$' : '¥';
  return `${sym}${n.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`;
}

function pad(s, n) {
  const str = String(s ?? '');
  const w = [...str].reduce((acc, ch) => acc + (ch.charCodeAt(0) > 127 ? 2 : 1), 0);
  return str + ' '.repeat(Math.max(0, n - w));
}

function renderText(result) {
  const { meta, findings, identifiedTotal, realizedTotal, avoidList, missing } = result;
  const L = [];
  L.push('');
  L.push('LLM 成本审计结果');
  L.push('═'.repeat(60));
  L.push(`账单期间   ${meta.period || '未标注'}`);
  L.push(`币种       ${meta.currency}`);
  L.push(`总成本     ${fmtMoney(meta.totalCost, meta.currency)}`);
  L.push(`模型数     ${meta.modelCount}`);
  L.push('');
  L.push('【已识别节省（identified）】');
  L.push('─'.repeat(60));
  L.push(`金额合计   ${fmtMoney(identifiedTotal.value, meta.currency)}`);
  if (identifiedTotal.pctOfTotal != null) {
    L.push(`占总额     ${identifiedTotal.pctOfTotal}%`);
  }
  L.push(`计算方法   ${identifiedTotal.method}`);
  if (identifiedTotal.capped) L.push('⚠ 已封顶：原始合计超过总成本，按总成本封顶');
  L.push('');
  L.push('合并明细：');
  for (const b of identifiedTotal.breakdown) {
    const tag = b.kind === 'overlap-group' ? `同源组[${b.ids.join('/')}]→取${b.picked}` : b.picked;
    L.push(`  · ${pad(tag, 28)} ${fmtMoney(b.saving, meta.currency)}`);
  }
  if (identifiedTotal.excludedFromTotal.length) {
    L.push('');
    L.push('已排除（证据不足，不计入合计）：');
    for (const e of identifiedTotal.excludedFromTotal) {
      L.push(`  · ${pad(e.id, 6)} ${fmtMoney(e.saving, meta.currency)}  证据=${e.evidence}`);
    }
  }
  L.push('');
  L.push('【已实现节省（realized）】');
  L.push('─'.repeat(60));
  L.push(`数值       ${realizedTotal === null ? 'null（未做 A/B 对照）' : fmtMoney(realizedTotal, meta.currency)}`);
  L.push(`说明       ${result.realizedNote}`);
  L.push('');
  L.push('【逐项结果】');
  L.push('─'.repeat(60));
  L.push(`${pad('编号', 6)}${pad('浪费项', 30)}${pad('状态', 10)}${pad('金额', 14)}${pad('证据', 12)}`);
  for (const f of findings) {
    L.push(
      `${pad(f.id, 6)}${pad(f.name, 30)}${pad(STATUS_LABEL[f.status] || f.status, 10)}${pad(
        Number.isFinite(f.saving) ? fmtMoney(f.saving, meta.currency) : '—',
        14
      )}${pad(f.evidence, 12)}`
    );
    if (f.reason) L.push(`      ↳ ${f.reason}`);
  }
  L.push('');
  L.push('【不建议做（差异化所在）】');
  L.push('─'.repeat(60));
  for (const a of avoidList) {
    L.push(`  ${a.id} ${a.name}`);
    L.push(`     ${a.reason}`);
  }
  if (missing.length) {
    L.push('');
    L.push('【缺数据项】');
    L.push('─'.repeat(60));
    for (const m of missing) {
      L.push(`  ${m.id}: 需要 ${m.requires.join('、')}`);
    }
  }
  L.push('');
  L.push('─'.repeat(60));
  L.push('纪律：identified ≠ realized；百分比不可相加；厂商宣传数字不计入合计。');
  L.push('');
  return L.join('\n');
}

function renderMd(result) {
  const { meta, findings, identifiedTotal, avoidList } = result;
  const L = [];
  L.push(`## 节省测算结果`);
  L.push('');
  L.push(`- 账单期间：${meta.period || '未标注'}`);
  L.push(`- 总成本：${fmtMoney(meta.totalCost, meta.currency)}`);
  L.push(`- 已识别节省：**${fmtMoney(identifiedTotal.value, meta.currency)}**（占总额 ${identifiedTotal.pctOfTotal ?? '—'}%）`);
  L.push(`- 已实现节省：**null**（未做 A/B 对照）`);
  L.push('');
  L.push(`> ${identifiedTotal.method}`);
  L.push('');
  L.push('| 编号 | 浪费项 | 状态 | 金额 | 证据 | 说明 |');
  L.push('|---|---|---|---|---|---|');
  for (const f of findings) {
    L.push(
      `| ${f.id} | ${f.name} | ${STATUS_LABEL[f.status] || f.status} | ${
        Number.isFinite(f.saving) ? fmtMoney(f.saving, meta.currency) : '—'
      } | ${f.evidence} | ${(f.reason || '').replace(/\|/g, '\\|')} |`
    );
  }
  L.push('');
  L.push('### 不建议做');
  L.push('');
  for (const a of avoidList) {
    L.push(`- **${a.id} ${a.name}**：${a.reason}`);
  }
  L.push('');
  return L.join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0]);
    return;
  }

  if (args.list) {
    console.log('');
    console.log(`${pad('编号', 6)}${pad('浪费项', 34)}${pad('结论', 12)}${pad('可计算性', 16)}证据`);
    console.log('─'.repeat(90));
    for (const it of WASTE_ITEMS) {
      console.log(
        `${pad(it.id, 6)}${pad(it.name, 34)}${pad(VERDICT_LABEL[it.verdict], 12)}${pad(it.kind, 16)}${it.evidence}`
      );
    }
    console.log('');
    return;
  }

  const billPath = args._[0];
  if (!billPath) {
    console.error('用法：node scripts/estimate.mjs <bill.json> [--format text|json|md] [--out file]');
    console.error('      node scripts/estimate.mjs --list');
    process.exit(2);
  }

  const abs = path.resolve(billPath);
  if (!fs.existsSync(abs)) {
    console.error(`找不到账单文件：${abs}`);
    process.exit(2);
  }

  let bill;
  try {
    bill = JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch (e) {
    console.error(`账单 JSON 解析失败：${e.message}`);
    process.exit(2);
  }

  const result = estimate(bill);

  let output;
  if (args.format === 'json') output = JSON.stringify(result, null, 2);
  else if (args.format === 'md') output = renderMd(result);
  else output = renderText(result);

  if (args.out) {
    fs.writeFileSync(path.resolve(args.out), output, 'utf8');
    console.error(`已写出：${path.resolve(args.out)}`);
  } else {
    console.log(output);
  }
}

main();
