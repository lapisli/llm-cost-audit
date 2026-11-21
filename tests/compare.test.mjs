import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compare, formatCompareText } from '../lib/compare.mjs';

const read = (p) => JSON.parse(fs.readFileSync(new URL(`../examples/${p}`, import.meta.url), 'utf8'));

function bill({ requests, cost, cached = 0, uncached = 0, output = 0, currency = 'CNY', period = '2026-01' }) {
  return {
    meta: { currency, period },
    models: {
      m: {
        requestCount: requests,
        inputCachedTokens: cached,
        inputUncachedTokens: uncached,
        outputTokens: output,
      },
    },
    totalCost: cost,
  };
}

test('样例账单能对比出成本下降', () => {
  const r = compare(read('sample-bill.json'), read('sample-bill-after.json'));
  assert.ok(r.delta.totalCostPct < -30, `应降 30% 以上，实际 ${r.delta.totalCostPct}`);
  assert.equal(r.before.requestCount, 11503);
  assert.equal(r.after.requestCount, 11503);
});

test('请求数不变时，单位成本变化等于总成本变化', () => {
  const r = compare(read('sample-bill.json'), read('sample-bill-after.json'));
  assert.ok(Math.abs(r.delta.totalCostPct - r.delta.costPer1kRequestsPct) < 0.01);
});

test('剔除用量变化后的节省按基期用量折算', () => {
  // 基期：1000 次请求 ¥1000 → ¥1/千请求
  // 对比期：2000 次请求 ¥1500 → ¥0.75/千请求
  // 按基期 1000 次算，应省 ¥250
  const r = compare(bill({ requests: 1000, cost: 1000 }), bill({ requests: 2000, cost: 1500 }));
  assert.equal(Math.round(r.realizedSaving), 250);
});

test('用量暴涨时总成本涨但单位成本降，caveat 要点出来', () => {
  const r = compare(bill({ requests: 1000, cost: 1000 }), bill({ requests: 3000, cost: 2000 }));
  assert.ok(r.delta.totalCostPct > 0, '总成本应上涨');
  assert.ok(r.delta.costPer1kRequestsPct < 0, '单位成本应下降');
  assert.ok(r.caveats.some((c) => c.includes('请求数变化')), '应提示请求数变化');
  assert.ok(r.caveats.some((c) => c.includes('单位成本')), '应提示以单位成本为准');
});

test('请求数变化小于 10% 不报警', () => {
  const r = compare(bill({ requests: 1000, cost: 1000 }), bill({ requests: 1050, cost: 1000 }));
  assert.ok(!r.caveats.some((c) => c.includes('请求数变化')));
});

test('币种不同会警告', () => {
  const r = compare(bill({ requests: 100, cost: 100, currency: 'CNY' }), bill({ requests: 100, cost: 100, currency: 'USD' }));
  assert.ok(r.caveats.some((c) => c.includes('币种不同')));
});

test('两期 period 相同时提醒', () => {
  const r = compare(bill({ requests: 100, cost: 100, period: '2026-01' }), bill({ requests: 100, cost: 90, period: '2026-01' }));
  assert.ok(r.caveats.some((c) => c.includes('period 相同')));
});

test('缺 period 时提醒周期可能不一致', () => {
  const r = compare(bill({ requests: 100, cost: 100, period: null }), bill({ requests: 100, cost: 90, period: '2026-02' }));
  assert.ok(r.caveats.some((c) => c.includes('没标 period')));
});

test('永远带「不是 A/B 对照」的免责', () => {
  const r = compare(bill({ requests: 100, cost: 100 }), bill({ requests: 100, cost: 90 }));
  assert.ok(r.caveats.some((c) => c.includes('不是 A/B 对照')));
});

test('缓存命中率按 cached / (cached + uncached) 算', () => {
  const r = compare(
    bill({ requests: 100, cost: 100, cached: 900, uncached: 100 }),
    bill({ requests: 100, cost: 100, cached: 800, uncached: 200 })
  );
  assert.equal(r.before.cacheHitRate, 0.9);
  assert.equal(r.after.cacheHitRate, 0.8);
});

test('请求数为 0 不产生 Infinity', () => {
  const r = compare(bill({ requests: 0, cost: 100 }), bill({ requests: 0, cost: 50 }));
  assert.equal(r.before.costPer1kRequests, null);
  assert.equal(r.after.costPer1kRequests, null);
  assert.ok(Number.isFinite(r.delta.totalCostPct));
});

test('总成本写在 meta 里也能读', () => {
  const a = bill({ requests: 100, cost: 100 });
  const b = bill({ requests: 100, cost: 50 });
  b.totalCost = undefined;
  b.meta.totalCost = 50;
  const r = compare(a, b);
  assert.equal(r.after.totalCost, 50);
  assert.equal(r.delta.totalCostPct, -50);
});

test('models 里逐项累加成本（无顶层 totalCost）', () => {
  const b = {
    meta: { currency: 'CNY', period: '2026-02' },
    models: {
      x: { requestCount: 50, totalCost: 30 },
      y: { requestCount: 50, totalCost: 20 },
    },
  };
  const r = compare(bill({ requests: 100, cost: 100 }), b);
  assert.equal(r.after.totalCost, 50);
});

test('上下文变化超过 15% 会点出来', () => {
  const r = compare(
    bill({ requests: 100, cost: 100, cached: 10000, uncached: 1000 }),
    bill({ requests: 100, cost: 100, cached: 3000, uncached: 300 })
  );
  assert.ok(r.caveats.some((c) => c.includes('平均上下文变化')));
});

test('文本输出含关键行', () => {
  const out = formatCompareText(compare(read('sample-bill.json'), read('sample-bill-after.json')));
  assert.ok(out.includes('两期账单对比'));
  assert.ok(out.includes('每千次请求成本'));
  assert.ok(out.includes('剔除用量变化后的已实现节省'));
  assert.ok(out.includes('¥265.00'));
});

test('文本输出的中文列对齐（按显示宽度算，中文占 2 格）', () => {
  const dw = (s) => {
    let n = 0;
    for (const ch of s) {
      const c = ch.codePointAt(0);
      n +=
        c >= 0x1100 &&
        (c <= 0x115f ||
          (c >= 0x2e80 && c <= 0xa4cf) ||
          (c >= 0xac00 && c <= 0xd7a3) ||
          (c >= 0xf900 && c <= 0xfaff) ||
          (c >= 0xfe30 && c <= 0xfe6f) ||
          (c >= 0xff00 && c <= 0xff60) ||
          (c >= 0xffe0 && c <= 0xffe6))
          ? 2
          : 1;
    }
    return n;
  };
  // 把一行按显示宽度 56 切开（20 + 18 + 18），后面应是「变化」列
  const splitAt = (line, target) => {
    let w = 0;
    let i = 0;
    while (w < target && i < line.length) {
      w += dw(line[i]);
      i++;
    }
    return line.slice(i);
  };

  const out = formatCompareText(compare(read('sample-bill.json'), read('sample-bill-after.json')));
  const dataLines = out
    .split('\n')
    .filter((l) => /^(总成本|请求数|每千次请求成本|每百万 token 成本|缓存命中率|单请求平均上下文)/.test(l));
  assert.equal(dataLines.length, 6, '应有 6 行数据');
  for (const line of dataLines) {
    const change = splitAt(line, 56);
    assert.match(change, /^[-+]?\d+\.\d{2}%$/, `变化列未对齐：「${line}」→「${change}」`);
  }
});

test('命中率显示不带正号', () => {
  const out = formatCompareText(
    compare(
      bill({ requests: 100, cost: 100, cached: 900, uncached: 100 }),
      bill({ requests: 100, cost: 100, cached: 900, uncached: 100 })
    )
  );
  assert.ok(out.includes('90.00%'));
  assert.ok(!out.includes('+90.00%'), '绝对值不该带正号');
});
