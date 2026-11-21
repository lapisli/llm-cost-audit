/**
 * 价格表 —— 只收录「有可引用来源」的价格
 *
 * 纪律：
 *   - 每个价格必须带 evidence + source + capturedAt
 *   - 换算价（$ 由 ¥ 折算）单独标注，不得与官方美元定价混用
 *   - 未抓到官方页面的，一律 evidence='未核实'，不得用于承诺节省
 */

export const FX = Object.freeze({
  USD_CNY: 7.10,
  asOf: '2026-10-22',
  note: '换算用；官方美元定价不套用此汇率',
});

/**
 * 价格单位统一为「元 或 美元 / 百万 tokens」
 * input.cached / input.uncached / output 三个价必须分开存 —— 合并就是审计事故的起点
 */
export const PRICES = Object.freeze({
  'deepseek-flash': {
    displayName: 'DeepSeek Flash',
    currency: 'CNY',
    input: {
      cached: { offPeak: 0.02, peak: 0.04 },
      uncached: { offPeak: 1, peak: 2 },
    },
    output: { offPeak: 4, peak: 8 },
    evidence: '官方',
    source: 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing',
    capturedAt: '2026-10-22',
    hasOffPeak: true,
  },
  'deepseek-v4-pro': {
    displayName: 'DeepSeek V4 Pro',
    currency: 'CNY',
    input: {
      cached: { offPeak: 0.15, peak: 0.30 },
      uncached: { offPeak: 4.5, peak: 9.0 },
    },
    output: { offPeak: 13.5, peak: 27.0 },
    evidence: '官方',
    source: 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing',
    capturedAt: '2026-10-22',
    hasOffPeak: true,
  },
  'claude-opus-5-5': {
    displayName: 'Claude Opus 5.5',
    currency: 'USD',
    input: {
      cached: { peak: 0.2 },
      uncached: { peak: 4 },
      cacheWrite: { peak: 5 },
    },
    output: { peak: 20 },
    evidence: '官方',
    source: 'https://opencode.ai/inference/v1/models',
    capturedAt: '2026-11-22',
    hasOffPeak: false,
  },
  'claude-opus-5': {
    displayName: 'Claude Opus 5',
    currency: 'USD',
    input: {
      cached: { peak: 0.5 },
      uncached: { peak: 5 },
      cacheWrite: { peak: 6.25 },
    },
    output: { peak: 25 },
    evidence: '官方',
    source: 'https://opencode.ai/inference/v1/models',
    capturedAt: '2026-11-22',
    hasOffPeak: false,
  },
  'claude-fable-5-1': {
    displayName: 'Claude Fable 5.1',
    currency: 'USD',
    input: {
      cached: { peak: 0.25 },
      uncached: { peak: 10 },
      cacheWrite: { peak: 12.5 },
    },
    output: { peak: 50 },
    evidence: '官方',
    source: 'https://opencode.ai/inference/v1/models',
    capturedAt: '2026-11-22',
    hasOffPeak: false,
  },

  // ─────────────────────────────────────────────
  // 阿里云百炼 Qwen —— 来源：reference/09-price-cn.md §2.1（华北2 北京）
  // ─────────────────────────────────────────────
  'qwen3.8-max': {
    displayName: 'Qwen3.8-Max（百炼·北京）',
    currency: 'CNY',
    input: {
      cached: { peak: 1.5 },
      uncached: { peak: 12 },
      cacheWrite: { peak: 15 },
    },
    output: { peak: 36 },
    evidence: '官方',
    source: 'reference/09-price-cn.md §2.1',
    capturedAt: '2026-10-22',
    hasOffPeak: false,
  },

  // ─────────────────────────────────────────────
  // 智谱 GLM —— 来源：reference/09-price-cn.md §3.1
  // 注意：缓存存储按小时计费（限时免费），本表只收 token 价
  // ─────────────────────────────────────────────
  'glm-5.3': {
    displayName: 'GLM-5.3',
    currency: 'CNY',
    input: { cached: { peak: 2 }, uncached: { peak: 8 } },
    output: { peak: 28 },
    evidence: '官方',
    source: 'reference/09-price-cn.md §3.1',
    capturedAt: '2026-10-22',
    hasOffPeak: false,
  },
  'glm-5.3-flash': {
    displayName: 'GLM-5.3-Flash',
    currency: 'CNY',
    input: { cached: { peak: 0.23 }, uncached: { peak: 0.8 } },
    output: { peak: 2.8 },
    evidence: '官方',
    source: 'reference/09-price-cn.md §3.1',
    capturedAt: '2026-10-22',
    hasOffPeak: false,
  },
  'glm-5.3-flashx': {
    displayName: 'GLM-5.3-FlashX',
    currency: 'CNY',
    input: { cached: { peak: 0.57 }, uncached: { peak: 2 } },
    output: { peak: 7 },
    evidence: '官方',
    source: 'reference/09-price-cn.md §3.1',
    capturedAt: '2026-10-22',
    hasOffPeak: false,
  },

  // ─────────────────────────────────────────────
  // MiniMax —— 来源：reference/09-price-cn.md §5.1
  // minimax-m3 取 ≤512k 档的永久五折价
  // ─────────────────────────────────────────────
  'minimax-m3.1-flash': {
    displayName: 'MiniMax-M3.1-Flash',
    currency: 'CNY',
    input: { cached: { peak: 0.1 }, uncached: { peak: 1 } },
    output: { peak: 4 },
    evidence: '官方',
    source: 'reference/09-price-cn.md §5.1',
    capturedAt: '2026-10-22',
    hasOffPeak: false,
  },
  'minimax-m3': {
    displayName: 'MiniMax-M3（≤512k 五折价）',
    currency: 'CNY',
    input: { cached: { peak: 0.42 }, uncached: { peak: 2.1 } },
    output: { peak: 8.4 },
    evidence: '官方',
    source: 'reference/09-price-cn.md §5.1',
    capturedAt: '2026-10-22',
    hasOffPeak: false,
    note: '>512k 输入为另一档价（4.20 / 16.80 / 0.84），本表只收 ≤512k',
  },

  // ─────────────────────────────────────────────
  // 腾讯混元 —— 来源：reference/09-price-cn.md §6.1（刊例价）
  // 该表未给缓存价，input.cached 留空 → W2 会判 unmeasurable，这是正确行为
  // ─────────────────────────────────────────────
  'hunyuan-a13b': {
    displayName: 'Hunyuan-a13b',
    currency: 'CNY',
    input: { uncached: { peak: 0.5 } },
    output: { peak: 2 },
    evidence: '官方',
    source: 'reference/09-price-cn.md §6.1',
    capturedAt: '2026-10-22',
    hasOffPeak: false,
    note: '官方刊例价未列缓存命中价',
  },
  'hunyuan-role-latest': {
    displayName: 'Hunyuan-role-latest',
    currency: 'CNY',
    input: { uncached: { peak: 2.4 } },
    output: { peak: 9.6 },
    evidence: '官方',
    source: 'reference/09-price-cn.md §6.1',
    capturedAt: '2026-10-22',
    hasOffPeak: false,
    note: '官方刊例价未列缓存命中价',
  },
  'hunyuan-translation': {
    displayName: 'Hunyuan-translation',
    currency: 'CNY',
    input: { uncached: { peak: 1.2 } },
    output: { peak: 3.6 },
    evidence: '官方',
    source: 'reference/09-price-cn.md §6.1',
    capturedAt: '2026-10-22',
    hasOffPeak: false,
    note: '官方刊例价未列缓存命中价',
  },
});

/**
 * DeepSeek 错峰判定 —— 官方原文：
 * 「北京时间周一至周五（不含中国法定节假日）9:00-12:00、14:00-18:00 为高峰时段；
 *   其余时段，包括周末及中国法定节假日全天均为空闲时段。」
 *
 * @param {Date} d  按北京时间理解的时刻
 * @param {Set<string>|string[]} [holidays] 'YYYY-MM-DD' 形式的法定节假日
 * @returns {{peak: boolean, reason: string}}
 */
export function isPeakHour(d, holidays) {
  const hol = holidays instanceof Set ? holidays : new Set(holidays || []);
  // 用 UTC 分量读「北京时间」：调用方需传入已换算到 +08:00 的 Date，
  // 或直接传 UTC 分量即北京时间的 Date（见 toBeijingParts）。
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const dateKey = `${y}-${m}-${day}`;
  const dow = d.getUTCDay(); // 0=周日 6=周六
  const hour = d.getUTCHours();

  if (hol.has(dateKey)) return { peak: false, reason: '法定节假日全天' };
  if (dow === 0 || dow === 6) return { peak: false, reason: '周末全天' };
  if (hour >= 9 && hour < 12) return { peak: true, reason: '工作日 09:00-12:00' };
  if (hour >= 14 && hour < 18) return { peak: true, reason: '工作日 14:00-18:00' };
  return { peak: false, reason: '工作日非高峰时段' };
}

/** 取某模型某计费项的单价（每百万 token） */
/**
 * 模型名归一化
 *
 * 真实账单里的模型名五花八门：`Qwen3.8-Max`、`glm-5.3`、`gpt-4o-2024-08-06`、
 * `deepseek-chat`。硬匹配会大面积落空，而落空的后果是「判待核实」——
 * 用户会以为工具坏了。这里做三层回落：别名表 → 小写归一 → 去日期后缀。
 */
const ALIASES = Object.freeze({
  // DeepSeek 对外模型名与内部代号
  'deepseek-chat': 'deepseek-flash',
  'deepseek-v4.1-flash': 'deepseek-flash',
  'deepseek-v4-flash': 'deepseek-flash',
  'deepseek-reasoner': 'deepseek-v4-pro',
  'deepseek-v4.1-pro': 'deepseek-v4-pro',
  // 常见大小写/连字符变体
  'qwen3-8-max': 'qwen3.8-max',
  'qwen-max': 'qwen3.8-max',
  'glm5.3': 'glm-5.3',
  'glm-5-3': 'glm-5.3',
  'glm-5.3-flash-x': 'glm-5.3-flashx',
  'minimax-m3-1-flash': 'minimax-m3.1-flash',
  'minimax-m3.1': 'minimax-m3',
});

function baseKey(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
}

/** 把任意写法的模型名解析成 PRICES 里的 key（解析不出就原样返回） */
export function resolveKey(name) {
  const k = baseKey(name);
  if (PRICES[k]) return k;
  if (ALIASES[k] && PRICES[ALIASES[k]]) return ALIASES[k];
  // 去掉日期/版本后缀：gpt-4o-2024-08-06 → gpt-4o，claude-x-v2 → claude-x
  const stripped = k.replace(/-\d{4}-\d{2}-\d{2}$/, '').replace(/-v\d+$/, '');
  if (PRICES[stripped]) return stripped;
  if (ALIASES[stripped] && PRICES[ALIASES[stripped]]) return ALIASES[stripped];
  return k;
}

/**
 * 运行时价格覆盖
 *
 * 内置表只收「有来源」的价格，但客户用的模型多半不在里面。
 * `--prices my-prices.json` 可以整体覆盖/追加，不改源码。
 * 覆盖项的 evidence 一律按用户提供处理（默认「未核实」），不冒充官方。
 */
let OVERRIDES = Object.freeze({});

export function applyPriceOverrides(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('价格覆盖必须是一个对象');
  const clean = {};
  for (const [rawKey, v] of Object.entries(obj)) {
    if (rawKey.startsWith('_')) continue; // _说明 / _单位 这类注释字段
    if (!v || typeof v !== 'object') throw new Error(`模型 ${rawKey} 的价格必须是一个对象`);
    const num = (x) => (Number.isFinite(x) ? x : undefined);
    const input = v.input || {};
    const entry = {
      displayName: v.displayName || rawKey,
      currency: v.currency || 'CNY',
      input: {
        cached: num(input.cached) !== undefined ? { peak: num(input.cached) } : undefined,
        uncached: num(input.uncached) !== undefined ? { peak: num(input.uncached) } : undefined,
        cacheWrite: num(input.cacheWrite) !== undefined ? { peak: num(input.cacheWrite) } : undefined,
      },
      output: num(v.output) !== undefined ? { peak: num(v.output) } : undefined,
      evidence: v.evidence || '未核实',
      source: v.source || '用户提供的 --prices 文件',
      capturedAt: v.capturedAt || new Date().toISOString().slice(0, 10),
      hasOffPeak: false,
    };
    if (!entry.input.uncached && !entry.output) {
      throw new Error(`模型 ${rawKey} 至少要给 input.uncached 或 output`);
    }
    clean[resolveKey(rawKey)] = entry;
  }
  OVERRIDES = Object.freeze(clean);
  return Object.keys(clean);
}

export function clearPriceOverrides() {
  OVERRIDES = Object.freeze({});
}

/** 查价用：覆盖表优先，再查内置表 */
function lookup(model) {
  const k = resolveKey(model);
  return OVERRIDES[k] || PRICES[k] || null;
}

export function unitPrice(model, part, opts = {}) {
  const p = lookup(model);
  if (!p) return null;
  const tier = p.hasOffPeak ? (opts.peak === false ? 'offPeak' : 'peak') : 'peak';
  if (part === 'input.cached') return p.input?.cached?.[tier] ?? null;
  if (part === 'input.uncached') return p.input?.uncached?.[tier] ?? null;
  if (part === 'input.cacheWrite') return p.input?.cacheWrite?.[tier] ?? null;
  if (part === 'output') return p.output?.[tier] ?? null;
  return null;
}

/**
 * 带账单内联价格的取价：先查账单自带的 prices，再回落内置表
 *
 * 账单里可这样写（让任何厂商的模型都能算，不必等我们收录）：
 *   "prices": { "gpt-4o": { "inputCached": 1.25, "inputUncached": 2.5, "output": 10 } }
 *
 * 内置表优先级低于账单自带价 —— 客户手上的合同价永远比公开价准。
 */
export function unitPriceWith(model, part, opts = {}, bill = null) {
  // 内联价优先：账单自带的价格比表里的新，且用户自己负责
  const inline = bill?.prices?.[model] ?? bill?.prices?.[resolveKey(model)];
  if (inline) {
    const map = {
      'input.cached': inline.inputCached,
      'input.uncached': inline.inputUncached,
      'input.cacheWrite': inline.inputCacheWrite,
      output: inline.output,
    };
    const v = map[part];
    if (Number.isFinite(v)) return v;
  }
  return unitPrice(model, part, opts);
}

/** 缓存命中价 vs 未命中价的倍数 —— 审计最有说服力的一组数 */
export function cachePriceRatio(model, opts = {}) {
  const miss = unitPrice(model, 'input.uncached', opts);
  const hit = unitPrice(model, 'input.cached', opts);
  if (!miss || !hit) return null;
  return miss / hit;
}

/** 把 token 数与单价换成金额（元或美元，跟模型币种一致） */
export function costOf(tokens, pricePerMillion) {
  if (!Number.isFinite(tokens) || !Number.isFinite(pricePerMillion)) return null;
  return (tokens / 1e6) * pricePerMillion;
}

export function listModels() {
  return Object.keys(PRICES);
}

/** 列出全部价格（含来源与抓取日期），给 `--list-prices` 用 */
export function listPrices() {
  const rows = [];
  for (const [key, p] of Object.entries({ ...PRICES, ...OVERRIDES })) {
    rows.push({
      key,
      displayName: p.displayName || key,
      currency: p.currency,
      inputUncached: p.input?.uncached?.peak ?? null,
      inputCached: p.input?.cached?.peak ?? null,
      output: p.output?.peak ?? null,
      hasOffPeak: !!p.hasOffPeak,
      evidence: p.evidence,
      source: p.source,
      capturedAt: p.capturedAt,
      overridden: !!OVERRIDES[key],
      note: p.note || '',
    });
  }
  return rows;
}
