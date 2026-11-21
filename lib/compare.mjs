/**
 * compare.mjs —— 两期账单对比
 *
 * 为什么需要它：
 *   审计做完，客户下个月会问「到底省了多少」。`estimate()` 的 realizedTotal
 *   永远是 null，因为单期账单证明不了因果。两期对比能给出一个**更强但仍不完美**
 *   的证据：同样的活，钱少了多少。
 *
 * 纪律（比数字更重要）：
 *   1. 成本下降 ≠ 节省。业务量也在变，必须同时看**单位成本**（每千次请求花多少）。
 *   2. 不是 A/B 对照。同期业务变化、模型换代、促销折扣都会污染结论，必须列出来。
 *   3. 币种不同不比。汇率波动会把结论搅烂。
 */

/** 把账单里的 models 汇总成可比的一行 */
function summarize(bill) {
  const models = bill?.models || {};
  let totalCost = 0;
  let requestCount = 0;
  let inputCached = 0;
  let inputUncached = 0;
  let output = 0;
  let hasCost = false;

  for (const [name, m] of Object.entries(models)) {
    if (Number.isFinite(m.totalCost)) {
      totalCost += m.totalCost;
      hasCost = true;
    }
    if (Number.isFinite(m.requestCount)) requestCount += m.requestCount;
    if (Number.isFinite(m.inputCachedTokens)) inputCached += m.inputCachedTokens;
    if (Number.isFinite(m.inputUncachedTokens)) inputUncached += m.inputUncachedTokens;
    if (Number.isFinite(m.outputTokens)) output += m.outputTokens;
  }

  // 总成本可能写在顶层（estimate 的账单格式）或 meta 里（部分导出格式）
  const billCost = Number.isFinite(bill?.totalCost)
    ? bill.totalCost
    : Number.isFinite(bill?.meta?.totalCost)
      ? bill.meta.totalCost
      : null;
  const cost = billCost ?? (hasCost ? totalCost : null);
  const totalTokens = inputCached + inputUncached + output;

  return {
    period: bill?.meta?.period || null,
    currency: bill?.meta?.currency || 'CNY',
    totalCost: cost,
    requestCount,
    totalTokens,
    inputCached,
    inputUncached,
    output,
    cacheHitRate: totalTokens > 0 ? inputCached / (inputCached + inputUncached) : null,
    avgContextPerRequest: requestCount > 0 ? totalTokens / requestCount : null,
    /** 每千次请求的成本 —— 排除业务量变化后的真实单价 */
    costPer1kRequests: cost != null && requestCount > 0 ? (cost / requestCount) * 1000 : null,
    /** 每百万 token 的成本 */
    costPerMillionTokens: cost != null && totalTokens > 0 ? (cost / totalTokens) * 1e6 : null,
    modelCount: Object.keys(models).length,
  };
}

function pctChange(before, after) {
  if (!Number.isFinite(before) || !Number.isFinite(after)) return null;
  if (before === 0) return null;
  return ((after - before) / before) * 100;
}

function fmtPct(v) {
  if (!Number.isFinite(v)) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
}

/** 绝对值百分比（命中率这类）—— 不加正号 */
function fmtRawPct(v) {
  if (!Number.isFinite(v)) return '—';
  return `${v.toFixed(2)}%`;
}

/** 显示宽度：中日韩字符占 2 格，用它对齐才不会歪 */
function dispWidth(s) {
  let n = 0;
  for (const ch of String(s)) {
    const c = ch.codePointAt(0);
    n += c >= 0x1100 && (c <= 0x115f || (c >= 0x2e80 && c <= 0xa4cf) || (c >= 0xac00 && c <= 0xd7a3) || (c >= 0xf900 && c <= 0xfaff) || (c >= 0xfe30 && c <= 0xfe6f) || (c >= 0xff00 && c <= 0xff60) || (c >= 0xffe0 && c <= 0xffe6)) ? 2 : 1;
  }
  return n;
}

function padW(s, width) {
  const str = String(s);
  return str + ' '.repeat(Math.max(0, width - dispWidth(str)));
}

/**
 * @param {object} before 基线期账单
 * @param {object} after  对比期账单
 * @returns {object} 对比结果
 */
export function compare(before, after) {
  const a = summarize(before);
  const b = summarize(after);
  const caveats = [];

  if (a.currency !== b.currency) {
    caveats.push(
      `两期币种不同（${a.currency} vs ${b.currency}），汇率波动会污染结论。先把两期统一成同一币种再比。`
    );
  }

  const costDelta = a.totalCost != null && b.totalCost != null ? b.totalCost - a.totalCost : null;
  const costPct = pctChange(a.totalCost, b.totalCost);
  const reqPct = pctChange(a.requestCount, b.requestCount);
  const unitPct = pctChange(a.costPer1kRequests, b.costPer1kRequests);

  // 用量变化过大时，总成本差额不能直接当成「优化成果」
  if (Number.isFinite(reqPct) && Math.abs(reqPct) > 10) {
    caveats.push(
      `请求数变化 ${fmtPct(reqPct)}，超过 10%。总成本的差额里有相当部分是业务量变化，` +
        `不能全部归因于降本动作。看「每千次请求成本」那一行更准。`
    );
  }

  if (Number.isFinite(unitPct) && Number.isFinite(costPct)) {
    const gap = Math.abs(costPct - unitPct);
    if (gap > 5) {
      caveats.push(
        `总成本变化 ${fmtPct(costPct)} 与单位成本变化 ${fmtPct(unitPct)} 相差 ${gap.toFixed(1)} 个百分点，` +
          `差额来自用量变化。向客户汇报时应以单位成本为准。`
      );
    }
  }

  if (!a.period || !b.period) {
    caveats.push('有一期账单没标 period，无法确认两期时长是否一致。周期不同则总额不可直接比。');
  } else if (a.period === b.period) {
    caveats.push(`两期 period 相同（${a.period}），可能不是不同周期，请确认。`);
  }

  const cachePct = pctChange(a.cacheHitRate, b.cacheHitRate);
  const ctxPct = pctChange(a.avgContextPerRequest, b.avgContextPerRequest);

  if (Number.isFinite(ctxPct) && Math.abs(ctxPct) > 15) {
    caveats.push(
      `单请求平均上下文变化 ${fmtPct(ctxPct)}，这是成本变动的主要驱动之一（消耗 ≈ 上下文 × 调用次数）。`
    );
  }

  caveats.push(
    '这不是 A/B 对照。同期业务结构、模型换代、厂商调价都会影响结果；要证因果，需保留对照组。'
  );

  return {
    before: a,
    after: b,
    delta: {
      totalCost: costDelta,
      totalCostPct: costPct,
      requestCount: b.requestCount - a.requestCount,
      requestCountPct: reqPct,
      costPer1kRequestsPct: unitPct,
      costPerMillionTokensPct: pctChange(a.costPerMillionTokens, b.costPerMillionTokens),
      cacheHitRatePct: cachePct,
      avgContextPct: ctxPct,
      totalTokensPct: pctChange(a.totalTokens, b.totalTokens),
    },
    /**
     * 真实降本金额：用量没变时的成本差额；用量变了就按单位成本折算。
     * 这是「已实现节省」唯一能拿出来的数，且必须带 caveats 一起看。
     */
    realizedSaving: (() => {
      if (costDelta == null) return null;
      if (!Number.isFinite(unitPct)) return null;
      // 用基期用量 × 单位成本变化 = 剔除业务量影响后的节省
      if (a.requestCount > 0 && Number.isFinite(a.costPer1kRequests) && Number.isFinite(b.costPer1kRequests)) {
        return ((a.costPer1kRequests - b.costPer1kRequests) / 1000) * a.requestCount;
      }
      return null;
    })(),
    caveats,
  };
}

export function formatCompareText(r) {
  const cur = r.after.currency === 'USD' ? '$' : '¥';
  const money = (v) => (Number.isFinite(v) ? cur + v.toFixed(2) : '—');
  const C1 = 20;
  const C2 = 18;
  const C3 = 18;
  const row = (label, a, b, change) =>
    `${padW(label, C1)}${padW(a, C2)}${padW(b, C3)}${change}`;
  const L = [];
  L.push('');
  L.push('两期账单对比');
  L.push('─'.repeat(72));
  L.push(row('指标', '基线期', '对比期', '变化'));
  L.push(row('总成本', money(r.before.totalCost), money(r.after.totalCost), fmtPct(r.delta.totalCostPct)));
  L.push(row('请求数', r.before.requestCount, r.after.requestCount, fmtPct(r.delta.requestCountPct)));
  L.push(
    row(
      '每千次请求成本',
      money(r.before.costPer1kRequests),
      money(r.after.costPer1kRequests),
      fmtPct(r.delta.costPer1kRequestsPct)
    )
  );
  L.push(
    row(
      '每百万 token 成本',
      money(r.before.costPerMillionTokens),
      money(r.after.costPerMillionTokens),
      fmtPct(r.delta.costPerMillionTokensPct)
    )
  );
  L.push(
    row(
      '缓存命中率',
      fmtRawPct(r.before.cacheHitRate != null ? r.before.cacheHitRate * 100 : null),
      fmtRawPct(r.after.cacheHitRate != null ? r.after.cacheHitRate * 100 : null),
      fmtPct(r.delta.cacheHitRatePct)
    )
  );
  L.push(
    row(
      '单请求平均上下文',
      Math.round(r.before.avgContextPerRequest ?? 0).toLocaleString('zh-CN'),
      Math.round(r.after.avgContextPerRequest ?? 0).toLocaleString('zh-CN'),
      fmtPct(r.delta.avgContextPct)
    )
  );
  L.push('');
  L.push(`剔除用量变化后的已实现节省：${money(r.realizedSaving)}`);
  L.push('');
  L.push('注意：');
  for (const c of r.caveats) L.push(`  · ${c}`);
  L.push('');
  return L.join('\n');
}
