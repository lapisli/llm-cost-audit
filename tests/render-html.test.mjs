import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { estimate } from '../lib/estimate.mjs';
import { renderHtml } from '../lib/render-html.mjs';

const bill = JSON.parse(
  fs.readFileSync(new URL('../examples/sample-bill.json', import.meta.url), 'utf8')
);
const result = estimate(bill);
const html = renderHtml(result);

test('输出是完整 HTML 文档', () => {
  assert.ok(html.startsWith('<!DOCTYPE html>'));
  assert.ok(html.trim().endsWith('</html>'));
  assert.ok(html.includes('<meta charset="utf-8">'));
});

test('自包含：没有外链资源', () => {
  assert.ok(!/<script/i.test(html), '不应有 script 标签');
  assert.ok(!/<link[^>]+href=/i.test(html), '不应有外链样式表');
  assert.ok(!/https?:\/\/(?!github)/.test(html.replace(/https:\/\/semver|keepachangelog/g, '')), '不应有外链资源');
});

test('关键数字出现在报告里', () => {
  assert.ok(html.includes(result.identifiedTotal.value.toFixed(2)), '已识别节省金额');
  assert.ok(html.includes(result.meta.totalCost.toFixed(2)), '总成本');
});

test('已实现节省显示 null 而不是编一个数', () => {
  assert.ok(html.includes('null'));
  assert.ok(html.includes('未做 A/B'));
});

test('18 项矩阵全部渲染', () => {
  for (const f of result.findings) {
    assert.ok(html.includes(f.id), `缺 ${f.id}`);
  }
  const rowCount = (html.match(/<tr>/g) || []).length;
  assert.equal(rowCount, 19, '18 行数据 + 1 行表头');
});

test('「不建议做」单独成块', () => {
  assert.ok(html.includes('avoid-box'));
  for (const a of result.avoidList) {
    assert.ok(html.includes(a.id), `不建议做缺 ${a.id}`);
  }
});

test('三条纪律写在报告里', () => {
  assert.ok(html.includes('百分比不可相加'));
  assert.ok(html.includes('已实现 ≠ 已识别'));
  assert.ok(html.includes('证据不足的钱不进合计'));
});

test('用户数据被转义，不会注入标签', () => {
  const evil = {
    ...bill,
    meta: { ...bill.meta, period: '<script>alert(1)</script>' },
  };
  const out = renderHtml(estimate(evil));
  assert.ok(!out.includes('<script>alert(1)</script>'), 'period 里的 script 必须被转义');
  assert.ok(out.includes('&lt;script&gt;'), '应以实体形式出现');
});

test('缺少数据时列出缺失项', () => {
  const thin = {
    meta: { currency: 'CNY', totalCost: 100 },
    models: { 'gpt-4o': { inputCachedTokens: 0, inputUncachedTokens: 1000, outputTokens: 100, requestCount: 10 } },
  };
  const out = renderHtml(estimate(thin));
  assert.ok(out.includes('待核实'), '缺数据应判待核实');
});

test('缺失项渲染成可读文本，不是 [object Object]', () => {
  const thin = {
    meta: { currency: 'CNY', totalCost: 100 },
    models: { 'gpt-4o': { inputCachedTokens: 0, inputUncachedTokens: 1000, outputTokens: 100, requestCount: 10 } },
  };
  const out = renderHtml(estimate(thin));
  assert.ok(!out.includes('[object Object]'), '不能出现 [object Object]');
  if (out.includes('缺这些数据')) {
    assert.ok(/<li><b>W\d+<\/b>/.test(out), '缺失项应按 W 编号列成 li');
  }
});

test('可传入客户名', () => {
  const out = renderHtml(result, { client: '某客户' });
  assert.ok(out.includes('某客户'));
});

test('打印样式存在', () => {
  assert.ok(html.includes('@media print'));
});
