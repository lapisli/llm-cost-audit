#!/usr/bin/env node
/**
 * verify.mjs —— 分发自检：确认这个 skill 能被各客户端正确加载
 *
 * 用法：node scripts/verify.mjs
 * 退出码：0 = 全部通过，1 = 有阻塞问题
 *
 * 检查什么（都是真实会踩的坑）：
 *   1. frontmatter 合规（name/description 必填、长度上限、name 格式）
 *   2. name 与目录名一致（不一致时多数客户端加载失败）
 *   3. SKILL.md 里引用的相对路径文件都存在（装了才发现缺文件最常见）
 *   4. 所有 .mjs 语法正确
 *   5. package.json 合法且 bin 指向真实文件
 *   6. 私有/敏感文件没有被 git 跟踪
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const results = [];
const ok = (name, detail = '') => results.push({ level: 'ok', name, detail });
const fail = (name, detail = '') => results.push({ level: 'fail', name, detail });
const warn = (name, detail = '') => results.push({ level: 'warn', name, detail });

// ── 1. frontmatter ───────────────────────────────
function checkFrontmatter() {
  const p = path.join(ROOT, 'SKILL.md');
  if (!fs.existsSync(p)) return fail('SKILL.md 存在', '文件缺失');
  const txt = fs.readFileSync(p, 'utf8');
  const m = txt.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return fail('frontmatter', 'SKILL.md 开头没有 --- 包裹的 YAML');

  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const mm = line.match(/^([a-zA-Z][a-zA-Z0-9_-]*):\s*(.*)$/);
    if (mm) fm[mm[1]] = mm[2].trim();
  }

  if (!fm.name) fail('frontmatter.name', '缺失（必填）');
  else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(fm.name)) {
    fail('frontmatter.name', `"${fm.name}" 应为小写字母数字加连字符`);
  } else if (fm.name.length > 64) {
    fail('frontmatter.name', `长度 ${fm.name.length} 超过 64`);
  } else ok('frontmatter.name', fm.name);

  if (!fm.description) fail('frontmatter.description', '缺失（必填）');
  else if (fm.description.length > 1024) {
    fail('frontmatter.description', `长度 ${fm.description.length} 超过 1024`);
  } else ok('frontmatter.description', `${fm.description.length} 字符`);

  // name 与目录名一致
  const dirName = path.basename(ROOT);
  if (fm.name && fm.name !== dirName) {
    fail('name 与目录名一致', `name="${fm.name}" 但目录是 "${dirName}"`);
  } else if (fm.name) {
    ok('name 与目录名一致', dirName);
  }

  return fm;
}

// ── 2. 引用文件存在性 ─────────────────────────────
function checkReferences() {
  const txt = fs.readFileSync(path.join(ROOT, 'SKILL.md'), 'utf8');
  // 抓 SKILL.md 里出现的反引号路径与 markdown 链接
  const candidates = new Set();
  for (const m of txt.matchAll(/`([a-zA-Z0-9_./-]+\.(?:md|mjs|json))`/g)) candidates.add(m[1]);
  for (const m of txt.matchAll(/\]\(([a-zA-Z0-9_./-]+\.(?:md|mjs|json))\)/g)) candidates.add(m[1]);

  const missing = [];
  for (const rel of candidates) {
    if (rel.includes('<') || rel.startsWith('http')) continue;
    if (!fs.existsSync(path.join(ROOT, rel))) missing.push(rel);
  }
  if (missing.length) fail('SKILL.md 引用的文件都存在', `缺失：${missing.join('、')}`);
  else ok('SKILL.md 引用的文件都存在', `${candidates.size} 个引用`);
}

// ── 2b. matrix.mjs 里的 doc 路径 ──────────────────
function checkMatrixDocs() {
  const p = path.join(ROOT, 'lib', 'matrix.mjs');
  if (!fs.existsSync(p)) return;
  const txt = fs.readFileSync(p, 'utf8');
  const docs = [...txt.matchAll(/doc:\s*'([^']+)'/g)].map((m) => m[1]);
  const uniq = [...new Set(docs)];
  if (!uniq.length) return warn('matrix 的 doc 路径', '一项都没找到');
  const missing = uniq.filter((d) => !fs.existsSync(path.join(ROOT, d)));
  if (missing.length) fail('matrix 的 doc 路径都存在', `缺失：${missing.join('、')}`);
  else ok('matrix 的 doc 路径都存在', `${uniq.length} 个文档`);
}

// ── 3. 语法检查 ──────────────────────────────────
function checkSyntax() {  const dirs = ['lib', 'scripts', 'tests', 'adapters'];
  const files = [];
  const walk = (d) => {
    const abs = path.join(ROOT, d);
    if (!fs.existsSync(abs)) return;
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      const rel = path.join(d, e.name);
      if (e.isDirectory()) walk(rel);
      else if (e.name.endsWith('.mjs')) files.push(rel);
    }
  };
  dirs.forEach(walk);

  const bad = [];
  for (const rel of files) {
    try {
      execFileSync(process.execPath, ['--check', path.join(ROOT, rel)], { stdio: 'pipe' });
    } catch (e) {
      bad.push(rel);
    }
  }
  if (bad.length) fail('JS 语法', `报错：${bad.join('、')}`);
  else ok('JS 语法', `${files.length} 个文件通过`);
}

// ── 4. package.json ──────────────────────────────
function checkPackage() {
  const p = path.join(ROOT, 'package.json');
  if (!fs.existsSync(p)) return warn('package.json', '不存在（作为纯 skill 分发可以没有）');
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    return fail('package.json 合法', e.message);
  }
  ok('package.json 合法', `v${pkg.version || '?'}`);

  const bins = pkg.bin || {};
  const missing = Object.entries(bins)
    .filter(([, rel]) => !fs.existsSync(path.join(ROOT, rel)))
    .map(([k, rel]) => `${k}→${rel}`);
  if (missing.length) fail('bin 指向真实文件', missing.join('、'));
  else ok('bin 指向真实文件', `${Object.keys(bins).length} 个`);
}

// ── 5. 私有文件未被跟踪 ───────────────────────────
function checkPrivate() {
  const privDir = path.join(ROOT, 'private');
  if (!fs.existsSync(privDir)) return ok('私有目录', '无 private/（不需要检查）');

  let tracked = [];
  try {
    const out = execFileSync('git', ['ls-files', 'private'], { cwd: ROOT, encoding: 'utf8' });
    tracked = out.split(/\r?\n/).filter(Boolean);
  } catch {
    return warn('私有目录未被跟踪', '不是 git 仓库，跳过');
  }
  if (tracked.length) {
    fail('私有目录未被跟踪', `仍被 git 跟踪：${tracked.join('、')}`);
  } else {
    const n = fs.readdirSync(privDir).filter((f) => f.endsWith('.md')).length;
    ok('私有目录未被跟踪', `private/ 下 ${n} 份，均不在 git 索引`);
  }
}

// ── 6. 运行时冒烟 ────────────────────────────────
function checkRuntime() {
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'estimate.mjs'), '--list'], {
      cwd: ROOT, stdio: 'pipe',
    });
    ok('estimate.mjs --list', '可执行');
  } catch (e) {
    fail('estimate.mjs --list', '执行失败');
  }

  const sample = path.join(ROOT, 'examples', 'sample-bill.json');
  if (!fs.existsSync(sample)) return warn('示例账单', '不存在');
  try {
    const out = execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'estimate.mjs'), sample, '--format', 'json'], {
      cwd: ROOT, encoding: 'utf8', stdio: 'pipe',
    });
    const r = JSON.parse(out);
    if (!Array.isArray(r.findings) || r.findings.length !== 18) {
      fail('示例账单可跑', `findings 应为 18 项，实际 ${r.findings?.length}`);
    } else if (r.realizedTotal !== null) {
      fail('示例账单可跑', 'realizedTotal 应为 null（纪律 2）');
    } else {
      ok('示例账单可跑', `18 项 / identified=${r.identifiedTotal.value}`);
    }
  } catch (e) {
    fail('示例账单可跑', e.message.split('\n')[0]);
  }
}

// ── 7. 分发目标路径提示 ──────────────────────────
function showTargets() {
  console.log('');
  console.log('安装位置（项目内 → 全局）：');
  const table = [
    ['Claude Code', '.claude/skills/', '~/.claude/skills/'],
    ['Codex', '.agents/skills/', '~/.codex/skills/'],
    ['Cursor', '.agents/skills/', '~/.cursor/skills/'],
    ['OpenCode', '.agents/skills/', '~/.config/opencode/skills/'],
    ['通用 (.agents 规范)', '.agents/skills/', '~/.agents/skills/'],
  ];
  for (const [name, proj, glob] of table) {
    console.log(`  ${name.padEnd(20)} ${proj.padEnd(22)} ${glob}`);
  }
  console.log('');
  console.log('或一条命令全装：npx skills add <你的用户名>/llm-cost-audit --all');
}

// ── 主流程 ──────────────────────────────────────
checkFrontmatter();
checkReferences();
checkMatrixDocs();
checkSyntax();
checkPackage();
checkPrivate();
checkRuntime();

const ICON = { ok: '✓', fail: '✗', warn: '!' };
console.log('');
console.log('llm-cost-audit 分发自检');
console.log('='.repeat(60));
for (const r of results) {
  const line = `  ${ICON[r.level]} ${r.name}`;
  console.log(line.padEnd(38) + (r.detail || ''));
}

const fails = results.filter((r) => r.level === 'fail');
const warns = results.filter((r) => r.level === 'warn');
console.log('='.repeat(60));
console.log(`通过 ${results.filter((r) => r.level === 'ok').length} / 警告 ${warns.length} / 阻塞 ${fails.length}`);

showTargets();

process.exit(fails.length ? 1 : 0);
