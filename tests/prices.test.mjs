import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveKey,
  unitPrice,
  unitPriceWith,
  listModels,
  listPrices,
  applyPriceOverrides,
  clearPriceOverrides,
  cachePriceRatio,
  PRICES,
} from '../lib/prices.mjs';

beforeEach(() => clearPriceOverrides());

test('内置表覆盖国内主流厂商', () => {
  const models = listModels();
  assert.ok(models.length >= 12, `只有 ${models.length} 个模型`);
  for (const need of ['deepseek-flash', 'qwen3.8-max', 'glm-5.3', 'minimax-m3', 'hunyuan-a13b']) {
    assert.ok(models.includes(need), `缺 ${need}`);
  }
});

test('每个内置价格都带来源和抓取日期', () => {
  for (const [key, p] of Object.entries(PRICES)) {
    assert.ok(p.source, `${key} 缺 source`);
    assert.ok(p.capturedAt, `${key} 缺 capturedAt`);
    assert.ok(p.evidence, `${key} 缺 evidence`);
  }
});

test('resolveKey 处理大小写与空格', () => {
  assert.equal(resolveKey('Qwen3.8-Max'), 'qwen3.8-max');
  assert.equal(resolveKey('GLM-5.3'), 'glm-5.3');
  assert.equal(resolveKey('  MiniMax-M3  '), 'minimax-m3');
});

test('resolveKey 处理别名', () => {
  assert.equal(resolveKey('deepseek-chat'), 'deepseek-flash');
  assert.equal(resolveKey('DeepSeek V4.1 Flash'), 'deepseek-flash');
  assert.equal(resolveKey('qwen-max'), 'qwen3.8-max');
});

test('resolveKey 去掉日期后缀', () => {
  assert.equal(resolveKey('glm-5.3-2025-01-01'), 'glm-5.3');
  assert.equal(resolveKey('qwen3.8-max-2024-12-31'), 'qwen3.8-max');
});

test('未知模型返回 null 而不是 0', () => {
  assert.equal(unitPrice('完全不存在', 'output'), null);
  assert.equal(unitPrice('完全不存在', 'input.uncached'), null);
});

test('DeepSeek 有错峰两档价', () => {
  const peak = unitPrice('deepseek-flash', 'output', { peak: true });
  const off = unitPrice('deepseek-flash', 'output', { peak: false });
  assert.equal(peak, 8);
  assert.equal(off, 4);
  assert.equal(peak / off, 2, '错峰应为半价');
});

test('无错峰模型两档同价', () => {
  const a = unitPrice('glm-5.3', 'output', { peak: true });
  const b = unitPrice('glm-5.3', 'output', { peak: false });
  assert.equal(a, b);
});

test('混元未列缓存价，查出来是 null', () => {
  assert.equal(unitPrice('hunyuan-a13b', 'input.cached'), null);
  assert.equal(unitPrice('hunyuan-a13b', 'input.uncached'), 0.5);
});

test('缓存价倍率可算', () => {
  const r = cachePriceRatio('deepseek-flash');
  assert.equal(r, 50, 'flash 缓存倍率应为 50');
});

test('外部价格表覆盖内置', () => {
  applyPriceOverrides({ 'deepseek-flash': { input: { uncached: 1 }, output: 99 } });
  assert.equal(unitPrice('deepseek-flash', 'output'), 99);
});

test('外部价格表可追加新模型', () => {
  applyPriceOverrides({ 'my-model': { input: { uncached: 3, cached: 1 }, output: 6 } });
  assert.equal(unitPrice('my-model', 'output'), 6);
  assert.equal(unitPrice('my-model', 'input.cached'), 1);
});

test('外部价格表下划线字段被忽略', () => {
  const n = applyPriceOverrides({
    _说明: '这是注释',
    _单位: '元/百万',
    'my-model': { input: { uncached: 3 }, output: 6 },
  });
  assert.deepEqual(n, ['my-model']);
});

test('外部价格表缺关键字段会抛错', () => {
  assert.throws(() => applyPriceOverrides({ bad: { input: {} } }), /至少要给/);
});

test('外部价格表非对象会抛错', () => {
  assert.throws(() => applyPriceOverrides(null), /必须是一个对象/);
  assert.throws(() => applyPriceOverrides('x'), /必须是一个对象/);
});

test('覆盖项默认标未核实，不冒充官方', () => {
  applyPriceOverrides({ 'my-model': { input: { uncached: 3 }, output: 6 } });
  const row = listPrices().find((r) => r.key === 'my-model');
  assert.equal(row.evidence, '未核实');
  assert.equal(row.overridden, true);
});

test('clearPriceOverrides 能还原', () => {
  applyPriceOverrides({ 'deepseek-flash': { output: 99 } });
  assert.equal(unitPrice('deepseek-flash', 'output'), 99);
  clearPriceOverrides();
  assert.equal(unitPrice('deepseek-flash', 'output'), 8);
});

test('listPrices 每行字段齐全', () => {
  for (const r of listPrices()) {
    for (const k of ['key', 'currency', 'evidence', 'source', 'capturedAt', 'overridden']) {
      assert.ok(k in r, `${r.key} 缺 ${k}`);
    }
  }
});

test('账单内联价优先于价格表', () => {
  const bill = { prices: { 'glm-5.3': { output: 1 } } };
  assert.equal(unitPriceWith('glm-5.3', 'output', {}, bill), 1);
  assert.equal(unitPriceWith('glm-5.3', 'output', {}, null), 28);
});

test('账单内联价也接受归一化后的 key', () => {
  const bill = { prices: { 'glm-5.3': { output: 1 } } };
  assert.equal(unitPriceWith('GLM-5.3', 'output', {}, bill), 1);
});
