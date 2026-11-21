#!/usr/bin/env node
/**
 * friction-scan.mjs —— 会话日志里的「摩擦事件」扫描（**只读**）
 *
 * 为什么需要它：账本能告诉你花了多少 token，但**不能**告诉你这些钱是怎么被白白烧掉的。
 * 三类摩擦只存在于会话日志（session.v4.jsonl.zstd）里：
 *
 *   1) 重试        事件 `llm/retry`           同一回合反复打模型，成本直接翻倍
 *   2) prune       事件 `compaction/prune`    上下文被剪掉的记录（衡量「窗口撑爆」的频率）
 *   3) 隐藏调用    事件 `tool/call` 里 search / fetch 类
 *                  —— 服务端工具调用，**2026-11-01 00:00 起按次计费**（每 1,000 次 5 元），
 *                     在此之前不计费，所以它藏在预算之外（见 reference/09-price-cn.md）
 *
 * 关键实现细节（踩过坑，勿改）：
 *   - 日志是**多帧追加**的 zstd：必须按魔数 28 B5 2F FD 切帧，逐帧 `zstdDecompressSync`。
 *     Node 的 `createZstdDecompress` **不支持多帧**，会报 ZSTD_error_prefix_unknown。
 *   - 魔数可能出现在压缩数据内部，所以「切出来的块解不开」时要**固定起点、把终点往后并一帧**再试，
 *     不能跳过——跳过会静默丢帧。
 *   - 账本里的 times 桶是扁平结构，别去找嵌套的 totals（那是账本，不是日志）。
 *
 * 用法：
 *   node scripts/friction-scan.mjs --home <DSH_HOME> [--last 10 | --all | --session <id前缀>] [--json out.json]
 *   默认 --last 10（按日志最后修改时间倒序），避免一次扫 200+ 个会话把机器拖住。
 *
 * 校准（2026-10-23 实测，跑出来必须一致）：
 *   --session d91b8a91  =>  events 3,679 / llm/retry 0 / compaction/prune 36 / tool/call 569
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { zstdDecompressSync } from 'node:zlib';

const ZSTD_MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);
const HIDDEN = /^(web_)?(search|fetch)$/i;   // 只认服务端 Search / Fetch
                                             // （本地工具如 memory_search 不经服务端、不计费，别算进来）

function die(msg) {
  console.error('[friction-scan] ' + msg);
  process.exit(1);
}

function parseArgs(argv) {
  const out = { home: null, last: 10, all: false, session: null, json: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) die('参数 ' + a + ' 后面缺值');
      return v;
    };
    if (a === '--home') out.home = next();
    else if (a === '--last') out.last = Number(next());
    else if (a === '--all') out.all = true;
    else if (a === '--session') out.session = next();
    else if (a === '--json') out.json = next();
    else if (a === '-h' || a === '--help') out.help = true;
    else die('未知参数: ' + a);
  }
  return out;
}

/** 在 <home>/sessions 下（最多 3 层）找出所有 session.v4.jsonl.zstd */
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

/** 多帧 zstd -> 明文 Buffer（切帧失败时固定起点、终点后并） */
function decompressAll(buf) {
  const starts = [];
  let i = buf.indexOf(ZSTD_MAGIC, 0);
  while (i !== -1) { starts.push(i); i = buf.indexOf(ZSTD_MAGIC, i + 4); }
  if (!starts.length) return buf;                       // 本来就是明文
  const parts = [];
  for (let k = 0; k < starts.length; k++) {
    let out = null;
    let j = k;
    while (out === null && j < starts.length) {
      const to = (j + 1 < starts.length) ? starts[j + 1] : buf.length;
      try { out = zstdDecompressSync(buf.subarray(starts[k], to)); } catch { out = null; }
      if (out === null) j++;
    }
    if (out === null) continue;                          // 这一段彻底解不开：跳过
    k = j;                                               // 并进来的假魔数不再单独处理
    parts.push(out);
  }
  return Buffer.concat(parts);
}

/** 扫描一个日志文件 */
function scan(file) {
  const raw = fs.readFileSync(file.path);
  const text = decompressAll(raw).toString('utf8');
  const res = {
    id: file.id, path: file.path, bytes: raw.length,
    events: 0, badLines: 0, turns: 0,
    retry: 0, prune: 0, hidden: 0, serverSearch: 0,
    retryKeys: new Set(), hiddenNames: new Map()
  };
  for (const line of text.split('\n')) {
    const s = line.trim();
    if (!s) continue;
    let ev;
    try { ev = JSON.parse(s); } catch { res.badLines++; continue; }
    res.events++;
    const type = ev.type;
    if (type === 'turn/start') res.turns++;
    else if (type === 'llm/retry') {
      res.retry++;
      const d = ev.data || {};
      res.retryKeys.add((d.provider || '?') + '/' + (d.policyKey || '?'));
    } else if (type === 'compaction/prune') res.prune++;
    else if (type === 'web/deepseek-search-llm-request') res.serverSearch++;
    else if (type === 'tool/call') {
      const d = ev.data || {};
      const name = String(d.name || d.tool || '');
      if (HIDDEN.test(name)) {
        res.hidden++;
        res.hiddenNames.set(name, (res.hiddenNames.get(name) || 0) + 1);
      }
    }
  }
  return res;
}

const fmt = (n) => Number(n).toLocaleString('en-US');
const opts = parseArgs(process.argv.slice(2));
if (opts.help) {
  console.log('用法: node scripts/friction-scan.mjs --home <DSH_HOME> [--last N | --all | --session <id>] [--json out]');
  process.exit(0);
}
const home = opts.home || process.env.DSH_HOME;
if (!home) die('没有 DSH_HOME。请显式传 --home <DSH_HOME>。');

let logs = findLogs(home);
if (opts.session) logs = logs.filter((l) => l.id.includes(opts.session));
else if (!opts.all) logs = logs.slice().sort((a, b) => b.mtime - a.mtime).slice(0, opts.last);
else console.log('注意：--all 会扫描 ' + logs.length + ' 个会话，可能要几分钟。');
if (!logs.length) die('没有匹配到会话日志（--session 前缀写对了吗？）');

console.log('DSH_HOME: ' + home);
console.log('扫描 ' + logs.length + ' 个会话日志\n');
console.log('  ' + '会话'.padEnd(20) + '事件'.padStart(9) + '轮次'.padStart(7) +
            '重试'.padStart(7) + 'prune'.padStart(8) + '隐藏调用'.padStart(10) + '坏行'.padStart(7));
console.log('  ' + '-'.repeat(70));

const rows = [];
const total = { events: 0, turns: 0, retry: 0, prune: 0, hidden: 0, badLines: 0 };
for (const l of logs) {
  const r = scan(l);
  rows.push({ ...r, retryKeys: [...r.retryKeys], hiddenNames: Object.fromEntries(r.hiddenNames) });
  for (const k of Object.keys(total)) total[k] += r[k];
  console.log('  ' + r.id.replace(/^session-/, '').slice(0, 19).padEnd(20) +
              fmt(r.events).padStart(9) + fmt(r.turns).padStart(7) +
              fmt(r.retry).padStart(7) + fmt(r.prune).padStart(8) +
              fmt(r.hidden).padStart(10) + fmt(r.badLines).padStart(7));
}
console.log('  ' + '-'.repeat(70));
console.log('  ' + '合计'.padEnd(20) + fmt(total.events).padStart(9) + fmt(total.turns).padStart(7) +
            fmt(total.retry).padStart(7) + fmt(total.prune).padStart(8) +
            fmt(total.hidden).padStart(10) + fmt(total.badLines).padStart(7));

const retryKeys = new Set();
const hiddenNames = new Map();
for (const r of rows) {
  r.retryKeys.forEach((k) => retryKeys.add(k));
  for (const [n, c] of Object.entries(r.hiddenNames)) hiddenNames.set(n, (hiddenNames.get(n) || 0) + c);
}
if (retryKeys.size) console.log('\n重试分布: ' + [...retryKeys].join(', '));
const serverSearch = rows.reduce((a, r) => a + (r.serverSearch || 0), 0);
if (hiddenNames.size || serverSearch) {
  if (hiddenNames.size) {
    console.log('隐藏调用（这是**工具调用次数**，不是计费单位）: ' +
      [...hiddenNames.entries()].sort((a, b) => b[1] - a[1]).map(([n, c]) => n + ' x' + c).join(', '));
  }
  console.log('服务端计费事件 web/deepseek-search-llm-request: ' + fmt(serverSearch) + ' 次' +
    '  => Search 侧按 5 元 / 1,000 次约 ' + (serverSearch / 1000 * 5).toFixed(2) + ' 元/期（2026-11-01 起）');
  console.log('⚠️ 口径：公告的计费单位是「服务端成功请求」，一次 web_search 可能触发多次查询，' +
    '所以工具调用次数不等于计费次数；web_fetch 在本版日志里没有服务端事件可数 —— ' +
    '**没有事件不代表不计费**，只能用工具调用次数粗估。');
}
if (total.badLines) console.log('\n注意: 有 ' + fmt(total.badLines) + ' 行解析失败（截断或非 JSON），已跳过。');

if (opts.json) {
  fs.writeFileSync(opts.json, JSON.stringify({ home, totals: total, sessions: rows }, null, 2), 'utf8');
  console.log('\n已写出: ' + opts.json);
}