#!/usr/bin/env node
/**
 * audit-cost.mjs —— LLM 成本审计：单价表 + 成本计算 + 反事实对比
 *
 * 用途 / PURPOSE
 *   1) 内置一张「可替换」的 DeepSeek 官方单价表（元 / 百万 token），按北京时间
 *      高峰 / 空闲时段分档计价；
 *   2) 读 DSH 账本 usage-stats-cache.json，算总体成本估算（含每日 / 每模型 / 每小时）；
 *   3) 给出反事实（counterfactual）对比：错峰、去缓存、砍上下文、砍输出、换模型
 *      各能省多少。
 *
 * 数据格式版本 / DATA FORMAT
 *   usage-stats-cache.json  version: 7（实测 2026-10-22：93 sessions / 18 days / 11503 requests）
 *     { version, sessions: { [sid]: { kind, consumed, title, days, hours, lastSample,
 *                                   currentModel, openSteps } } }
 *     sessions[sid].days['YYYY-MM-DD'] = {
 *       totals: { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens },
 *       models: { [model]: { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens } }, // 扁平，无 totals / requests
 *       requests, intervals: [[epochMs, epochMs], ...], compacted }
 *     sessions[sid].hours['YYYY-MM-DD-HH'] = { totals: { ...同上... }, requests, workMs }
 *   ⚠️ 顶层只有 { version, sessions }，**没有顶层 days** —— days 在 session 内，必须遍历 sessions 聚合。
 *   ⚠️ hours 的键形如 '2026-10-16-21'，取小时必须 key.split('-')[3]，不要用 Date 解析。
 *
 * 免责 / DISCLAIMER
 *   **金额一律是估算，不是账单。** 单价表随供应商调整而变，必须现查（本表查于 2026-10-22）。
 *   - 第三方 provider（ark-coding / bailian / qwen-token-plan-cn）实际价格未必等于 DeepSeek
 *     官方价；本脚本默认「按官方同名模型的价」假设，并在 byModel[].priceAssumed 逐条标注。
 *   - 法定节假日清单（HOLIDAYS_CN）默认**留空**；留空时所有工作日一律按「非节假日」处理，
 *     即可能把节假日错判为高峰 → 成本**偏高**（保守）。请用 --holidays <file.json> 填入官方清单。
 *   - hours 桶不覆盖全部 token 时，未覆盖部分按已覆盖部分的峰谷混合比例折算（见 coverage 字段）。
 *
 * 依赖 / DEPENDENCIES
 *   纯 Node ESM，只用 node:fs / node:path / node:url，无第三方包。
 *
 * 用法 / USAGE
 *   node audit-cost.mjs [--home <DSH_HOME>] [--out <file.json>] [--holidays <file.json>]
 *                       [--price-scale <倍数>] [--official-only]
 *   DSH_HOME 解析顺序：--home（显式覆盖）> 环境变量 DSH_HOME > 报错退出。
 *   结果 JSON 永远打印到 stdout；--out 额外写一份文件。
 *   退出码：0 = 正常；1 = 用法 / 文件 / 解析错误；3 = 跑完但发现数据异常
 *   （异常清单在 JSON.anomalies 与 stderr 自检里）。
 */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const FORMAT_VERSION = 'usage-stats-cache.json v7（实测 2026-10-22）';
export const DISCLAIMER = '金额一律是估算，不是账单；单价表随供应商调整而变，必须现查。';
export const OFFICIAL_PROVIDER = 'deepseek-official';

/* ============================================================================
 * 1. 单价表（元 / 百万 token）—— 可替换常量对象
 *    官方原文口径：北京时间周一至周五（不含法定节假日）9:00-12:00、14:00-18:00 为高峰；
 *    其余时段含周末与法定节假日全天为空闲；空闲价是高峰价的一半。
 *    ⚠️ 现查于 2026-10-22，供应商可随时调整；换价只需改 PRICE_TABLE.rows。
 * ========================================================================== */
export const PRICE_TABLE = {
  version: '2026-10-22',
  effectiveFrom: '2026-10-22',
  currency: 'CNY',
  unit: 'per_1e6_tokens',
  source: 'DeepSeek 官方定价页（2026-10-22 现查）',
  warning: '单价随供应商调整而变，必须现查；改价请只改 PRICE_TABLE.rows。',
  rows: {
    'deepseek-flash': {
      off: { cacheHit: 0.02, cacheMiss: 1.0, output: 4.0 },
      peak: { cacheHit: 0.04, cacheMiss: 2.0, output: 8.0 },
    },
    'deepseek-v4-pro': {
      off: { cacheHit: 0.15, cacheMiss: 4.5, output: 13.5 },
      peak: { cacheHit: 0.30, cacheMiss: 9.0, output: 27.0 },
    },
  },
  // 模型名 → 价目行。账本里的模型名带 provider 前缀，如 'ark-coding/deepseek-v4.1-flash'。
  // 先剥前缀，再按顺序匹配第一个命中的规则。
  aliases: [
    { row: 'deepseek-v4-pro', test: /pro/i },
    { row: 'deepseek-flash', test: /flash/i },
  ],
};

export const PEAK_RULE = {
  timezone: 'Asia/Shanghai (UTC+8)',
  weekdays: [1, 2, 3, 4, 5],
  windows: [[9, 12], [14, 18]], // 半开区间 [start, end)
  note: '北京时间周一至周五（不含法定节假日）9:00-12:00、14:00-18:00 为高峰；其余时段含周末与法定节假日全天为空闲；空闲价 = 高峰价的一半。',
};

/**
 * 法定节假日（北京时间日期 'YYYY-MM-DD'）。默认留空 = 不识别节假日（成本偏高，保守）。
 * 必须现查国务院办公厅放假安排后填入，或用 --holidays <file.json> 传入
 * （文件内容：{ "holidays": ["2026-10-01", ...] } 或直接 ["2026-10-01", ...]）。
 */
export const HOLIDAYS_CN = new Set([]);

export class AuditError extends Error {}

/* ================================================================
 * 2. 参数与 DSH_HOME 解析
 * ============================================================== */
const OPTION_NAMES = new Set(['--home', '--out', '--holidays', '--price-scale']);

export function parseArgs(argv) {
  const flags = new Set();
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (OPTION_NAMES.has(a)) {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) throw new AuditError(`${a} 需要一个取值`);
      opts[a.slice(2)] = v;
      i++;
    } else if (a.startsWith('--')) {
      flags.add(a.slice(2));
    } else if (opts._positional === undefined) {
      opts._positional = a;
    } else {
      throw new AuditError(`无法识别的多余参数：${a}`);
    }
  }
  return { flags, opts };
}

/**
 * DSH_HOME 解析：--home（显式覆盖）> 环境变量 DSH_HOME > 报错退出。
 * 注意：DSH 的 shell 层可能不给子进程传 DSH_HOME（本机实测为空字符串），
 * 所以这条 fallback 链是必需的，缺了就退出并打印清晰的补救命令。
 */
export function resolveHome(opts, env = process.env) {
  const tried = [];
  if (opts.home) {
    tried.push(`--home ${opts.home}`);
    if (!fs.existsSync(opts.home)) throw new AuditError(`--home 指向的路径不存在：${opts.home}`);
    return { home: path.resolve(opts.home), source: '--home（显式覆盖）', tried };
  }
  if (opts._positional) {
    tried.push(`位置参数 ${opts._positional}`);
    if (!fs.existsSync(opts._positional)) throw new AuditError(`位置参数指向的路径不存在：${opts._positional}`);
    return { home: path.resolve(opts._positional), source: '位置参数', tried };
  }
  if (env.DSH_HOME === '') {
    tried.push('环境变量 DSH_HOME（已定义但为空字符串 —— DSH shell 层不传该变量是已知现象）');
  } else if (env.DSH_HOME) {
    tried.push(`环境变量 DSH_HOME=${env.DSH_HOME}`);
    if (!fs.existsSync(env.DSH_HOME)) throw new AuditError(`DSH_HOME 指向的路径不存在：${env.DSH_HOME}`);
    return { home: path.resolve(env.DSH_HOME), source: '环境变量 DSH_HOME', tried };
  } else {
    tried.push('环境变量 DSH_HOME 未定义');
  }
  throw new AuditError(
    '找不到 DSH_HOME，无法继续。已尝试：\n' +
      tried.map((t) => `  - ${t}`).join('\n') +
      '\n请显式指定，例如：\n  node audit-cost.mjs --home "C:\\Users\\<你>\\AppData\\Local\\Deepseek Harness EAC\\dpx\\dsh-environments\\eac-beta\\dsh-home"'
  );
}

/* ================================================================
 * 3. 时段与定价基础函数
 * ============================================================== */
export function parseDay(day) {
  const p = String(day).split('-');
  if (p.length !== 3) throw new AuditError(`非法日期（期望 YYYY-MM-DD）：${day}`);
  const nums = p.map(Number);
  if (nums.some((n) => !Number.isFinite(n))) throw new AuditError(`非法日期：${day}`);
  return nums;
}

/** 周末判定：必须用 Date.UTC(...) 取 getUTCDay()，避免本机时区把日期挪一天。 */
export function weekdayOf(day) {
  const [y, m, d] = parseDay(day);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=周日 .. 6=周六
}

/** hours 键 'YYYY-MM-DD-HH' → { day, hour }。小时必须取 split('-')[3]。 */
export function parseHourKey(key) {
  const p = String(key).split('-');
  if (p.length < 4) throw new AuditError(`非法 hours 键（期望 YYYY-MM-DD-HH）：${key}`);
  const hour = Number(p[3]);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new AuditError(`hours 键的小时非法：${key}`);
  return { day: `${p[0]}-${p[1]}-${p[2]}`, hour };
}

export function isPeak(day, hour, holidays = HOLIDAYS_CN) {
  const wd = weekdayOf(day);
  if (!PEAK_RULE.weekdays.includes(wd)) return false;
  if (holidays.has(day)) return false;
  for (const [s, e] of PEAK_RULE.windows) if (hour >= s && hour < e) return true;
  return false;
}

export function emptyTokens() {
  return { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
}
export function addTokens(a, b) {
  for (const k of Object.keys(a)) a[k] += (b && b[k]) || 0;
  return a;
}
export function tokenSum(t) {
  return (t.inputTokens || 0) + (t.outputTokens || 0) + (t.cacheReadTokens || 0) + (t.cacheWriteTokens || 0);
}
export function billedInput(t) {
  return (t.inputTokens || 0) + (t.cacheReadTokens || 0) + (t.cacheWriteTokens || 0);
}

/** 模型名 → 价目行。返回 { key, row, bare, assumed }；未命中 → key=null。 */
export function resolvePriceRow(model) {
  const s = String(model);
  const bare = s.includes('/') ? s.slice(s.indexOf('/') + 1) : s;
  for (const a of PRICE_TABLE.aliases) {
    if (a.test.test(bare)) return { key: a.row, row: PRICE_TABLE.rows[a.row], bare, assumed: true };
  }
  return { key: null, row: null, bare, assumed: true };
}

/** 一次计费：cacheReadTokens 走命中价，(inputTokens + cacheWriteTokens) 走未命中价，output 走输出价。 */
export function costOf(tokens, row, bucket, scale = 1) {
  const p = row[bucket];
  const hit = tokens.cacheReadTokens || 0;
  const miss = (tokens.inputTokens || 0) + (tokens.cacheWriteTokens || 0);
  const out = tokens.outputTokens || 0;
  return ((hit * p.cacheHit + miss * p.cacheMiss + out * p.output) / 1e6) * scale;
}

/* ================================================================
 * 4. 账本读取与聚合
 * ============================================================== */
export function readLedger(home) {
  const p = path.join(home, 'storages', 'usage-stats-cache.json');
  if (!fs.existsSync(p)) throw new AuditError(`账本文件不存在：${p}\n（DSH_HOME=${home}）`);
  const raw = fs.readFileSync(p, 'utf8');
  let j;
  try {
    j = JSON.parse(raw);
  } catch (e) {
    throw new AuditError(`账本 JSON 解析失败：${p}\n${e.message}`);
  }
  if (!j || typeof j !== 'object' || !j.sessions || typeof j.sessions !== 'object') {
    throw new AuditError(`账本结构异常：期望顶层含 sessions 对象，实际顶层键 = ${Object.keys(j || {}).join(',')}`);
  }
  return { ledger: j, ledgerPath: p, ledgerBytes: Buffer.byteLength(raw, 'utf8') };
}

/**
 * 聚合账本：全局 totals、按日、按模型、hours 桶、覆盖度。
 * 异常逐条记进 anomalies（不静默跳过），level=error 会让 CLI 以退出码 3 结束。
 */
export function aggregateLedger(ledger, { holidays = HOLIDAYS_CN, officialOnly = false } = {}) {
  const anomalies = [];
  const sids = Object.keys(ledger.sessions);
  const grand = emptyTokens();
  let requests = 0;
  const modelTotals = new Map();
  const modelDayCells = new Map();
  const byDay = new Map();
  const buckets = new Map();
  const covered = emptyTokens();
  let coveredRequests = 0;
  let dayTokenCells = 0, badDayCells = 0, hoursBucketsSeen = 0, badHourBuckets = 0;
  const openStepsShapes = new Set();
  const kinds = new Set();

  const keep = (model) => !officialOnly || String(model).startsWith(OFFICIAL_PROVIDER + '/');
  const newDay = (day) => ({ day, tokens: emptyTokens(), requests: 0, models: new Set(), compactedTokens: 0, hasHours: false });

  for (const sid of sids) {
    const s = ledger.sessions[sid];
    if (!s || typeof s !== 'object') {
      anomalies.push({ level: 'error', where: `sessions.${sid}`, msg: '不是对象' });
      continue;
    }
    if (s.kind !== undefined) kinds.add(s.kind);
    if (s.openSteps !== undefined) openStepsShapes.add(Array.isArray(s.openSteps) ? 'array' : typeof s.openSteps);

    for (const [day, v] of Object.entries(s.days || {})) {
      dayTokenCells++;
      if (!v || typeof v !== 'object' || !v.totals || typeof v.models !== 'object' || v.models === null) {
        badDayCells++;
        anomalies.push({
          level: 'error',
          where: `sessions.${sid}.days.${day}`,
          msg: '缺少 totals 或 models（实测格式：{totals, models, requests, intervals, compacted}）',
        });
        continue;
      }
      const t = officialOnly ? emptyTokens() : v.totals;
      if (officialOnly) for (const [m, mt] of Object.entries(v.models)) if (keep(m)) addTokens(t, mt);

      let d = byDay.get(day) || newDay(day);
      byDay.set(day, d);
      addTokens(d.tokens, t);
      d.requests += v.requests || 0;
      d.compactedTokens += typeof v.compacted === 'number' ? v.compacted : 0;

      for (const m of Object.keys(v.models)) {
        d.models.add(m);
        if (!keep(m)) continue;
        let cur = modelTotals.get(m) || emptyTokens();
        addTokens(cur, v.models[m]);
        modelTotals.set(m, cur);
        modelDayCells.set(m, (modelDayCells.get(m) || 0) + 1);
      }
      addTokens(grand, t);
      requests += v.requests || 0;
    }

    for (const [key, h] of Object.entries(s.hours || {})) {
      let parsed;
      try {
        parsed = parseHourKey(key);
      } catch (e) {
        badHourBuckets++;
        anomalies.push({ level: 'error', where: `sessions.${sid}.hours.${key}`, msg: e.message });
        continue;
      }
      if (!h || typeof h !== 'object' || !h.totals) {
        badHourBuckets++;
        anomalies.push({ level: 'error', where: `sessions.${sid}.hours.${key}`, msg: '缺少 totals' });
        continue;
      }
      hoursBucketsSeen++;
      const k = `${parsed.day}T${String(parsed.hour).padStart(2, '0')}`;
      let b = buckets.get(k);
      if (!b) {
        b = { day: parsed.day, hour: parsed.hour, isPeak: isPeak(parsed.day, parsed.hour, holidays), tokens: emptyTokens(), requests: 0 };
        buckets.set(k, b);
      }
      addTokens(b.tokens, h.totals);
      b.requests += h.requests || 0;
      addTokens(covered, h.totals);
      coveredRequests += h.requests || 0;
      const dd = byDay.get(parsed.day) || newDay(parsed.day);
      dd.hasHours = true;
      byDay.set(parsed.day, dd);
    }
  }

  // 覆盖度：hours 桶未必覆盖全部 token（hours 可能被裁剪掉早期小时）
  const uncovered = emptyTokens();
  const covRatio = {};
  for (const k of Object.keys(uncovered)) {
    const u = (grand[k] || 0) - (covered[k] || 0);
    if (u < 0) {
      anomalies.push({ level: 'warn', where: 'coverage', msg: `${k}：hours 桶(${covered[k]}) 大于 days 汇总(${grand[k]})，差额按 0 处理` });
      uncovered[k] = 0;
    } else uncovered[k] = u;
    covRatio[k] = grand[k] ? (covered[k] || 0) / grand[k] : 1;
  }

  return {
    sessions: sids.length, requests, totals: grand, covered, uncovered, covRatio,
    coveredRequests, modelTotals, modelDayCells,
    byDay: [...byDay.values()].sort((a, b) => (a.day < b.day ? -1 : 1)),
    buckets: [...buckets.values()].sort((a, b) => (a.day === b.day ? a.hour - b.hour : a.day < b.day ? -1 : 1)),
    anomalies,
    selfCheck: {
      sessionsSeen: sids.length, dayTokenCells, badDayCells, hoursBucketsSeen, badHourBuckets,
      kinds: [...kinds], openStepsShapes: [...openStepsShapes],
      requestsFromDays: requests, requestsFromHours: coveredRequests,
      requestsMatch: requests === coveredRequests,
    },
  };
}

/* ================================================================
 * 5. 成本估算
 * ============================================================== */
/** 峰谷 token 拆分 + 每个 token 类型的峰谷占比（供按模型计价时按比例摊分）。 */
function peakOffSplit(agg) {
  const peakTokens = emptyTokens(), offTokens = emptyTokens();
  let peakRequests = 0, offRequests = 0;
  for (const b of agg.buckets) {
    if (b.isPeak) { addTokens(peakTokens, b.tokens); peakRequests += b.requests; }
    else { addTokens(offTokens, b.tokens); offRequests += b.requests; }
  }
  const peakShare = {}, offShare = {};
  for (const k of Object.keys(peakTokens)) {
    const t = (peakTokens[k] || 0) + (offTokens[k] || 0);
    peakShare[k] = t ? (peakTokens[k] || 0) / t : 0;
    offShare[k] = t ? (offTokens[k] || 0) / t : 0;
  }
  return { peakTokens, offTokens, peakRequests, offRequests, peakShare, offShare };
}

export function estimateLedgerCost(ledger, opts = {}) {
  const { holidays = HOLIDAYS_CN, scale = 1, officialOnly = false } = opts;
  const agg = aggregateLedger(ledger, { holidays, officialOnly });
  const { peakTokens, offTokens, peakRequests, offRequests, peakShare, offShare } = peakOffSplit(agg);

  const assumptions = [
    DISCLAIMER,
    `价目表 ${PRICE_TABLE.version}（${PRICE_TABLE.source}）；单位元 / 百万 token。`,
    PEAK_RULE.note,
    `HOLIDAYS_CN 已填 ${holidays.size} 天。` + (holidays.size === 0 ? '留空 ⇒ 节假日被当作高峰，成本偏高（保守）。' : ''),
    officialOnly
      ? `--official-only：只计 ${OFFICIAL_PROVIDER}/* 的模型；峰谷占比取自全量 hours 桶（近似）。`
      : '非 deepseek-official 的 provider 按 DeepSeek 官方同名模型价假设计价（见 byModel[].priceAssumed）。',
    'hours 桶不覆盖的 token，按已覆盖部分的峰谷混合单价折算，属近似。',
  ];
  if (scale !== 1) assumptions.push(`--price-scale ${scale}：全部单价乘以该倍数。`);

  // 按模型计价：每个模型的 token 按其自身价目行，峰谷按全局同类型占比摊分
  const byModel = [];
  const unmatchedModels = [];
  let costPeak = 0, costOff = 0, costLower = 0, costUpper = 0;
  for (const [model, t] of agg.modelTotals) {
    const r = resolvePriceRow(model);
    if (!r.key) { unmatchedModels.push(model); continue; }
    const pk = {}, of = {};
    for (const k of Object.keys(t)) { pk[k] = (t[k] || 0) * peakShare[k]; of[k] = (t[k] || 0) * offShare[k]; }
    const cPeak = costOf(pk, r.row, 'peak', scale);
    const cOff = costOf(of, r.row, 'off', scale);
    const cLo = costOf(t, r.row, 'off', scale);
    const cHi = costOf(t, r.row, 'peak', scale);
    costPeak += cPeak; costOff += cOff; costLower += cLo; costUpper += cHi;
    const provider = String(model).includes('/') ? String(model).slice(0, String(model).indexOf('/')) : '(无前缀)';
    byModel.push({
      model, provider, bareModel: r.bare, priceRowKey: r.key,
      priceAssumed: provider !== OFFICIAL_PROVIDER || r.bare !== r.key,
      tokens: t,
      modelDayCells: agg.modelDayCells.get(model) || 0,
      requestsNote: '账本 days.models 没有 requests 维度，modelDayCells = 该模型出现的 session-day 单元格数',
      cost: +(cPeak + cOff).toFixed(4),
      costLowerBoundAllOffPeak: +cLo.toFixed(4),
      costUpperBoundAllPeak: +cHi.toFixed(4),
    });
  }
  byModel.sort((a, b) => b.cost - a.cost);
  const costTotal = costPeak + costOff;
  for (const m of byModel) m.sharePct = costTotal ? +((m.cost / costTotal) * 100).toFixed(2) : 0;

  // 未覆盖 token：按已覆盖部分的峰谷混合单价折算（价目行取当前成本最高的那一行，偏保守）
  const fallbackRowKey = byModel.length ? byModel[0].priceRowKey : null;
  let uncoveredCost = 0;
  if (fallbackRowKey) {
    const row = PRICE_TABLE.rows[fallbackRowKey];
    const fields = [
      ['cacheReadTokens', 'cacheHit'],
      ['inputTokens', 'cacheMiss'],
      ['cacheWriteTokens', 'cacheMiss'],
      ['outputTokens', 'output'],
    ];
    for (const [field, priceField] of fields) {
      const toks = agg.uncovered[field] || 0;
      if (!toks) continue;
      const tot = (peakTokens[field] || 0) + (offTokens[field] || 0);
      const perTok = tot
        ? ((peakTokens[field] || 0) * row.peak[priceField] + (offTokens[field] || 0) * row.off[priceField]) / tot
        : row.peak[priceField];
      uncoveredCost += ((toks * perTok) / 1e6) * scale;
    }
    assumptions.push(`未覆盖 token 的折算单价取自 ${fallbackRowKey}（当前成本最高的价目行，偏保守）。`);
  }

  const byDayOut = agg.byDay.map((d) => {
    const wd = weekdayOf(d.day);
    const bi = billedInput(d.tokens);
    return {
      day: d.day, weekday: wd, isWeekend: wd === 0 || wd === 6, isHoliday: holidays.has(d.day),
      tokens: d.tokens, billedInputTokens: bi, requests: d.requests,
      models: [...d.models].sort(), compactedTokens: d.compactedTokens, hoursCovered: d.hasHours,
      cacheHitRate: bi ? +((d.tokens.cacheReadTokens / bi) * 100).toFixed(2) : 0,
      avgContextPerRequest: d.requests ? Math.round(bi / d.requests) : 0,
    };
  });

  const hourAgg = new Map();
  for (const b of agg.buckets) {
    let h = hourAgg.get(b.hour);
    if (!h) { h = { hour: b.hour, tokens: emptyTokens(), requests: 0 }; hourAgg.set(b.hour, h); }
    addTokens(h.tokens, b.tokens);
    h.requests += b.requests;
  }

  const total = costTotal + uncoveredCost;
  const coverage = {
    hoursTokenCoveragePct: +((tokenSum(agg.covered) / (tokenSum(agg.totals) || 1)) * 100).toFixed(2),
    requestsCoveragePct: +((agg.coveredRequests / (agg.requests || 1)) * 100).toFixed(2),
    perFieldCoveragePct: Object.fromEntries(Object.entries(agg.covRatio).map(([k, v]) => [k, +(v * 100).toFixed(2)])),
    uncoveredTokens: agg.uncovered,
    note: 'hours 桶覆盖不足时，未覆盖 token 按已覆盖峰谷比例折算，属近似。',
  };

  return {
    priceTable: {
      version: PRICE_TABLE.version, effectiveFrom: PRICE_TABLE.effectiveFrom, source: PRICE_TABLE.source,
      unit: PRICE_TABLE.unit, currency: PRICE_TABLE.currency, rows: PRICE_TABLE.rows,
    },
    peakRule: PEAK_RULE,
    holidaysCount: holidays.size,
    assumptions,
    totals: { tokens: agg.totals, billedInputTokens: billedInput(agg.totals), requests: agg.requests, sessions: agg.sessions },
    tokensByBucket: { peak: peakTokens, off: offTokens, uncovered: agg.uncovered, peakRequests, offRequests },
    cost: {
      currency: 'CNY',
      estimated: +total.toFixed(4),
      byBucket: { peak: +costPeak.toFixed(4), off: +costOff.toFixed(4), uncoveredApprox: +uncoveredCost.toFixed(4) },
      lowerBoundAllOffPeak: +(costLower + uncoveredCost).toFixed(4),
      upperBoundAllPeak: +costUpper.toFixed(4),
      perRequest: agg.requests ? +(total / agg.requests).toFixed(6) : 0,
      perMillionBilledInputTokens: billedInput(agg.totals) ? +(total / (billedInput(agg.totals) / 1e6)).toFixed(4) : 0,
      note: DISCLAIMER,
    },
    byDay: byDayOut,
    byModel,
    byHour: [...hourAgg.values()].sort((a, b) => a.hour - b.hour).map((h) => ({
      hour: h.hour,
      inPeakWindow: PEAK_RULE.windows.some(([s, e]) => h.hour >= s && h.hour < e),
      tokens: h.tokens, billedInputTokens: billedInput(h.tokens), requests: h.requests,
      avgContextPerRequest: h.requests ? Math.round(billedInput(h.tokens) / h.requests) : 0,
    })),
    coverage,
    unmatchedModels,
    anomalies: agg.anomalies,
    selfCheck: agg.selfCheck,
    counterfactuals: counterfactuals(ledger, { holidays, scale, officialOnly }),
  };
}

/* ================================================================
 * 6. 反事实对比
 * ============================================================== */
export function counterfactuals(ledger, { holidays = HOLIDAYS_CN, scale = 1, officialOnly = false } = {}) {
  const agg = aggregateLedger(ledger, { holidays, officialOnly });
  const { peakShare, offShare } = peakOffSplit(agg);
  // hours 只覆盖一部分 token：把覆盖部分的成本等比放大到全量（假设未覆盖部分同价，近似）
  const scaleUp = tokenSum(agg.totals) / (tokenSum(agg.covered) || 1);

  const compute = (transform, rowFor) => {
    let c = 0, unmatched = 0;
    for (const [model, t] of agg.modelTotals) {
      const r = resolvePriceRow(model);
      if (!r.key) { unmatched++; continue; }
      const tt = transform(t, r);
      const useRow = rowFor ? rowFor(r) : r.row;
      const pk = {}, of = {};
      for (const k of Object.keys(t)) { pk[k] = (tt[k] || 0) * peakShare[k]; of[k] = (tt[k] || 0) * offShare[k]; }
      c += costOf(pk, useRow, 'peak', scale) + costOf(of, useRow, 'off', scale);
    }
    return { cost: c * scaleUp, unmatched };
  };

  const scenarios = [];
  const push = (name, note, transform, rowFor) => {
    const { cost, unmatched } = compute(transform, rowFor);
    scenarios.push({ name, note, cost: +cost.toFixed(4), unmatchedModels: unmatched });
  };

  push('actual', '实际口径估算（按各模型自身价目行 + 实测峰谷比例）', (t) => t);
  push('cache_disabled', '假设完全没有 prompt 缓存命中：cacheReadTokens 全部按未命中价计费（最坏情形）', (t) => ({
    ...t, cacheReadTokens: 0, inputTokens: (t.inputTokens || 0) + (t.cacheReadTokens || 0),
  }));
  push('context_minus_30', '上下文长度整体 -30%（cacheRead 与新输入等比缩减），输出不变', (t) => ({
    ...t, cacheReadTokens: (t.cacheReadTokens || 0) * 0.7, inputTokens: (t.inputTokens || 0) * 0.7,
  }));
  push('context_minus_50', '上下文长度整体 -50%：「控制内容进入上下文」的直接收益', (t) => ({
    ...t, cacheReadTokens: (t.cacheReadTokens || 0) * 0.5, inputTokens: (t.inputTokens || 0) * 0.5,
  }));
  push('output_minus_20', '输出 token -20%（更短的回答 / 更少冗余正文）', (t) => ({ ...t, outputTokens: (t.outputTokens || 0) * 0.8 }));
  push('pro_to_flash', '把 deepseek-v4-pro 的用量按 deepseek-flash 计价（换模型 / 路由降价）', (t) => t,
    (r) => (r.key === 'deepseek-v4-pro' ? PRICE_TABLE.rows['deepseek-flash'] : r.row));
  push('combined_max', '空闲时段 + 上下文 -50% + pro→flash 三者叠加（不含输出缩减）', (t) => t, (r) => (r.key === 'deepseek-v4-pro' ? PRICE_TABLE.rows['deepseek-flash'] : r.row));

  // 需要「全部按空闲价 / 叠加缩减」的场景重算：直接按 off 价 × 缩减后 token 求和
  const HALVE = { all_off_peak: false, combined_max: true };
  for (const s of scenarios) {
    if (!(s.name in HALVE)) continue;
    const halve = HALVE[s.name];
    let c = 0;
    for (const [model, t] of agg.modelTotals) {
      const r = resolvePriceRow(model);
      if (!r.key) continue;
      const useRow = r.key === 'deepseek-v4-pro' && halve ? PRICE_TABLE.rows['deepseek-flash'] : r.row;
      const tt = halve ? { ...t, cacheReadTokens: (t.cacheReadTokens || 0) * 0.5, inputTokens: (t.inputTokens || 0) * 0.5 } : t;
      c += costOf(tt, useRow, 'off', scale);
    }
    s.cost = +(c * scaleUp).toFixed(4);
  }

  const baseline = scenarios[0].cost;
  for (const s of scenarios) {
    s.delta = +(s.cost - baseline).toFixed(4);
    s.deltaPct = baseline ? +(((s.cost - baseline) / baseline) * 100).toFixed(2) : 0;
  }
  const ranked = scenarios.slice(1).sort((a, b) => a.cost - b.cost);

  return {
    baseline,
    baselineNote: '基线 = 各模型自身价目行 + 实测峰谷比例摊分，再按 hours 覆盖率等比放大到全量。',
    cheapestScenario: ranked[0]?.name ?? null,
    scenarios,
    caveat: '反事实都是「把已发生的 token 量按另一套价格 / 缩减比例重算」，不是对未来的预测；金额一律是估算，不是账单。',
  };
}

/* ================================================================
 * 7. CLI
 * ============================================================== */
export function loadHolidays(file, base = HOLIDAYS_CN) {
  const set = new Set(base);
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  const arr = Array.isArray(j) ? j : j.holidays;
  if (!Array.isArray(arr)) throw new AuditError(`--holidays 文件格式错误：期望数组或 {holidays:[...]}，实际 ${typeof j}`);
  for (const d of arr) set.add(String(d));
  return set;
}

export function main(argv = process.argv.slice(2)) {
  const { flags, opts } = parseArgs(argv);
  const { home, source, tried } = resolveHome(opts);
  const holidays = opts.holidays ? loadHolidays(opts.holidays) : HOLIDAYS_CN;
  const scale = opts['price-scale'] !== undefined ? Number(opts['price-scale']) : 1;
  if (!Number.isFinite(scale) || scale <= 0) throw new AuditError(`--price-scale 必须是正数，实际 ${opts['price-scale']}`);

  const { ledger, ledgerPath, ledgerBytes } = readLedger(home);
  const result = {
    script: 'audit-cost.mjs', formatVersion: FORMAT_VERSION, disclaimer: DISCLAIMER,
    input: {
      home, homeSource: source, homeTried: tried, ledgerPath, ledgerBytes,
      ledgerVersion: ledger.version ?? null,
      flags: { officialOnly: flags.has('official-only'), priceScale: scale, holidaysFile: opts.holidays ?? null },
    },
    ...estimateLedgerCost(ledger, { holidays, scale, officialOnly: flags.has('official-only') }),
  };

  const out = JSON.stringify(result, null, 2);
  process.stdout.write(out + '\n');

  // ---------------- 自检 ----------------
  const sc = result.selfCheck, c = result.cost, cf = result.counterfactuals;
  const bi = result.totals.billedInputTokens;
  const lines = [
    '[self-check] audit-cost.mjs',
    `  home                 = ${home}  (来源：${source})`,
    `  ledger               = ${ledgerPath}  ${ledgerBytes} bytes  version=${ledger.version}`,
    `  sessions / requests  = ${result.totals.sessions} / ${result.totals.requests}`,
    `  billed input tokens  = ${bi}  (input ${result.totals.tokens.inputTokens} + cacheRead ${result.totals.tokens.cacheReadTokens} + cacheWrite ${result.totals.tokens.cacheWriteTokens})`,
    `  output tokens        = ${result.totals.tokens.outputTokens}`,
    `  cache hit rate       = ${((result.totals.tokens.cacheReadTokens / (bi || 1)) * 100).toFixed(2)}%`,
    `  avg ctx / request    = ${result.totals.requests ? Math.round(bi / result.totals.requests) : 0}`,
    `  day cells / bad      = ${sc.dayTokenCells} / ${sc.badDayCells}`,
    `  hours buckets / bad  = ${sc.hoursBucketsSeen} / ${sc.badHourBuckets}`,
    `  hours coverage       = ${result.coverage.hoursTokenCoveragePct}% tokens, requests ${result.coverage.requestsCoveragePct}%`,
    `  requests days/hours  = ${sc.requestsFromDays} / ${sc.requestsFromHours}  match=${sc.requestsMatch}`,
    `  peak/off cost        = ${c.byBucket.peak} / ${c.byBucket.off}  (+uncovered approx ${c.byBucket.uncoveredApprox})`,
    `  ESTIMATED COST       = ${c.estimated} ${c.currency}   bounds [${c.lowerBoundAllOffPeak} .. ${c.upperBoundAllPeak}]`,
    `  cost / request       = ${c.perRequest} ${c.currency}`,
    `  models priced        = ${result.byModel.length}, unmatched = ${result.unmatchedModels.length}${result.unmatchedModels.length ? ' :: ' + result.unmatchedModels.join(', ') : ''}`,
    `  counterfactual best  = ${cf.cheapestScenario}`,
  ];
  for (const s of cf.scenarios) lines.push(`      ~ ${s.name.padEnd(18)} ${String(s.cost).padStart(12)}  delta ${s.deltaPct}%`);
  lines.push(`  anomalies            = ${result.anomalies.length}`);
  for (const a of result.anomalies.slice(0, 10)) lines.push(`      ! [${a.level}] ${a.where}: ${a.msg}`);
  process.stderr.write(lines.join('\n') + '\n');

  if (opts.out) {
    const abs = path.resolve(opts.out);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, out, 'utf8');
    process.stderr.write(`[self-check] wrote ${abs} (${Buffer.byteLength(out, 'utf8')} bytes)\n`);
  }
  return result.anomalies.some((a) => a.level === 'error') ? 3 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    process.exitCode = main();
  } catch (e) {
    process.stderr.write(`[ERROR] ${e instanceof AuditError ? e.message : (e && e.stack) || String(e)}\n`);
    process.exitCode = 1;
  }
}