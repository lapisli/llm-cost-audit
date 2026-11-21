import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  num,
  parseCsv,
  adaptOpenAI,
  adaptAnthropic,
  adaptLiteLLM,
  adaptGeneric,
  UNIFIED_FIELDS,
  ADAPTERS,
} from '../lib/ingest.mjs';

// ─────────────────────────────────────────────
// num()：数字解析
// ─────────────────────────────────────────────

test('num 处理千分位与货币符号', () => {
  assert.equal(num('1,234'), 1234);
  assert.equal(num('$5.50'), 5.5);
  assert.equal(num(' 42 '), 42);
  assert.equal(num('1,234,567.89'), 1234567.89);
  assert.equal(num('¥1,000'), 1000);
});

test('num 对无法解析的输入返回 null，绝不返回 0', () => {
  assert.equal(num(''), null);
  assert.equal(num(null), null);
  assert.equal(num(undefined), null);
  assert.equal(num('abc'), null);
  assert.equal(num(NaN), null);
});

test('num 保留真实的 0', () => {
  assert.equal(num(0), 0);
  assert.equal(num('0'), 0);
});

// ─────────────────────────────────────────────
// parseCsv()
// ─────────────────────────────────────────────

test('parseCsv 解析基本表格', () => {
  const rows = parseCsv('model,tokens\ngpt-4o,1000\nclaude,2000');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].model, 'gpt-4o');
  assert.equal(rows[1].tokens, '2000');
});

test('parseCsv 忽略结尾空行', () => {
  const rows = parseCsv('a,b\n1,2\n\n');
  assert.equal(rows.length, 1);
});

// ─────────────────────────────────────────────
// adaptOpenAI()
// ─────────────────────────────────────────────

const OPENAI_INPUT = {
  path: 'usage.json',
  rows: [
    { snapshot: 'gpt-4o', n_requests: 1000, n_context_tokens_total: 5000000, n_context_tokens_cached: 4000000, n_generated_tokens_total: 200000 },
    { snapshot: 'gpt-4o-mini', n_requests: 8000, n_context_tokens_total: 2000000, n_context_tokens_cached: 1800000, n_generated_tokens_total: 300000 },
  ],
};

test('adaptOpenAI 从总上下文里减掉缓存命中', () => {
  const r = adaptOpenAI(OPENAI_INPUT, {});
  const m = r.models['gpt-4o'];
  assert.equal(m.inputCachedTokens, 4000000);
  assert.equal(m.inputUncachedTokens, 1000000, '5,000,000 总输入 − 4,000,000 缓存');
  assert.equal(m.outputTokens, 200000);
  assert.equal(m.requestCount, 1000);
});

test('adaptOpenAI 按模型分桶，不合并不同模型', () => {
  const r = adaptOpenAI(OPENAI_INPUT, {});
  assert.deepEqual(Object.keys(r.models).sort(), ['gpt-4o', 'gpt-4o-mini']);
  assert.equal(r.models['gpt-4o-mini'].inputUncachedTokens, 200000);
});

test('adaptOpenAI 同模型多行累加', () => {
  const r = adaptOpenAI({
    rows: [
      { snapshot: 'gpt-4o', n_requests: 100, n_context_tokens_total: 1000, n_context_tokens_cached: 500, n_generated_tokens_total: 10 },
      { snapshot: 'gpt-4o', n_requests: 200, n_context_tokens_total: 2000, n_context_tokens_cached: 1000, n_generated_tokens_total: 20 },
    ],
  }, {});
  assert.equal(r.models['gpt-4o'].requestCount, 300);
  assert.equal(r.models['gpt-4o'].inputCachedTokens, 1500);
  // 未命中是逐行相减再累加：(1000-500) + (2000-1000) = 1500
  assert.equal(r.models['gpt-4o'].inputUncachedTokens, 1500);
});

test('adaptOpenAI 缺缓存字段时未命中不被压成 0', () => {
  const r = adaptOpenAI({
    rows: [{ snapshot: 'gpt-4o', n_requests: 10, n_context_tokens_total: 1000, n_generated_tokens_total: 50 }],
  }, {});
  assert.equal(r.models['gpt-4o'].inputCachedTokens, 0);
  assert.equal(r.models['gpt-4o'].inputUncachedTokens, 1000);
});

// ─────────────────────────────────────────────
// adaptLiteLLM()
// ─────────────────────────────────────────────

test('adaptLiteLLM 用 prompt_tokens 减缓存读', () => {
  const r = adaptLiteLLM({
    rows: [{ model: 'gpt-4o', prompt_tokens: 1000, cache_read_input_tokens: 800, completion_tokens: 100, spend: 0.5 }],
  }, {});
  const m = r.models['gpt-4o'];
  assert.equal(m.inputCachedTokens, 800);
  assert.equal(m.inputUncachedTokens, 200);
  assert.equal(m.outputTokens, 100);
  assert.equal(r.totalCost, 0.5);
});

test('adaptLiteLLM 每条记录算一次请求', () => {
  const r = adaptLiteLLM({
    rows: [
      { model: 'gpt-4o', prompt_tokens: 100, completion_tokens: 10, spend: 0.1 },
      { model: 'gpt-4o', prompt_tokens: 200, completion_tokens: 20, spend: 0.2 },
    ],
  }, {});
  assert.equal(r.models['gpt-4o'].requestCount, 2);
  assert.equal(r.totalCost, 0.30000000000000004);
});

test('adaptLiteLLM 累加多行 spend', () => {
  const r = adaptLiteLLM({
    rows: [
      { model: 'a', prompt_tokens: 1, completion_tokens: 1, spend: 1.5 },
      { model: 'b', prompt_tokens: 1, completion_tokens: 1, spend: 2.5 },
    ],
  }, {});
  assert.equal(r.totalCost, 4);
});

// ─────────────────────────────────────────────
// adaptGeneric()
// ─────────────────────────────────────────────

test('adaptGeneric 用「总输入 − 缓存」推算未命中', () => {
  const r = adaptGeneric(
    { rows: [{ m: 'x', total: 1000, cached: 800 }] },
    { map: 'm=model,total=inputTotalTokens,cached=inputCachedTokens' },
  );
  assert.equal(r.models.x.inputCachedTokens, 800);
  assert.equal(r.models.x.inputUncachedTokens, 200);
});

test('adaptGeneric 显式未命中优先于推算', () => {
  const r = adaptGeneric(
    { rows: [{ m: 'x', total: 1000, cached: 800, unc: 150 }] },
    { map: 'm=model,total=inputTotalTokens,cached=inputCachedTokens,unc=inputUncachedTokens' },
  );
  assert.equal(r.models.x.inputUncachedTokens, 150, '有显式值就不推算');
});

test('adaptGeneric 多行同模型累加', () => {
  const r = adaptGeneric(
    { rows: [
      { m: 'x', out: 10, req: 5 },
      { m: 'x', out: 20, req: 7 },
    ] },
    { map: 'm=model,out=outputTokens,req=requestCount' },
  );
  assert.equal(r.models.x.outputTokens, 30);
  assert.equal(r.models.x.requestCount, 12);
});

test('adaptGeneric 没有 --map 就报错，不静默产出空账单', () => {
  assert.throws(() => adaptGeneric({ rows: [] }, {}), /--map/);
});

test('adaptGeneric 只给总输入和缓存时，不再报「未命中未映射」', () => {
  const r = adaptGeneric(
    { rows: [{ m: 'x', total: 100, cached: 50 }] },
    { map: 'm=model,total=inputTotalTokens,cached=inputCachedTokens' },
  );
  const joined = r.warnings.join(' ');
  assert.ok(!joined.includes('inputUncachedTokens'), `不应再报未命中缺失：${joined}`);
});

test('adaptGeneric 确实没映射的字段要报出来', () => {
  const r = adaptGeneric(
    { rows: [{ m: 'x', out: 10 }] },
    { map: 'm=model,out=outputTokens' },
  );
  assert.ok(r.warnings.join(' ').includes('inputCachedTokens'));
});

test('adaptGeneric 负数不会被当成未命中累加', () => {
  const r = adaptGeneric(
    { rows: [{ m: 'x', total: 100, cached: 200 }] },
    { map: 'm=model,total=inputTotalTokens,cached=inputCachedTokens' },
  );
  assert.equal(r.models.x.inputUncachedTokens, 0, '缓存大于总量时应为 0，不是负数');
});

// ─────────────────────────────────────────────
// 注册表与契约
// ─────────────────────────────────────────────

test('ADAPTERS 注册了四种来源', () => {
  assert.deepEqual(Object.keys(ADAPTERS).sort(), ['anthropic', 'generic', 'litellm', 'openai']);
});

test('UNIFIED_FIELDS 含 inputTotalTokens（推算未命中用）', () => {
  assert.ok(UNIFIED_FIELDS.includes('inputTotalTokens'));
  assert.ok(UNIFIED_FIELDS.includes('inputCachedTokens'));
  assert.ok(UNIFIED_FIELDS.includes('inputUncachedTokens'));
});

test('所有适配器都返回统一结构', () => {
  const cases = [
    [adaptOpenAI, { rows: [{ snapshot: 'm', n_requests: 1, n_context_tokens_total: 10, n_generated_tokens_total: 1 }] }, {}],
    [adaptLiteLLM, { rows: [{ model: 'm', prompt_tokens: 10, completion_tokens: 1 }] }, {}],
    [adaptGeneric, { rows: [{ m: 'x', out: 1 }] }, { map: 'm=model,out=outputTokens' }],
  ];
  for (const [fn, input, opts] of cases) {
    const r = fn(input, opts);
    assert.ok(r.models && typeof r.models === 'object', `${fn.name} 缺 models`);
    assert.ok(Array.isArray(r.warnings), `${fn.name} 缺 warnings 数组`);
    assert.ok('totalCost' in r, `${fn.name} 缺 totalCost`);
  }
});
