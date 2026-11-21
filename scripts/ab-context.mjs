#!/usr/bin/env node
/**
 * ab-context.mjs —— 7 天 A/B 的复测脚本（**只读**，不改任何状态、不启动计时）
 *
 * ============================ 判读标准（开工前定死，禁止事后调整） ============================
 *
 * 主指标：平均上下文 / 请求
 *     平均上下文/请求 = (inputTokens + cacheReadTokens + cacheWriteTokens) / requests
 *     （即「每次调用真正发出去的上下文」，含缓存命中部分；缓存命中仍要按约 1/10 价计费）
 *
 *   有效      测试窗比基线窗下降 >= 10%
 *   疑似有效  下降 5% ~ 10%
 *   无效      下降 < 5%，或反而上升          —— 说明这条修法没起作用，应回滚，别硬撑
 *
 * 质量安全阀（防止「省了钱但答案变短」被误判成成功）：
 *   每请求输出 token 下降 > 20%            => 判「有质量风险，人工复核」，**不得计为有效**
 *   两窗任一请求数 < 300 或覆盖天数 < 5    => 判「样本不足，无法判读」
 *
 * 辅助观察（只报告，不参与判读）：缓存命中率、单日最大上下文、每日序列
 *
 * 为什么用这个指标：本地实测根因是「消耗 = 平均上下文 × 调用次数」，
 * 而这条修法（工具返回落盘）只动「平均上下文」这一项，
 * 所以单看这一个指标就能判它有没有用，不需要等账单。
 * 依据：_docs/上下文成本根因报告-20261022.md
 *
 * ====================== 两个数据源（为什么必须有日志模式） ======================
 *
 * 账本模式（默认）：读 <DSH_HOME>/storages/usage-stats-cache.json
 *   ⚠️ 这本账是**懒刷新**的：只在会话结束 / 进程退出时落盘。
 *      实测 2026-10-23：本环境那本停在 10-16 23:16，而另一处的账本已覆盖到 10-22。
 *      进程长期不退出，它就一直显示旧数 —— 测 A/B 前**先确认账本覆盖到了测试窗**，
 *      否则会得到「测试窗 0 天」。
 *
 * 日志模式（--from-logs）：直接读会话日志 <DSH_HOME>/sessions/<group>/session-<id>/session.v4.jsonl.zstd
 *   - 逐条 `assistant/message` 事件的 data.usage 累加；字段只有
 *     inputTokens / cacheReadTokens / outputTokens / totalTokens
 *     （**日志里没有 cacheWriteTokens**，按 0 计），时间取事件顶层 `time`（epoch 毫秒）。
 *   - 日志是**实时写入**的，不受懒刷新影响 —— 这是它存在的唯一理由。
 *   - 代价：要扫日志。脚本按「日志 mtime >= 基线窗起点」预筛，
 *     所以只扫窗口内活跃过的会话；不看时间窗时默认只覆盖最近 30 天。
 *   - 日志是多帧追加 zstd：必须按魔数 28 B5 2F FD 切帧、逐帧 zstdDecompressSync
 *     （Node 的 createZstdDecompress 不支持多帧，会报 ZSTD_error_prefix_unknown）。
 *
 * 两种模式**不要混用绝对值**：实测同一天（2026-10-16，本环境）日志模式 1,331 次调用 / 平均上下文
 *   157,625，账本模式 806 次 / 147,984 —— 日志把每次 `assistant/message` 都算一次调用，且覆盖的会话更全
 *   （日志 208 个会话目录 vs 账本 93 个会话）。所以 A/B 只能在**同一个模式内**做前后对照，
 *   跨模式比绝对值会得出错误结论。
 *
 * ================================ 用法 ================================
 *
 *   node scripts/ab-context.mjs --base 2026-10-16:2026-10-22 --test 2026-10-24:2026-10-30
 *   node scripts/ab-context.mjs --from-logs --home <DSH_HOME> --base ... --test ...
 *   可选：--home <DSH_HOME>   --ledger <账本路径>   --from-logs   --json <输出.json>
 *   不带 --base/--test：只打印总量（自检与「开工前基线快照」）
 *
 * 自检（账本模式、2026-10-23 快照，跑出来应接近）：全局平均上下文/请求 ≈ 177,015、
 *   请求数 ≈ 11,503、缓存命中率 ≈ 96.80%。对不上就说明口径或指标定义错了，**先修脚本再谈结论**。
 * ======================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { zstdDecompressSync } from 'node:zlib';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const ZSTD_MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);
const TOKEN_KEYS = ['inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens'];

function die(msg) {
  console.error('[ab-context] ' + msg);
  process.exit(1);
}

function parseArgs(argv) {
  const out = { base: null, test: null, ledger: null, home: null, json: null, fromLogs: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) die('参数 ' + a + ' 后面缺值');
      return v;
    };
    if (a === '--base') out.base = next();
    else if (a === '--test') out.test = next();
    else if (a === '--ledger') out.ledger = next();
    else if (a === '--home') out.home = next();
    else if (a === '--json') out.json = next();
    else if (a === '--from-logs') out.fromLogs = true;
    else if (a === '-h' || a === '--help') out.help = true;
    else die('未知参数: ' + a);
  }
  return out;
}

/** 'YYYY-MM-DD:YYYY-MM-DD' -> {from,to}；天粒度、闭区间 */
function parseWindow(text, label) {
  if (!text) return null;
  const parts = text.split(':');
  if (parts.length !== 2) die(label + ' 需要写成 from:to（例如 2026-10-16:2026-10-22）');
  const [from, to] = parts;
  if (!DAY.test(from) || !DAY.test(to)) die(label + ' 日期格式必须是 YYYY-MM-DD');
  if (from > to) die(label + ' 起止写反了');
  return { from, to };
}

function findLedger(opts) {
  if (opts.ledger) {
    if (!fs.existsSync(opts.ledger)) die('找不到账本: ' + opts.ledger);
    return opts.ledger;
  }
  const home = opts.home || process.env.DSH_HOME;
  if (!home) {
    die('没有 DSH_HOME。请显式传 --home <DSH_HOME> 或 --ledger <账本路径>。\n' +
        '  账本位置：<DSH_HOME>/storages/usage-stats-cache.json');
  }
  const p = path.join(home, 'storages', 'usage-stats-cache.json');
  if (!fs.existsSync(p)) die('账本不存在: ' + p);
  return p;
}

// ---------------- 日志模式：直接读会话日志里的逐请求 usage ----------------

/** 在 <home>/sessions 下（最多 3 层）找所有 session.v4.jsonl.zstd */
function findLogs(home) {
  const root = path.join(home, 'sessions');
  if (!fs.existsSync(root)) die('找不到会话目录: ' + root);
  const found = [];
  const walk = (dir, depth) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory() && depth < 3) walk(p, depth + 1);
      else if (e.isFile() && e.name === 'session.v4.jsonl.zstd') {
        found.push({ path: p, id: path.basename(path.dirname(p)), mtime: fs.statSync(p).mtimeMs });
      }
    }
  };
  walk(root, 0);
  return found;
}

/** 多帧 zstd -> 明文 Buffer（切帧失败时固定起点、终点后并，别跳过——跳过会静默丢帧） */
function decompressAll(buf) {
  const starts = [];
  let i = buf.indexOf(ZSTD_MAGIC, 0);
  while (i !== -1) { starts.push(i); i = buf.indexOf(ZSTD_MAGIC, i + 4); }
  if (!starts.length) return buf;
  const parts = [];
  for (let k = 0; k < starts.length; k++) {
    let out = null;
    let j = k;
    while (out === null && j < starts.length) {
      const to = (j + 1 < starts.length) ? starts[j + 1] : buf.length;
      try { out = zstdDecompressSync(buf.subarray(starts[k], to)); } catch { out = null; }
      if (out === null) j++;
    }
    if (out === null) continue;
    k = j;
    parts.push(out);
  }
  return Buffer.concat(parts);
}

/** epoch 毫秒 -> 本地日期 YYYY-MM-DD */
function dayOfTime(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return null;
  const d = new Date(n);
  const p = (x) => String(x).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

/** 把会话日志折成与账本同形的结构：{sessions:{id:{days:{day:{totals,requests}}}}} */
function buildLedgerFromLogs(home, sinceMs) {
  const logs = findLogs(home).filter((l) => !sinceMs || l.mtime >= sinceMs);
  const sessions = {};
  let events = 0, requests = 0, noUsage = 0;
  for (const l of logs) {
    const text = decompressAll(fs.readFileSync(l.path)).toString('utf8');
    const days = {};
    for (const line of text.split('\n')) {
      const s = line.trim();
      if (!s) continue;
      let ev;
      try { ev = JSON.parse(s); } catch { continue; }
      events++;
      if (ev.type !== 'assistant/message') continue;
      const u = (ev.data || {}).usage;
      if (!u || typeof u !== 'object') { noUsage++; continue; }
      const day = dayOfTime(ev.time);
      if (!day) continue;
      const d = days[day] || (days[day] = { totals: {
        inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }, requests: 0 });
      d.requests++;
      requests++;
      for (const k of TOKEN_KEYS) d.totals[k] += Number(u[k] || 0);
    }
    if (Object.keys(days).length) sessions[l.id] = { kind: 'log', days, hours: {} };
  }
  console.error('[from-logs] 扫描日志 ' + logs.length + ' 个 / 事件 ' + fmt(events) +
                ' / 计费请求 ' + fmt(requests) + ' / 无 usage 的 assistant 消息 ' + fmt(noUsage) + ' 条');
  return { version: 'logs', sessions, meta: { scanned: logs.length, events, requests, noUsage } };
}

// ---------------- 汇总与判读 ----------------

/** 累计一个窗口内的总量，并按天给出序列 */
function aggregate(ledger, win) {
  const acc = {
    sessions: 0, requests: 0,
    inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0,
    days: new Map(),
    maxDayContext: 0, maxDayContextDay: null
  };
  for (const [, s] of Object.entries(ledger.sessions || {})) {
    const days = s.days || {};
    let touched = false;
    for (const [day, d] of Object.entries(days)) {
      if (!DAY.test(day)) continue;
      if (win && (day < win.from || day > win.to)) continue;
      const t = d.totals || {};
      touched = true;
      const req = Number(d.requests || 0);
      const row = acc.days.get(day) || {
        requests: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0
      };
      row.requests += req;
      for (const k of TOKEN_KEYS) {
        const v = Number(t[k] || 0);
        acc[k] += v;
        row[k] += v;
      }
      acc.days.set(day, row);
    }
    if (touched) acc.sessions++;
  }
  for (const [day, r] of acc.days) {
    const ctx = r.inputTokens + r.cacheReadTokens + r.cacheWriteTokens;
    if (ctx > acc.maxDayContext) { acc.maxDayContext = ctx; acc.maxDayContextDay = day; }
  }
  acc.requests = 0;
  for (const r of acc.days.values()) acc.requests += r.requests;
  return acc;
}

function metrics(a) {
  const ctx = a.inputTokens + a.cacheReadTokens + a.cacheWriteTokens;
  const cacheable = a.inputTokens + a.cacheReadTokens;
  return {
    sessions: a.sessions,
    days: a.days.size,
    requests: a.requests,
    ctxPerReq: a.requests ? ctx / a.requests : 0,
    outPerReq: a.requests ? a.outputTokens / a.requests : 0,
    cacheHit: cacheable ? a.cacheReadTokens / cacheable : 0,
    ctxTotal: ctx,
    maxDayContext: a.maxDayContext,
    maxDayContextDay: a.maxDayContextDay
  };
}

const fmt = (n, d = 0) => Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (x) => (x * 100).toFixed(2) + '%';
const signed = (x) => (x >= 0 ? '+' : '') + (x * 100).toFixed(1) + '%';

function verdict(base, test) {
  const rows = [];
  if (test.days < 5 || base.days < 5) rows.push('样本不足，无法判读（覆盖天数 < 5）');
  if (test.requests < 300 || base.requests < 300) rows.push('样本不足，无法判读（请求数 < 300）');
  if (rows.length) return { level: '无法判读', reasons: rows };

  const dCtx = (test.ctxPerReq - base.ctxPerReq) / base.ctxPerReq;
  const dOut = (test.outPerReq - base.outPerReq) / base.outPerReq;
  const reasons = ['平均上下文/请求 ' + signed(dCtx), '每请求输出 token ' + signed(dOut)];

  if (dOut < -0.20) {
    return { level: '有质量风险，人工复核', reasons: reasons.concat([
      '每请求输出 token 下降超过 20%：可能只是答案变短了，不得计为有效'
    ]) };
  }
  if (dCtx <= -0.10) return { level: '有效', reasons };
  if (dCtx <= -0.05) return { level: '疑似有效', reasons };
  return { level: '无效', reasons: reasons.concat(['下降不足 5%（或上升）：这条修法没起作用，应回滚']) };
}

function showTable(base, test) {
  const line = (name, b, t, f) => {
    console.log('  ' + name.padEnd(22) + String(f(b)).padStart(16) + String(t === null || t === undefined ? '' : f(t)).padStart(16) +
                String(t !== null && t !== undefined && b ? '  ' + signed((t - b) / (b || 1)) : '').padStart(12));
  };
  console.log('  ' + '指标'.padEnd(20) + '基线窗'.padStart(16) + '测试窗'.padStart(16) + '变化'.padStart(12));
  console.log('  ' + '-'.repeat(66));
  line('覆盖天数', base.days, test && test.days, (v) => fmt(v));
  line('请求数', base.requests, test && test.requests, (v) => fmt(v));
  line('平均上下文/请求', base.ctxPerReq, test && test.ctxPerReq, (v) => fmt(v));
  line('每请求输出 token', base.outPerReq, test && test.outPerReq, (v) => fmt(v, 1));
  line('缓存命中率', base.cacheHit, test && test.cacheHit, (v) => pct(v));
  line('单日最大上下文', base.maxDayContext, test && test.maxDayContext, (v) => fmt(v));
}

function showDays(acc, label) {
  const ks = [...acc.days.keys()].sort();
  if (ks.length < 2) return;
  console.log('\n  每日序列（' + label + '）  日期 → 请求数 / 平均上下文·每请求');
  for (const d of ks) {
    const r = acc.days.get(d);
    const ctx = r.inputTokens + r.cacheReadTokens + r.cacheWriteTokens;
    console.log('    ' + d + '   ' + fmt(r.requests).padStart(6) + '   ' +
                fmt(ctx / (r.requests || 1)).padStart(9));
  }
}

// ---------------- 主流程 ----------------

const opts = parseArgs(process.argv.slice(2));
if (opts.help) {
  console.log('用法: node scripts/ab-context.mjs [--from-logs] --home DSH_HOME [--base from:to --test from:to] [--ledger p] [--json out]');
  process.exit(0);
}

const baseWin = parseWindow(opts.base, '--base');
const testWin = parseWindow(opts.test, '--test');

let ledger, sourceLabel;
if (opts.fromLogs) {
  const home = opts.home || process.env.DSH_HOME;
  if (!home) die('--from-logs 需要 --home <DSH_HOME>（或设置 DSH_HOME）');
  // 没给窗口时默认只看最近 30 天，别把 200+ 个日志全扫一遍
  const since = baseWin ? Date.parse(baseWin.from + 'T00:00:00')
                        : Date.now() - 30 * 86400 * 1000;
  ledger = buildLedgerFromLogs(home, since);
  sourceLabel = '会话日志 ' + home + '  (version logs, ' + Object.keys(ledger.sessions).length +
                ' 个会话, 只看 mtime >= ' +
                (baseWin ? baseWin.from : new Date(since).toISOString().slice(0, 10)) + ')';
} else {
  const ledgerPath = findLedger(opts);
  ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
  sourceLabel = ledgerPath + '  (version ' + ledger.version + ', ' +
                Object.keys(ledger.sessions || {}).length + ' 个会话)';
}
console.log('数据源: ' + sourceLabel);

const baseAcc = aggregate(ledger, baseWin);
const base = metrics(baseAcc);
const scope = baseWin ? '基线窗总量（' + baseWin.from + '~' + baseWin.to + '）'
                      : '全局总量（自检用：账本模式应 ≈ 平均上下文/请求 177,015 / 请求 11,503 / 命中 96.80%）';
console.log('\n=== ' + scope + ' ===');
showTable(base, null);
if (baseWin) showDays(baseAcc, '基线窗');

let result = null;
if (baseWin && testWin) {
  const testAcc = aggregate(ledger, testWin);
  const test = metrics(testAcc);
  console.log('\n=== A/B 对照（基线 ' + baseWin.from + '~' + baseWin.to +
              '  vs  测试 ' + testWin.from + '~' + testWin.to + '）===');
  showTable(base, test);
  showDays(testAcc, '测试窗');
  const v = verdict(base, test);
  console.log('\n判读: 【' + v.level + '】');
  for (const r of v.reasons) console.log('  - ' + r);
  result = { source: sourceLabel, base: baseWin, test: testWin, baseMetrics: base, testMetrics: test, verdict: v };
} else {
  console.log('\n（未给 --base/--test：只做总量快照，不判读）');
}

if (opts.json) {
  const payload = result || { source: sourceLabel, selfCheckOnly: true, baseMetrics: base };
  fs.writeFileSync(opts.json, JSON.stringify(payload, null, 2), 'utf8');
  console.log('\n已写出: ' + opts.json);
}