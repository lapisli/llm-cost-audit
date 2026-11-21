/**
 * estimate.mjs 单元测试
 *
 * 跑法：node --test tests/
 * 重点验证三条纪律有没有被代码真正执行，而不是写在文档里。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimate, computeIdentifiedTotal, OVERLAP_GROUPS } from '../lib/estimate.mjs';
import { WASTE_ITEMS, EVIDENCE, VERDICT, KIND } from '../lib/matrix.mjs';
import { isPeakHour, cachePriceRatio, unitPrice } from '../lib/prices.mjs';

const BASE_BILL = {
  meta: { currency: 'CNY', period: '2026-10' },
  models: {
    'deepseek-flash': {
      inputCachedTokens: 1970990000,
      inputUncachedTokens: 65220000,
      outputTokens: 14200000,
      requestCount: 11503,
      peak: false,
    },
  },
  totalCost: 751.5,
  assumptions: { contextTrimRatio: 0.086, peakTokenRatio: 0.181 },
};

// ── 纪律 1：百分比不可相加 ────────────────────────────

test('同源组只取最大，不相加', () => {
  const findings = [
    { id: 'W3', saving: 100, evidence: EVIDENCE.THIRD_PARTY },
    { id: 'W11', saving: 60, evidence: EVIDENCE.THIRD_PARTY },
  ];
  const r = computeIdentifiedTotal(findings, 1000);
  assert.equal(r.value, 100, 'W3/W11 同源，应取 100 而不是 160');
  assert.equal(r.breakdown[0].kind, 'overlap-group');
  assert.equal(r.breakdown[0].picked, 'W3');
});

test('独立项相加，但不超总成本', () => {
  const findings = [
    { id: 'W6', saving: 300, evidence: EVIDENCE.OFFICIAL },
    { id: 'W9', saving: 200, evidence: EVIDENCE.OFFICIAL },
  ];
  const r = computeIdentifiedTotal(findings, 400);
  assert.equal(r.rawSum, 500);
  assert.equal(r.value, 400, '应封顶到总成本');
  assert.equal(r.capped, true);
});

test('三组重叠同时存在时，每组各取最大再相加', () => {
  const findings = [
    { id: 'W3', saving: 100, evidence: EVIDENCE.THIRD_PARTY },
    { id: 'W11', saving: 80, evidence: EVIDENCE.THIRD_PARTY },
    { id: 'W2', saving: 50, evidence: EVIDENCE.OFFICIAL },
    { id: 'W10', saving: 30, evidence: EVIDENCE.OFFICIAL },
    { id: 'W9', saving: 40, evidence: EVIDENCE.OFFICIAL },
    { id: 'W16', saving: 25, evidence: EVIDENCE.OFFICIAL },
  ];
  const r = computeIdentifiedTotal(findings, 10000);
  // 100 (W3) + 50 (W2) + 40 (W9) = 190
  assert.equal(r.value, 190);
});

// ── 纪律 2：realized 默认 null ────────────────────────

test('realizedTotal 默认必须是 null', () => {
  const r = estimate(BASE_BILL);
  assert.equal(r.realizedTotal, null);
  assert.ok(r.realizedNote.includes('A/B'));
});

// ── 纪律 3：证据不足不进合计 ──────────────────────────

test('厂商宣传与未核实的数字被排除在合计外', () => {
  const findings = [
    { id: 'W12', saving: 500, evidence: EVIDENCE.VENDOR },
    { id: 'W10', saving: 300, evidence: EVIDENCE.UNVERIFIED },
    { id: 'W6', saving: 100, evidence: EVIDENCE.OFFICIAL },
  ];
  const r = computeIdentifiedTotal(findings, 10000);
  assert.equal(r.value, 100, '只有官方证据的 100 进合计');
  assert.equal(r.excludedFromTotal.length, 2);
  const ids = r.excludedFromTotal.map((x) => x.id).sort();
  assert.deepEqual(ids, ['W10', 'W12']);
});

// ── 单项行为 ────────────────────────────────────────

test('W2 命中率 96.8% 应判未命中（不要动缓存）', () => {
  const r = estimate(BASE_BILL);
  const w2 = r.findings.find((f) => f.id === 'W2');
  assert.equal(w2.status, 'miss');
  assert.equal(w2.saving, 0);
  assert.ok(w2.metric.hitRate > 96);
});

test('W2 命中率 0% 应判命中且给出正数金额', () => {
  const bill = JSON.parse(JSON.stringify(BASE_BILL));
  bill.models['deepseek-flash'].inputCachedTokens = 0;
  bill.models['deepseek-flash'].inputUncachedTokens = 100000000;
  const r = estimate(bill);
  const w2 = r.findings.find((f) => f.id === 'W2');
  assert.equal(w2.status, 'hit');
  assert.ok(w2.saving > 0, '未命中缓存时应能算出正数节省');
});

test('W18 高峰占比低时只出指标，不报成节省', () => {
  const r = estimate(BASE_BILL); // peakTokenRatio = 0.181
  const w18 = r.findings.find((f) => f.id === 'W18');
  assert.equal(w18.status, 'indicator');
  assert.equal(w18.saving, null, '杠杆已占满，不得报成钱');
  assert.ok(w18.metric.theoreticalCeiling > 0);
});

test('W18 高峰占比高时应报成可省金额', () => {
  const bill = JSON.parse(JSON.stringify(BASE_BILL));
  bill.assumptions.peakTokenRatio = 0.8;
  const r = estimate(bill);
  const w18 = r.findings.find((f) => f.id === 'W18');
  assert.equal(w18.status, 'hit');
  assert.ok(w18.saving > 0);
});

test('W3 缺可裁剪比例时只能待核实，不给数', () => {
  const bill = JSON.parse(JSON.stringify(BASE_BILL));
  delete bill.assumptions.contextTrimRatio;
  const r = estimate(bill);
  const w3 = r.findings.find((f) => f.id === 'W3');
  assert.equal(w3.status, 'unmeasurable');
  assert.equal(w3.saving, null);
});

test('W1 没有影子评测时不给数', () => {
  const r = estimate(BASE_BILL);
  const w1 = r.findings.find((f) => f.id === 'W1');
  assert.equal(w1.status, 'unmeasurable');
  assert.equal(w1.saving, null);
  assert.ok(w1.reason.includes('质量'));
});

test('W1 影子评测通过后可以算降档收益', () => {
  const bill = JSON.parse(JSON.stringify(BASE_BILL));
  bill.assumptions.shadowEval = { passed: true, flagshipCost: 1000, smallCost: 300, qualityFloor: 95 };
  const r = estimate(bill);
  const w1 = r.findings.find((f) => f.id === 'W1');
  assert.equal(w1.status, 'hit');
  assert.equal(w1.saving, 700);
});

test('不建议做的四项永远是 avoid 且不出钱', () => {
  const r = estimate(BASE_BILL);
  for (const id of ['W5', 'W13', 'W14', 'W15']) {
    const f = r.findings.find((x) => x.id === id);
    assert.equal(f.status, 'avoid', `${id} 应判 avoid`);
    assert.equal(f.saving, null, `${id} 不得出金额`);
  }
});

// ── 结构完整性 ──────────────────────────────────────

test('矩阵恰好 18 项且 id 不重复', () => {
  assert.equal(WASTE_ITEMS.length, 18);
  const ids = new Set(WASTE_ITEMS.map((x) => x.id));
  assert.equal(ids.size, 18);
});

test('每一项都有证据等级与结论档位', () => {
  const validEvidence = new Set(Object.values(EVIDENCE));
  const validVerdict = new Set(Object.values(VERDICT));
  const validKind = new Set(Object.values(KIND));
  for (const it of WASTE_ITEMS) {
    assert.ok(validEvidence.has(it.evidence), `${it.id} 证据等级非法`);
    assert.ok(validVerdict.has(it.verdict), `${it.id} 结论档位非法`);
    assert.ok(validKind.has(it.kind), `${it.id} 可计算性非法`);
  }
});

test('重叠组的成员都真实存在', () => {
  const ids = new Set(WASTE_ITEMS.map((x) => x.id));
  for (const group of OVERLAP_GROUPS) {
    for (const id of group) assert.ok(ids.has(id), `重叠组含不存在的项 ${id}`);
  }
});

test('estimate 输出包含全部 18 项，顺序与矩阵一致', () => {
  const r = estimate(BASE_BILL);
  assert.equal(r.findings.length, 18);
  assert.deepEqual(r.findings.map((f) => f.id), WASTE_ITEMS.map((x) => x.id));
});

test('空账单不抛异常，全部判待核实', () => {
  const r = estimate({});
  assert.equal(r.findings.length, 18);
  assert.equal(r.identifiedTotal.value, 0);
  assert.equal(r.realizedTotal, null);
});

// ── 价格表 ─────────────────────────────────────────

test('DeepSeek 缓存价差应为 50 倍 / 30 倍', () => {
  assert.equal(cachePriceRatio('deepseek-flash', { peak: false }), 50);
  assert.equal(cachePriceRatio('deepseek-v4-pro', { peak: false }), 30);
});

test('错峰判定：工作日 9-12 与 14-18 是高峰，其余空闲', () => {
  // 2026-11-23 是周一
  const at = (h) => new Date(Date.UTC(2026, 10, 23, h, 0, 0));
  assert.equal(isPeakHour(at(9)).peak, true);
  assert.equal(isPeakHour(at(11)).peak, true);
  assert.equal(isPeakHour(at(12)).peak, false, '午休是空闲');
  assert.equal(isPeakHour(at(14)).peak, true);
  assert.equal(isPeakHour(at(17)).peak, true);
  assert.equal(isPeakHour(at(18)).peak, false);
  assert.equal(isPeakHour(at(3)).peak, false);
});

test('错峰判定：周末与法定节假日全天空闲', () => {
  const sat = new Date(Date.UTC(2026, 10, 21, 10, 0, 0));
  assert.equal(isPeakHour(sat).peak, false);
  const weekday = new Date(Date.UTC(2026, 10, 23, 10, 0, 0));
  assert.equal(isPeakHour(weekday, ['2026-11-23']).peak, false, '节假日覆盖工作日');
});

test('未收录的模型返回 null 而不是猜一个价', () => {
  assert.equal(unitPrice('not-a-real-model', 'input.cached'), null);
  assert.equal(cachePriceRatio('not-a-real-model'), null);
});

// ── 多模型账单 ──────────────────────────────────────

const MULTI_BILL = {
  meta: { currency: 'USD', period: '2026-10' },
  prices: {
    'gpt-4o': { inputCached: 1.25, inputUncached: 2.5, output: 10 },
    'gpt-4o-mini': { inputCached: 0.075, inputUncached: 0.15, output: 0.6 },
  },
  models: {
    'gpt-4o': { inputCachedTokens: 4000000, inputUncachedTokens: 1000000, outputTokens: 200000, requestCount: 1000 },
    'gpt-4o-mini': { inputCachedTokens: 1800000, inputUncachedTokens: 200000, outputTokens: 300000, requestCount: 8000 },
  },
  totalCost: 100,
  assumptions: { peakTokenRatio: 0.5 },
};

test('按模型算的项要把所有模型加起来，不能只算第一个', () => {
  const r = estimate(MULTI_BILL);
  const w2 = r.findings.find((f) => f.id === 'W2');
  assert.equal(w2.status, 'hit');
  assert.ok(w2.perModel, '多模型时应给出 perModel 明细');
  assert.equal(w2.perModel.length, 2);
  const sum = w2.perModel.reduce((a, x) => a + (x.saving || 0), 0);
  assert.equal(w2.saving, Math.round(sum * 100) / 100);
});

test('按总账算的项只算一次，不因模型多而翻倍', () => {
  const one = JSON.parse(JSON.stringify(MULTI_BILL));
  one.models = { 'gpt-4o': MULTI_BILL.models['gpt-4o'] };
  const two = MULTI_BILL;

  const r1 = estimate(one);
  const r2 = estimate(two);
  const w18a = r1.findings.find((f) => f.id === 'W18');
  const w18b = r2.findings.find((f) => f.id === 'W18');
  assert.equal(w18a.saving, w18b.saving, 'W18 按总账算，模型数不影响结果');
});

test('账单自带 prices 时，未收录模型也能算', () => {
  const r = estimate(MULTI_BILL);
  const w2 = r.findings.find((f) => f.id === 'W2');
  assert.ok(Number.isFinite(w2.saving) && w2.saving > 0);
  assert.ok(!String(w2.reason).includes('不在价格表'));
});

test('账单不带 prices 且模型未收录时，显式说算不出而不是给 0', () => {
  const bill = JSON.parse(JSON.stringify(MULTI_BILL));
  delete bill.prices;
  const r = estimate(bill);
  const w2 = r.findings.find((f) => f.id === 'W2');
  assert.equal(w2.status, 'unmeasurable');
  assert.equal(w2.saving, null);
  assert.ok(w2.reason.includes('不在价格表'));
});

