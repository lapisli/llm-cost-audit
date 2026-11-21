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
export function unitPrice(model, part, opts = {}) {
  const p = PRICES[model];
  if (!p) return null;
  const tier = p.hasOffPeak ? (opts.peak === false ? 'offPeak' : 'peak') : 'peak';
  if (part === 'input.cached') return p.input.cached?.[tier] ?? null;
  if (part === 'input.uncached') return p.input.uncached?.[tier] ?? null;
  if (part === 'input.cacheWrite') return p.input.cacheWrite?.[tier] ?? null;
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
  const inline = bill?.prices?.[model];
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
