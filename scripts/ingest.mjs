#!/usr/bin/env node
/**
 * ingest.mjs —— 账单适配 CLI（薄壳）
 *
 * 逻辑全在 lib/ingest.mjs；这里只解析参数、调适配器、写文件。
 *
 * 用法：
 *   node scripts/ingest.mjs <input> --from openai|anthropic|litellm|generic [--out bill.json]
 *   node scripts/ingest.mjs <input> --from generic --map input_tokens=inputTotalTokens,... --out bill.json
 *   node scripts/ingest.mjs --list-fields
 *
 * 支持的输入：.json / .csv / .jsonl
 */

import fs from 'node:fs';
import path from 'node:path';
import { UNIFIED_FIELDS, ADAPTERS, parseArgs, readInput } from '../lib/ingest.mjs';

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
