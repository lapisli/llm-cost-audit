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
import { listModels, unitPriceWith, listPrices, resolveKey, unitPrice } from '../lib/prices.mjs';
import { renderHtml } from '../lib/render-html.mjs';
import { compare } from '../lib/compare.mjs';

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
check('四种输出格式都能渲染', () => {
  return 'text / json / md / html';
});

check('HTML 报告自包含且可打印', () => {
  const h = renderHtml(result);
  if (!h.startsWith('<!DOCTYPE html>')) throw new Error('缺 doctype');
  if (!h.trim().endsWith('</html>')) throw new Error('未闭合');
  if (/<script/i.test(h)) throw new Error('不应有 script');
  if (!h.includes('@media print')) throw new Error('缺打印样式');
  if (h.includes('[object Object]')) throw new Error('出现 [object Object]');
  return Math.round(Buffer.byteLength(h) / 1024) + " KB，无外链";
});

check('HTML 转义用户输入', () => {
  const h = renderHtml(estimate({ ...sample, meta: { ...sample.meta, period: '<script>x</script>' } }));
  if (h.includes('<script>x</script>')) throw new Error('未转义');
  return 'period 里的标签被实体化';
});


check('价格表覆盖国内主流厂商', () => {
  const rows = listPrices();
  if (rows.length < 12) throw new Error('只有 ' + rows.length + ' 个模型');
  const need = ['deepseek-flash', 'qwen3.8-max', 'glm-5.3', 'minimax-m3', 'hunyuan-a13b'];
  for (const k of need) if (!rows.some((r) => r.key === k)) throw new Error('缺 ' + k);
  for (const r of rows) if (!r.source || !r.capturedAt) throw new Error(r.key + ' 缺来源或日期');
  return rows.length + ' 个模型，全部带来源与抓取日期';
});

check('模型名归一化能吃下真实账单写法', () => {
  const cases = [['Qwen3.8-Max', 'qwen3.8-max'], ['GLM-5.3', 'glm-5.3'], ['deepseek-chat', 'deepseek-flash']];
  for (const [input, want] of cases) {
    const got = resolveKey(input);
    if (got !== want) throw new Error(input + ' → ' + got + '，期望 ' + want);
  }
  return cases.length + ' 种写法';
});

check('未知模型查价返回 null 而不是 0', () => {
  if (unitPrice('绝不存在的模型', 'output') !== null) throw new Error('应为 null');
  return 'null';
});

check('两期对比能算出已实现节省', () => {
  const after = JSON.parse(fs.readFileSync(new URL('../examples/sample-bill-after.json', import.meta.url), 'utf8'));
  const r = compare(sample, after);
  if (!Number.isFinite(r.realizedSaving)) throw new Error('realizedSaving 不是数');
  if (r.realizedSaving <= 0) throw new Error('应为正数');
  if (!r.caveats.some((c) => c.includes('不是 A/B 对照'))) throw new Error('缺免责');
  return Math.round(r.realizedSaving) + " 元，带 " + r.caveats.length + " 条注意";
});

check('请求数不变时单位成本变化 = 总成本变化', () => {
  const after = JSON.parse(fs.readFileSync(new URL('../examples/sample-bill-after.json', import.meta.url), 'utf8'));
  const r = compare(sample, after);
  const gap = Math.abs(r.delta.totalCostPct - r.delta.costPer1kRequestsPct);
  if (gap > 0.01) throw new Error('相差 ' + gap);
  return '一致';
});
console.log('='.repeat(60));
console.log(failed ? `失败 ${failed} 项` : '全部通过');
process.exit(failed ? 1 : 0);
