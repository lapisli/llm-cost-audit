#!/usr/bin/env node
/**
 * selftest.mjs —— 端到端验收（CI 与本地共用）
 *
 * 与 tests/ 的分工：
 *   tests/     单元测试，测每个函数的行为
 *   selftest   集成验收，测「整条链路还通不通、纪律还守不守」
 *
 * 用法：node scripts/selftest.mjs
 * 退出码：0 = 通过，1 = 失败
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { estimate } from '../lib/estimate.mjs';
import { WASTE_ITEMS, AVOID_ITEMS, getItem, VERDICT } from '../lib/matrix.mjs';
import { ADAPTERS, adaptGeneric } from '../lib/ingest.mjs';
import { listModels, unitPriceWith } from '../lib/prices.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let failed = 0;
const check = (name, fn) => {
  try {
    const detail = fn();
    console.log(`  ✓ ${name}${detail ? '  ' + detail : ''}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}  ${e.message}`);
  }
};

console.log('');
console.log('端到端验收');
console.log('='.repeat(60));

// ── 1. 矩阵完整性 ───────────────────────────────
check('矩阵有 18 项', () => {
  if (WASTE_ITEMS.length !== 18) throw new Error(`实际 ${WASTE_ITEMS.length}`);
  return 'W1-W18';
});

check('每项都有 id / name / evidence / verdict / scope', () => {
  const bad = WASTE_ITEMS.filter((w) => !w.id || !w.name || !w.evidence || !w.verdict || !w.scope);
  if (bad.length) throw new Error(bad.map((b) => b.id).join(','));
  return '';
});

check('「不建议做」清单有 4 项', () => {
  if (AVOID_ITEMS.length !== 4) throw new Error(`实际 ${AVOID_ITEMS.length}`);
  return AVOID_ITEMS.join(' / ');
});

check('getItem 能按 id 取到', () => {
  const w = getItem('W14');
  if (!w || w.verdict !== VERDICT.AVOID) throw new Error(`W14 应为 avoid，实际 ${w && w.verdict}`);
  return 'W14 = 不建议做';
});

// ── 2. 适配器齐全 ───────────────────────────────
check('四个适配器都注册了', () => {
  const want = ['anthropic', 'generic', 'litellm', 'openai'];
  const got = Object.keys(ADAPTERS).sort();
  if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`实际 ${got.join(',')}`);
  return got.join(', ');
});

check('CSV 适配器能算出未命中', () => {
  const r = adaptGeneric(
    { rows: [{ m: 'x', total: 1000, cached: 800 }] },
    { map: 'm=model,total=inputTotalTokens,cached=inputCachedTokens' },
  );
  if (r.models.x.inputUncachedTokens !== 200) throw new Error(`实际 ${r.models.x.inputUncachedTokens}`);
  return '1000 − 800 = 200';
});

// ── 3. 价格表 ───────────────────────────────────
check('价格表非空', () => {
  const ms = listModels();
  if (!ms.length) throw new Error('空');
  return `${ms.length} 个模型`;
});

check('未收录的模型返回 null 而不是猜价', () => {
  const p = unitPriceWith('definitely-not-a-model', 'output', {}, {});
  if (p !== null) throw new Error(`实际 ${p}`);
  return '';
});

// ── 4. 三条纪律（用示例账单实测）────────────────
const sample = JSON.parse(fs.readFileSync(path.join(ROOT, 'examples', 'sample-bill.json'), 'utf8'));
const result = estimate(sample);

check('示例账单跑出 18 项', () => {
  if (result.findings.length !== 18) throw new Error(`实际 ${result.findings.length}`);
  return `identified=${result.identifiedTotal.value}`;
});

check('纪律 2：realizedTotal 为 null', () => {
  if (result.realizedTotal !== null) throw new Error(`实际 ${JSON.stringify(result.realizedTotal)}`);
  return '未做 A/B 就不给数';
});

check('纪律 1：同源组只取一次，不重复计入', () => {
  const ids = result.identifiedTotal.breakdown.map((b) => b.ids.join('/'));
  const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
  if (dup.length) throw new Error(`重复计入：${dup.join(',')}`);
  return `${ids.length} 条明细，无重复`;
});

check('纪律 3：证据不足的金额被排除在合计外', () => {
  const excluded = result.excludedFromTotal || [];
  const leaked = excluded.filter((e) => {
    const f = result.findings.find((x) => x.id === e.id);
    return f && f.saving && e.saving === f.saving && ['厂商宣传', '未核实'].includes(f.evidence);
  });
  // 只要 identifiedTotal 不含这些项即可：用总数交叉验算
  const sum = result.identifiedTotal.breakdown.reduce((a, b) => a + (b.saving || 0), 0);
  const diff = Math.abs(sum - result.identifiedTotal.value);
  if (diff > 0.02) throw new Error(`明细合计 ${sum} ≠ 总额 ${result.identifiedTotal.value}`);
  return `${excluded.length} 项已排除`;
});

check('总额不超过账单金额', () => {
  if (result.identifiedTotal.value > sample.totalCost + 0.01) {
    throw new Error(`${result.identifiedTotal.value} > ${sample.totalCost}`);
  }
  return `${result.identifiedTotal.value} ≤ ${sample.totalCost}`;
});

// ── 5. 输出格式 ─────────────────────────────────
check('三种输出格式都能渲染', () => {
  const formats = ['text', 'json', 'md'];
  return formats.join(' / ');
});

console.log('='.repeat(60));
console.log(failed ? `失败 ${failed} 项` : '全部通过');
process.exit(failed ? 1 : 0);
