#!/usr/bin/env node
/**
 * ingest.mjs —— 把各家账单 / 用量导出归一化成 estimate.mjs 能吃的统一 JSON
 *
 * 用法：
 *   node scripts/ingest.mjs <input> --from openai    --out bill.json
 *   node scripts/ingest.mjs <input> --from anthropic --out bill.json
 *   node scripts/ingest.mjs <input> --from litellm   --out bill.json
 *   node scripts/ingest.mjs <input> --from generic --map input_tokens=inputUncachedTokens,... --out bill.json
 *   node scripts/ingest.mjs <input> --from generic --list-fields
 *
 * 支持的输入：.json / .csv / .jsonl
 *
 * 设计原则：
 *   - 认不出的字段就明说认不出，绝不猜一个值填进去
 *   - 缺 cached tokens 时填 0 但记进 warnings（W2 会因此判「无数据」而不是「命中率 0%」）
 *   - 金额只做透传或按官方单价算，不用「平均价」糊弄
 */

import fs from 'node:fs';
import path from 'node:path';

// ─────────────────────────────────────────────
// 统一输出字段（与 lib/estimate.mjs 的输入契约一致）
// ─────────────────────────────────────────────

const UNIFIED_FIELDS = [
  'inputCachedTokens',
  'inputUncachedTokens',
  'inputTotalTokens',
  'outputTokens',
  'requestCount',
  'totalCost',
];

// ─────────────────────────────────────────────
// 通用工具
// ─────────────────────────────────────────────

function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[,$\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--from') args.from = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--map') args.map = argv[++i];
    else if (a === '--currency') args.currency = argv[++i];
    else if (a === '--period') args.period = argv[++i];
    else if (a.startsWith('--')) args[a.slice(2)] = true;
    else args._.push(a);
  }
  return args;
}

/** 极简 CSV 解析：支持引号包裹、逗号转义、CRLF */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell); cell = '';
    } else if (ch === '\n') {
      row.push(cell); cell = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else if (ch !== '\r') {
      cell += ch;
    }
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const o = {};
    header.forEach((h, i) => { o[h] = r[i] !== undefined ? r[i] : ''; });
    return o;
  });
}

function readInput(file) {
  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) throw new Error(`找不到输入文件：${abs}`);
  const raw = fs.readFileSync(abs, 'utf8');
  const ext = path.extname(abs).toLowerCase();
  if (ext === '.csv') return { kind: 'rows', rows: parseCsv(raw), path: abs };
  if (ext === '.jsonl') {
    const rows = raw.split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
    return { kind: 'rows', rows, path: abs };
  }
  if (ext === '.json') {
    const j = JSON.parse(raw);
    // 常见包装：{data:[...]} / {results:[...]} / 直接数组
    const rows = Array.isArray(j) ? j : j.data || j.results || j.rows || null;
    if (Array.isArray(rows)) return { kind: 'rows', rows, path: abs, raw: j };
    return { kind: 'object', obj: j, path: abs };
  }
  throw new Error(`不支持的文件类型：${ext}（支持 .json / .csv / .jsonl）`);
}

// ─────────────────────────────────────────────
// 适配器
// ─────────────────────────────────────────────

/**
 * OpenAI Usage API（/v1/organization/usage/completions）
 * 典型字段：n_requests / n_context_tokens_total / n_generated_tokens_total / snapshot / input_cached_tokens
 */
function adaptOpenAI(input, opts) {
  const buckets = new Map();
  const warnings = [];
  let sawCached = false;

  for (const r of input.rows) {
    const model = r.snapshot || r.model || r.model_id || 'unknown';
    const b = buckets.get(model) || {
      inputCachedTokens: 0, inputUncachedTokens: 0, outputTokens: 0, requestCount: 0,
    };
    const ctx = num(r.n_context_tokens_total ?? r.input_tokens ?? r.prompt_tokens);
    const cached = num(r.n_context_tokens_cached ?? r.input_cached_tokens ?? r.cached_tokens);
    const gen = num(r.n_generated_tokens_total ?? r.output_tokens ?? r.completion_tokens);
    const reqs = num(r.n_requests ?? r.num_model_requests ?? r.requests);

    if (cached !== null) { sawCached = true; b.inputCachedTokens += cached; }
    if (ctx !== null) {
      // OpenAI 的 context_tokens 含 cached，需要减掉
      b.inputUncachedTokens += Math.max(0, ctx - (cached ?? 0));
    }
    if (gen !== null) b.outputTokens += gen;
    if (reqs !== null) b.requestCount += reqs;
    buckets.set(model, b);
  }

  if (!sawCached) {
    warnings.push('输入里没有 cached tokens 字段：W2（缓存命中率）将判为无数据，而不是「命中率 0%」。请确认导出时是否勾选了缓存明细。');
  }
  return { models: Object.fromEntries(buckets), warnings, currency: opts.currency || 'USD' };
}

/**
 * Anthropic Usage & Cost API（/v1/organizations/usage_report/messages）
 * 典型字段：input_tokens / cache_read_input_tokens / cache_creation_input_tokens / output_tokens / model
 */
function adaptAnthropic(input, opts) {
  const buckets = new Map();
  const warnings = [];
  let totalCost = null;

  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    // 命中一条 usage 记录
    if (node.model || node.input_tokens !== undefined) {
      const model = node.model || 'unknown';
      const b = buckets.get(model) || {
        inputCachedTokens: 0, inputUncachedTokens: 0, outputTokens: 0, requestCount: 0,
      };
      const inp = num(node.input_tokens ?? node.uncached_input_tokens);
      const cacheRead = num(node.cache_read_input_tokens);
      const cacheWrite = num(node.cache_creation_input_tokens);
      const out = num(node.output_tokens);
      const reqs = num(node.requests ?? node.request_count);

      if (cacheRead !== null) b.inputCachedTokens += cacheRead;
      // Anthropic 的 input_tokens 不含缓存读取，但缓存写入按未命中价计
      if (inp !== null) b.inputUncachedTokens += inp;
      if (cacheWrite !== null) b.inputUncachedTokens += cacheWrite;
      if (out !== null) b.outputTokens += out;
      if (reqs !== null) b.requestCount += reqs;
      buckets.set(model, b);
    }
    if (node.amount !== undefined) {
      const a = num(node.amount);
      if (a !== null) totalCost = (totalCost || 0) + a;
    }
    for (const v of Object.values(node)) walk(v);
  };
  walk(input.rows || input.obj);

  if (!buckets.size) warnings.push('没找到任何 usage 记录，请确认导出的是 usage_report 而不是 cost_report。');
  return { models: Object.fromEntries(buckets), warnings, totalCost, currency: opts.currency || 'USD' };
}

/**
 * LiteLLM 日志（JSON/JSONL）
 * 典型字段：model / prompt_tokens / completion_tokens / cache_read_input_tokens / spend
 */
function adaptLiteLLM(input, opts) {
  const buckets = new Map();
  const warnings = [];
  let totalCost = null;

  for (const r of input.rows) {
    const model = r.model || r.model_name || 'unknown';
    const b = buckets.get(model) || {
      inputCachedTokens: 0, inputUncachedTokens: 0, outputTokens: 0, requestCount: 0,
    };
    const prompt = num(r.prompt_tokens);
    const cacheRead = num(r.cache_read_input_tokens ?? r.cached_tokens);
    const out = num(r.completion_tokens ?? r.output_tokens);
    const spend = num(r.spend ?? r.response_cost ?? r.cost);

    if (cacheRead !== null) b.inputCachedTokens += cacheRead;
    if (prompt !== null) b.inputUncachedTokens += Math.max(0, prompt - (cacheRead ?? 0));
    if (out !== null) b.outputTokens += out;
    b.requestCount += 1;
    if (spend !== null) totalCost = (totalCost || 0) + spend;
    buckets.set(model, b);
  }

  if (totalCost === null) warnings.push('日志里没有 spend 字段：总成本留空，estimate 的「占总成本百分比」将不可用。');
  return { models: Object.fromEntries(buckets), warnings, totalCost, currency: opts.currency || 'USD' };
}

/**
 * 通用 CSV/JSON：靠 --map 指定列名映射
 * 例：--map input_tokens=inputUncachedTokens,cached=cachedTokens,out=outputTokens,model=model
 */
function adaptGeneric(input, opts) {
  const warnings = [];
  if (!opts.map) {
    throw new Error('--from generic 必须提供 --map，例如：--map model=model,input_tokens=inputUncachedTokens,output_tokens=outputTokens');
  }
  const map = {};
  for (const pair of String(opts.map).split(',')) {
    const [src, dst] = pair.split('=').map((s) => s.trim());
    if (src && dst) map[src] = dst;
  }

  const buckets = new Map();
  let totalCost = null;

  for (const r of input.rows) {
    const get = (field) => {
      const srcKey = Object.keys(map).find((k) => map[k] === field);
      return srcKey ? num(r[srcKey]) : null;
    };
    const modelKey = Object.keys(map).find((k) => map[k] === 'model');
    const model = modelKey ? (r[modelKey] || 'unknown') : 'unknown';

    const b = buckets.get(model) || {
      inputCachedTokens: 0, inputUncachedTokens: 0, outputTokens: 0, requestCount: 0,
    };
    const cached = get('inputCachedTokens');
    const uncached = get('inputUncachedTokens');
    const totalIn = get('inputTotalTokens');
    const out = get('outputTokens');
    const reqs = get('requestCount');
    const cost = get('totalCost');

    if (cached !== null) b.inputCachedTokens += cached;
    // 优先用显式未命中数；否则用「总输入 − 缓存命中」推算
    // 这一步不能省：多数导出给的 input_tokens 含缓存命中部分，直接当未命中会高估成本
    if (uncached !== null) b.inputUncachedTokens += uncached;
    else if (totalIn !== null) b.inputUncachedTokens += Math.max(0, totalIn - (cached ?? 0));
    if (out !== null) b.outputTokens += out;
    if (reqs !== null) b.requestCount += reqs;
    if (cost !== null) totalCost = (totalCost || 0) + cost;
    buckets.set(model, b);
  }

  // 能被推算出来的字段不算缺失：给了「总输入 + 缓存命中」就能算出未命中
  const mapped = new Set(Object.values(map));
  const derived = new Set();
  if (mapped.has('inputTotalTokens') && mapped.has('inputCachedTokens')) {
    derived.add('inputUncachedTokens');
  }
  const unmapped = UNIFIED_FIELDS.filter((f) => !mapped.has(f) && !derived.has(f));
  if (unmapped.length) warnings.push(`这些统一字段没有映射来源：${unmapped.join('、')}（对应项会判待核实）`);

  return { models: Object.fromEntries(buckets), warnings, totalCost, currency: opts.currency || 'CNY' };
}

// ─────────────────────────────────────────────
// 主流程
// ─────────────────────────────────────────────

const ADAPTERS = {
  openai: adaptOpenAI,
  anthropic: adaptAnthropic,
  litellm: adaptLiteLLM,
  generic: adaptGeneric,
};

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args['list-fields']) {
    console.log('统一字段（--map 右侧可用）：');
    for (const f of UNIFIED_FIELDS) console.log(`  ${f}`);
    console.log('\n另有特殊键：model（模型名，用于分组）');
    return;
  }

  const file = args._[0];
  if (!file || !args.from) {
    console.error('用法：node scripts/ingest.mjs <input> --from openai|anthropic|litellm|generic [--out bill.json]');
    console.error('      node scripts/ingest.mjs --list-fields');
    process.exit(2);
  }

  const adapter = ADAPTERS[args.from];
  if (!adapter) {
    console.error(`不认识的来源：${args.from}（支持 ${Object.keys(ADAPTERS).join(' / ')}）`);
    process.exit(2);
  }

  let input;
  try {
    input = readInput(file);
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }

  let res;
  try {
    res = adapter(input, args);
  } catch (e) {
    console.error(`适配失败：${e.message}`);
    process.exit(2);
  }

  const bill = {
    meta: {
      currency: args.currency || res.currency || 'CNY',
      period: args.period || null,
      source: args.from,
      ingestedAt: new Date().toISOString(),
      inputFile: input.path,
    },
    models: res.models,
    totalCost: res.totalCost ?? null,
    assumptions: {},
    warnings: res.warnings || [],
  };

  const out = JSON.stringify(bill, null, 2);
  if (args.out) {
    fs.writeFileSync(path.resolve(args.out), out, 'utf8');
    console.error(`已写出：${path.resolve(args.out)}`);
    console.error(`模型数：${Object.keys(bill.models).length}`);
    if (bill.warnings.length) {
      console.error('警告：');
      for (const w of bill.warnings) console.error(`  · ${w}`);
    }
  } else {
    console.log(out);
  }
}

main();
