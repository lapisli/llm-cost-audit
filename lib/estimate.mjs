/**
 * 核心计算器 —— 把账单算成「18 项 × 金额」
 *
 * 三条纪律（写死在代码里，违反即抛错）：
 *   1. identifiedTotal 用「联合反事实 + 重叠组取最大」，绝不把百分比相加
 *   2. realizedTotal 默认 null —— 没有 A/B 对照就是没有已实现节省
 *   3. evidence='厂商宣传' | '未核实' 的数字不得进入 identifiedTotal
 *
 * 输入契约见 examples/sample-bill.json
 */

import { WASTE_ITEMS, EVIDENCE, VERDICT, KIND, AVOID_ITEMS } from './matrix.mjs';
import { unitPriceWith, costOf } from './prices.mjs';

/** 同源浪费项：这些项的节省会互相重叠，合计时必须取最大而不是相加 */
export const OVERLAP_GROUPS = Object.freeze([
  ['W3', 'W11'],   // 上下文过长 / 上下文膨胀 —— 同一个根因
  ['W2', 'W10'],   // 缓存未命中 / 前缀过长 —— 都在动输入侧缓存
  ['W9', 'W16'],   // Agent 循环 / 多智能体放大 —— 都是调用次数
]);

/** 不得进入合计的证据等级 */
const EXCLUDED_FROM_TOTAL = new Set([EVIDENCE.VENDOR, EVIDENCE.UNVERIFIED]);

function round2(n) {
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function pct(part, whole) {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole === 0) return null;
  return round2((part / whole) * 100);
}

/** 取账单里某模型的字段，带单位换算 */
function modelData(bill, modelId) {
  const m = bill?.models?.[modelId];
  if (!m) return null;
  return {
    modelId,
    cached: Number(m.inputCachedTokens) || 0,
    uncached: Number(m.inputUncachedTokens) || 0,
    output: Number(m.outputTokens) || 0,
    requests: Number(m.requestCount) || 0,
    peak: m.peak === true,
    ...m,
  };
}

/** 当前输入成本（按当前命中结构） */
function currentInputCost(md, opts, bill) {
  const hitP = unitPriceWith(md.modelId, 'input.cached', opts, bill);
  const missP = unitPriceWith(md.modelId, 'input.uncached', opts, bill);
  if (hitP == null || missP == null) return null;
  return costOf(md.cached, hitP) + costOf(md.uncached, missP);
}

function currentOutputCost(md, opts, bill) {
  const p = unitPriceWith(md.modelId, 'output', opts, bill);
  return p == null ? null : costOf(md.output, p);
}

// ─────────────────────────────────────────────
// 公式注册表：id → (md, bill, ctx) => finding 片段
// ─────────────────────────────────────────────

const FORMULAS = {
  /** W2 固定前缀未缓存：命中率提升到 100% 能省多少 */
  cacheHitRate(md, bill) {
    const opts = { peak: md.peak };
    const missP = unitPriceWith(md.modelId, 'input.uncached', opts, bill);
    const hitP = unitPriceWith(md.modelId, 'input.cached', opts, bill);
    if (missP == null || hitP == null) {
      return {
        status: 'unmeasurable',
        reason: `模型 ${md.modelId} 不在价格表里（lib/prices.mjs），无法折算金额；请先补该模型的缓存价与未命中价`,
      };
    }
    const totalInput = md.cached + md.uncached;
    if (totalInput === 0) return { status: 'unmeasurable', reason: '无输入 token 数据' };
    const hitRate = md.cached / totalInput;
    const nowCost = currentInputCost(md, opts, bill);
    const idealCost = costOf(totalInput, hitP);
    const saving = nowCost - idealCost;

    if (hitRate >= 0.9) {
      return {
        status: 'miss',
        metric: { hitRate: round2(hitRate * 100), unit: '%' },
        saving: 0,
        reason: `命中率已达 ${round2(hitRate * 100)}%，在最优区，不要再动缓存`,
      };
    }
    return {
      status: 'hit',
      metric: { hitRate: round2(hitRate * 100), unit: '%' },
      baseline: round2(nowCost),
      saving: round2(saving),
      denominator: '输入侧成本',
      reason: `命中率 ${round2(hitRate * 100)}%，提升到 100% 可省输入侧`,
    };
  },

  /** W3 上下文过长：平均上下文超过阈值即命中；节省按「可裁剪比例」情景算 */
  contextTrim(md, bill, ctx) {
    const totalInput = md.cached + md.uncached;
    const avg = md.requests > 0 ? totalInput / md.requests : 0;
    const trimRatio = Number(ctx?.assumptions?.contextTrimRatio);
    const base = {
      metric: { avgContextTokens: Math.round(avg), unit: 'token/请求' },
    };
    if (avg <= 100000) {
      return { ...base, status: 'miss', saving: 0, reason: `平均上下文 ${Math.round(avg)}，未超 10 万阈值` };
    }
    if (!Number.isFinite(trimRatio) || trimRatio <= 0 || trimRatio >= 1) {
      return {
        ...base,
        status: 'unmeasurable',
        saving: null,
        reason: '平均上下文超阈值，但未提供可裁剪比例（需 A/B 实测），只能标待核实',
      };
    }
    const nowCost = currentInputCost(md, { peak: md.peak }, bill);
    if (nowCost == null) {
      return {
        ...base,
        status: 'unmeasurable',
        saving: null,
        reason: `模型 ${md.modelId} 不在价格表里（lib/prices.mjs），无法折算金额`,
      };
    }
    const saving = nowCost * trimRatio;
    return {
      ...base,
      status: 'hit',
      baseline: round2(nowCost),
      saving: round2(saving),
      denominator: '输入侧成本',
      assumption: `假设可裁剪 ${round2(trimRatio * 100)}%（情景值，非承诺）`,
      reason: `平均上下文 ${Math.round(avg)} 超过 10 万阈值`,
    };
  },

  /** W6 批处理：仅离线任务，按官方折扣 */
  batchRouting(md, bill, ctx) {
    const offline = Number(ctx?.assumptions?.offlineCostShare);
    const discount = Number(ctx?.assumptions?.batchDiscount);
    if (!Number.isFinite(offline) || offline <= 0) {
      return { status: 'unmeasurable', reason: '无离线任务占比数据' };
    }
    if (!Number.isFinite(discount) || discount <= 0 || discount >= 1) {
      return { status: 'unmeasurable', reason: '未提供该厂商的批处理折扣率（需官方明文）' };
    }
    const total = bill?.totalCost;
    const saving = Number.isFinite(total) ? total * offline * discount : null;
    return {
      status: saving == null ? 'unmeasurable' : 'hit',
      baseline: total ?? null,
      saving: round2(saving),
      denominator: '总成本',
      assumption: `离线任务占 ${round2(offline * 100)}%，折扣 ${round2(discount * 100)}%`,
      reason: '有官方折扣明文，且不需要改模型',
    };
  },

  /** W7 环境未分离 */
  envSeparation(md, bill, ctx) {
    const untagged = Number(ctx?.assumptions?.untaggedCostRatio);
    const total = bill?.totalCost;
    if (!Number.isFinite(untagged) || !Number.isFinite(total)) {
      return { status: 'unmeasurable', reason: '缺环境标签或无总成本' };
    }
    // 官方口径：开发/测试按 40h vs 168h，潜在节省 75%
    const saving = total * untagged * 0.75;
    return {
      status: untagged > 0 ? 'hit' : 'miss',
      baseline: total,
      saving: round2(saving),
      denominator: '总成本',
      assumption: '无标签部分按开发/测试口径（40h/168h = 75%）估算',
      reason: `无标签请求占 ${round2(untagged * 100)}%`,
    };
  },

  /** W9 隐藏调用 */
  hiddenCalls(md, bill, ctx) {
    const count = Number(ctx?.assumptions?.hiddenCallCount);
    const unit = Number(ctx?.assumptions?.hiddenCallUnitPrice);
    if (!Number.isFinite(count) || count <= 0) {
      return { status: 'miss', saving: 0, reason: '无隐藏调用记录' };
    }
    if (!Number.isFinite(unit)) {
      return {
        status: 'indicator',
        metric: { hiddenCallCount: count, unit: '次' },
        saving: null,
        reason: '有隐藏调用次数，但无单价（如搜索/抓取按次计费需官方价目），只能出指标',
      };
    }
    return {
      status: 'hit',
      metric: { hiddenCallCount: count, unit: '次' },
      saving: round2(count * unit),
      denominator: '按次计费项',
      reason: '隐藏调用可单独计量',
    };
  },

  /** W10 超长 preamble：按缓存命中价折算，通常极小 */
  preambleCost(md, bill, ctx) {
    const chars = Number(ctx?.assumptions?.preambleChars);
    const reqs = md.requests;
    const cachePrice = unitPriceWith(md.modelId, 'input.cached', { peak: md.peak }, bill);
    if (!Number.isFinite(chars) || !reqs || cachePrice == null) {
      return { status: 'unmeasurable', reason: '缺 preamble 字符数或请求数' };
    }
    // 粗估：1 token ≈ 1.6 中文字符
    const tokens = (chars * reqs) / 1.6;
    const saving = costOf(tokens, cachePrice);
    return {
      status: saving > 1 ? 'hit' : 'miss',
      metric: { preambleCharsPerRequest: chars, totalChars: chars * reqs, unit: '字符' },
      saving: round2(saving),
      denominator: '缓存读取成本',
      assumption: '按 1 token ≈ 1.6 字符粗估',
      reason: saving > 1 ? '注入量折算金额可观' : '折算金额不到 1 元，不值得为省钱大动',
    };
  },

  /** W11 上下文膨胀：与 W3 同源，这里出「调用次数」指标 */
  contextInflation(md, bill, ctx) {
    const calls = Number(ctx?.assumptions?.callsPerTask);
    const totalInput = md.cached + md.uncached;
    const avg = md.requests > 0 ? totalInput / md.requests : 0;
    const base = {
      metric: {
        avgContextTokens: Math.round(avg),
        callsPerTask: Number.isFinite(calls) ? calls : null,
        unit: 'token/请求',
      },
    };
    const hit = avg > 100000 || (Number.isFinite(calls) && calls > 30);
    return {
      ...base,
      status: hit ? 'indicator' : 'miss',
      saving: null,
      reason: hit
        ? '命中膨胀判据；节省与 W3 同源，为避免重复计算，这里只出指标不出钱'
        : '未命中膨胀判据',
    };
  },

  /** W12 语义缓存：只能按客户自己的重复率算 */
  semanticCache(md, bill, ctx) {
    const dup = Number(ctx?.assumptions?.customerDupRate);
    const total = bill?.totalCost;
    if (!Number.isFinite(dup) || !Number.isFinite(total)) {
      return {
        status: 'unmeasurable',
        reason: '缺客户自己的重复率；绝对命中率无权威公开数，厂商 70% 不得换算成钱',
      };
    }
    return {
      status: dup > 0 ? 'hit' : 'miss',
      baseline: total,
      saving: round2(total * dup),
      denominator: '总成本',
      assumption: `客户自身重复率 ${round2(dup * 100)}%（必须来自客户日志实算）`,
      reason: '按客户自己日志的重复率计算',
    };
  },

  /** W14 自托管盈亏平衡：只算 break-even，不承诺省钱 */
  selfHostBreakEven(md, bill, ctx) {
    const gpuHour = Number(ctx?.assumptions?.gpuHourlyPrice);
    const util = Number(ctx?.assumptions?.utilization);
    if (!Number.isFinite(gpuHour) || !Number.isFinite(util)) {
      return { status: 'unmeasurable', reason: '缺 GPU 时价或实际利用率' };
    }
    const effective = gpuHour / Math.max(util, 1e-6);
    return {
      status: 'indicator',
      metric: { effectiveGpuHourPrice: round2(effective), utilization: round2(util * 100), unit: '元/有效 GPU·hr' },
      saving: null,
      reason: '利用率 7% 与 API 打平、5% 比 API 贵；判为不建议做，只出 break-even 指标',
    };
  },

  /** W17 成本归因 */
  attribution(md, bill, ctx) {
    const coverage = Number(ctx?.assumptions?.tagCoverage);
    const total = bill?.totalCost;
    if (!Number.isFinite(coverage) || !Number.isFinite(total)) {
      return { status: 'unmeasurable', reason: '缺标签覆盖率或无总成本' };
    }
    return {
      status: 'indicator',
      metric: { tagCoverage: round2(coverage * 100), unit: '%' },
      saving: null,
      reason: '使能项非直接节省；无标签时后续每一项的深度都受限',
    };
  },

  /** W18 错峰调度：只能迁移「高峰那部分」，且已占满时要明说 */
  offPeakShift(md, bill, ctx) {
    const peakRatio = Number(ctx?.assumptions?.peakTokenRatio);
    const total = bill?.totalCost;
    if (!Number.isFinite(peakRatio) || !Number.isFinite(total)) {
      return { status: 'unmeasurable', reason: '缺按小时的用量分布' };
    }
    const saving = total * peakRatio * 0.5; // 空闲价是高峰的 5 折
    const theoretical = round2(saving);

    // 自审例外结论③：高峰占比很低时，杠杆已被占满，不该再报成节省。
    // 照模板套「把任务挪到夜间」会让客户白花钱，因为夜间本来就在用。
    if (peakRatio <= 0.2) {
      return {
        status: 'indicator',
        metric: { peakTokenRatio: round2(peakRatio * 100), theoreticalCeiling: theoretical, unit: '%' },
        saving: null,
        denominator: '总成本',
        assumption: '空闲时段全项 5 折（官方）',
        reason: `高峰仅占 ${round2(peakRatio * 100)}%，杠杆已被占满：理论天花板只有 ${theoretical}，且夜间本来就在用，不再报成节省（自审例外结论③）`,
      };
    }

    return {
      status: saving > 0 ? 'hit' : 'miss',
      baseline: total,
      saving: theoretical,
      denominator: '总成本',
      assumption: '空闲时段全项 5 折（官方）',
      reason: `高峰占 ${round2(peakRatio * 100)}%，有迁移空间`,
    };
  },

  /** W1 模型降档：没有影子评测就不出钱 */
  modelDownshift(md, bill, ctx) {
    const shadow = ctx?.assumptions?.shadowEval;
    if (!shadow || shadow.passed !== true) {
      return {
        status: 'unmeasurable',
        reason: '缺 200 条起的影子评测与质量验收阈值；没有质量回归证据就建议降档，是把客户的钱省成客户的损失',
      };
    }
    const flagshipCost = Number(shadow.flagshipCost);
    const smallCost = Number(shadow.smallCost);
    if (!Number.isFinite(flagshipCost) || !Number.isFinite(smallCost)) {
      return { status: 'unmeasurable', reason: '影子评测缺成本对照' };
    }
    return {
      status: 'hit',
      baseline: flagshipCost,
      saving: round2(flagshipCost - smallCost),
      denominator: '该 tag 成本',
      assumption: `影子评测通过（质量保持 ≥${shadow.qualityFloor ?? 95}%）`,
      reason: '有质量回归证据支撑降档',
    };
  },

  /** W16 多智能体放大 */
  multiAgent(md, bill, ctx) {
    const subCalls = Number(ctx?.assumptions?.subagentCalls);
    const baseline = Number(ctx?.assumptions?.singleAgentBaseline);
    if (!Number.isFinite(subCalls) || !Number.isFinite(baseline)) {
      return { status: 'unmeasurable', reason: '缺子代理调用次数与单智能体对照' };
    }
    return {
      status: 'indicator',
      metric: { subagentCalls: subCalls, singleAgentBaseline: baseline, unit: '次' },
      saving: null,
      reason: '官方口径 agent≈4×、多智能体≈15×；判断标准是任务价值撑不撑得住这个倍数',
    };
  },

  /** W8 重复嵌入 */
  dedupEmbedding(md, bill, ctx) {
    const embCost = Number(ctx?.assumptions?.embeddingCost);
    const dedup = Number(ctx?.assumptions?.dedupRatio);
    if (!Number.isFinite(embCost) || !Number.isFinite(dedup)) {
      return { status: 'unmeasurable', reason: '缺 embedding 明细或内容哈希去重率' };
    }
    return {
      status: embCost > 0 && dedup > 0 ? 'hit' : 'miss',
      baseline: embCost,
      saving: round2(embCost * dedup),
      denominator: 'embedding 成本',
      reason: '按去重率折算',
    };
  },
};

// ─────────────────────────────────────────────
// 主入口
// ─────────────────────────────────────────────

/**
 * @param {object} bill 统一账单（见 examples/sample-bill.json）
 * @param {object} [opts] { assumptions: {...} }
 * @returns {object} 审计结果
 */
export function estimate(bill, opts = {}) {
  const ctx = { assumptions: opts.assumptions || bill?.assumptions || {} };
  const findings = [];
  const missing = [];

  for (const item of WASTE_ITEMS) {
    const base = {
      id: item.id,
      name: item.name,
      verdict: item.verdict,
      evidence: item.evidence,
      kind: item.kind,
      doc: item.doc,
      note: item.note,
      // 显式默认：没有数据就是 null，绝不留给调用方一个 undefined
      saving: null,
    };

    // 不建议做的项：直接标记，不算钱
    if (item.verdict === VERDICT.AVOID) {
      findings.push({
        ...base,
        status: 'avoid',
        saving: null,
        reason: item.note,
      });
      continue;
    }

    // 缺公式或标为不可量的项
    if (!item.formula || item.kind === KIND.UNMEASURABLE) {
      findings.push({
        ...base,
        status: 'unmeasurable',
        saving: null,
        reason: `缺必要数据：${(item.requires || []).join('、') || '未定义'}`,
      });
      missing.push({ id: item.id, requires: item.requires || [] });
      continue;
    }

    const modelIds = Object.keys(bill?.models || {});
    const fn = FORMULAS[item.formula];
    if (typeof fn !== 'function') {
      findings.push({ ...base, status: 'unmeasurable', reason: '该项暂无计算公式' });
      missing.push({ id: item.id, requires: item.requires || [] });
      continue;
    }

    const EMPTY = { modelId: null, cached: 0, uncached: 0, output: 0, requests: 0, peak: false };
    const safeRun = (md) => {
      try {
        const r = fn(md, bill, ctx);
        if (!r) return null;
        // 兜底：NaN / Infinity 一律当「没算出来」，绝不伪装成 0
        if (Number.isNaN(r.saving) || r.saving === Infinity) {
          return { ...r, status: 'unmeasurable', saving: null, reason: '计算结果无效（缺价格或数据不全），不能当成 0' };
        }
        return r;
      } catch (e) {
        return { status: 'error', saving: null, reason: `计算异常：${e.message}` };
      }
    };

    let result = null;

    if (item.scope === 'global') {
      // 按总账算的项：只跑一次，跑多次会把同一笔钱重复计入
      const md = modelIds.length ? modelData(bill, modelIds[0]) : null;
      result = safeRun(md || EMPTY);
    } else {
      // 按模型算的项：逐个跑并求和，不能只取第一个模型
      let agg = null;
      let firstUnmeasurable = null;
      const perModel = [];
      for (const mid of modelIds) {
        const md = modelData(bill, mid);
        if (!md) continue;
        const r = safeRun(md);
        if (!r) continue;
        if (r.status === 'unmeasurable' || r.status === 'error') {
          // 保留具体原因：为什么算不出来，本身就是交付内容
          if (!firstUnmeasurable) firstUnmeasurable = r;
          continue;
        }
        perModel.push({ model: mid, status: r.status, saving: r.saving, metric: r.metric });
        if (!agg) {
          agg = { ...r };
        } else {
          if (Number.isFinite(r.saving)) agg.saving = (Number.isFinite(agg.saving) ? agg.saving : 0) + r.saving;
          if (Number.isFinite(r.baseline)) agg.baseline = (Number.isFinite(agg.baseline) ? agg.baseline : 0) + r.baseline;
          if (r.status === 'hit') agg.status = 'hit';
        }
      }
      if (agg) {
        agg.saving = Number.isFinite(agg.saving) ? round2(agg.saving) : agg.saving;
        agg.baseline = Number.isFinite(agg.baseline) ? round2(agg.baseline) : agg.baseline;
        if (perModel.length > 1) agg.perModel = perModel;
        result = agg;
      } else if (firstUnmeasurable) {
        result = firstUnmeasurable;
      }
    }

    if (!result) {
      findings.push({
        ...base,
        status: 'unmeasurable',
        saving: null,
        reason: '账单里没有可用于该公式的模型数据',
      });
      missing.push({ id: item.id, requires: item.requires || [] });
      continue;
    }

    findings.push({ ...base, ...result });
  }

  const total = Number(bill?.totalCost) || null;
  const identified = computeIdentifiedTotal(findings, total);

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      currency: bill?.meta?.currency || 'CNY',
      period: bill?.meta?.period || null,
      totalCost: total,
      modelCount: Object.keys(bill?.models || {}).length,
    },
    findings,
    identifiedTotal: identified,
    realizedTotal: null,
    realizedNote: '默认 null —— 没有 A/B 对照就没有已实现节省。填这个数需要前后两期同口径实测。',
    avoidList: AVOID_ITEMS.map((id) => {
      const f = findings.find((x) => x.id === id);
      return { id, name: f?.name, reason: f?.reason };
    }),
    missing,
  };
}

/**
 * 联合反事实合计 —— 纪律核心
 *
 * 规则：
 *   1. 同源项（OVERLAP_GROUPS）取组内最大，不相加
 *   2. evidence 为「厂商宣传」「未核实」的不进合计
 *   3. 合计不超过总成本，也不超过单项最大杠杆 × 项数（防止荒谬值）
 *   4. 合计不是「百分比相加」，是金额层面的保守合并
 */
export function computeIdentifiedTotal(findings, totalCost) {
  const eligible = findings.filter(
    (f) => Number.isFinite(f.saving) && f.saving > 0 && !EXCLUDED_FROM_TOTAL.has(f.evidence)
  );

  const excluded = findings
    .filter((f) => Number.isFinite(f.saving) && f.saving > 0 && EXCLUDED_FROM_TOTAL.has(f.evidence))
    .map((f) => ({ id: f.id, saving: f.saving, evidence: f.evidence }));

  const grouped = new Set();
  let sum = 0;
  const breakdown = [];

  // 先处理重叠组：每组取最大
  for (const group of OVERLAP_GROUPS) {
    const inGroup = eligible.filter((f) => group.includes(f.id));
    if (inGroup.length === 0) continue;
    const max = inGroup.reduce((a, b) => (a.saving >= b.saving ? a : b));
    sum += max.saving;
    breakdown.push({
      kind: 'overlap-group',
      ids: group,
      picked: max.id,
      saving: max.saving,
      note: '同源项，取组内最大，不相加',
    });
    inGroup.forEach((f) => grouped.add(f.id));
  }

  // 再处理独立项
  for (const f of eligible) {
    if (grouped.has(f.id)) continue;
    sum += f.saving;
    breakdown.push({ kind: 'single', ids: [f.id], picked: f.id, saving: f.saving });
  }

  // 上限：不超过总成本
  const capped = Number.isFinite(totalCost) && totalCost > 0 ? Math.min(sum, totalCost) : sum;

  return {
    value: round2(capped),
    rawSum: round2(sum),
    capped: Number.isFinite(totalCost) && sum > totalCost,
    currency: 'same-as-bill',
    method: '联合反事实：同源组取最大 + 独立项相加 + 总额封顶',
    denominator: Number.isFinite(totalCost) ? round2(totalCost) : null,
    pctOfTotal: Number.isFinite(totalCost) && totalCost > 0 ? pct(capped, totalCost) : null,
    breakdown,
    excludedFromTotal: excluded,
    discipline: [
      '百分比不可相加；本合计是金额层面的保守合并',
      '同源项（W3/W11、W2/W10、W9/W16）取组内最大',
      '「厂商宣传」「未核实」的数字已排除，见 excludedFromTotal',
      'identified ≠ realized：这是已识别上限，不是账单数字',
    ],
  };
}

/** 便捷函数：只看该做的项 */
export function actionable(result) {
  return result.findings.filter(
    (f) => f.status === 'hit' && Number.isFinite(f.saving) && f.saving > 0
  );
}
