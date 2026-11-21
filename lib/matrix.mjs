/**
 * 18 项浪费矩阵 —— 结构化定义
 *
 * 数据来源：reference/01-waste-matrix.md（2026-10-22 深调研 + 本机自审实测）
 * 本文件只保留「计算器需要判断的字段」，完整判据/幅度/来源见 doc 指向的 reference 文件。
 *
 * 三条纪律（写死在数据结构里，不靠调用方自觉）：
 *   1. kind='unmeasurable' → 永远不出金额，只能出「待核实」
 *   2. kind='indicator-only' → 出指标不出钱（重试次数、输出占比、错峰占比）
 *   3. evidence='厂商宣传' | '未核实' → 不得进入 identifiedTotal
 */

/** 证据等级（只允许这五个词，顺序即可信度从高到低） */
export const EVIDENCE = Object.freeze({
  OFFICIAL: '官方',
  PAPER: '论文',
  THIRD_PARTY: '第三方实测',
  VENDOR: '厂商宣传',
  UNVERIFIED: '未核实',
});

/** 结论档位 */
export const VERDICT = Object.freeze({
  RECOMMEND: 'recommend',      // 建议做
  CONDITIONAL: 'conditional',  // 视情况（需先量）
  AVOID: 'avoid',              // 不建议做
  NA: 'not-applicable',        // 不适用
});

/** 可计算性 */
export const KIND = Object.freeze({
  MEASURABLE: 'measurable',        // 有数据即可算出金额
  UNMEASURABLE: 'unmeasurable',    // 缺数据，只能「待核实」
  INDICATOR_ONLY: 'indicator-only',// 只出指标，不折成钱
});

/**
 * 18 项主表
 *
 * requires: 计算所需的数据字段（ingest 层必须提供，缺则该项判 unmeasurable）
 * formula : lib/estimate.mjs 里的计算公式标识
 * note    : 一句话结论（来自自审实测的例外结论）
 */
export const WASTE_ITEMS = Object.freeze([
  {
    id: 'W1',
    scope: 'per-model', name: '模型超配：低复杂度功能走旗舰模型',
    evidence: EVIDENCE.PAPER, verdict: VERDICT.CONDITIONAL, kind: KIND.MEASURABLE,
    requires: ['modelCostBreakdown', 'shadowEval'],
    formula: 'modelDownshift',
    doc: 'reference/04-routing.md',
    note: '无质量回归证据不建议降档：省成客户的损失不算省',
  },
  {
    id: 'W2',
    scope: 'per-model', name: '固定前缀未缓存',
    evidence: EVIDENCE.OFFICIAL, verdict: VERDICT.CONDITIONAL, kind: KIND.MEASURABLE,
    requires: ['cacheReadTokens', 'billedInputTokens', 'cachePriceRatio'],
    formula: 'cacheHitRate',
    doc: 'reference/09-price-cn.md',
    note: '命中率≈0 才做；已 >90% 不要动（本机实测 96.8% 已在最优区）',
  },
  {
    id: 'W3',
    scope: 'per-model', name: '上下文过长',
    evidence: EVIDENCE.THIRD_PARTY, verdict: VERDICT.RECOMMEND, kind: KIND.MEASURABLE,
    requires: ['totalInputTokens', 'requestCount', 'priceInput'],
    formula: 'contextTrim',
    doc: 'reference/02-compression.md',
    note: '自审判为最大项；极端压缩有质量代价，须小样本验证',
  },
  {
    id: 'W4',
    scope: 'per-model', name: '输出无上限',
    evidence: EVIDENCE.UNVERIFIED, verdict: VERDICT.CONDITIONAL, kind: KIND.INDICATOR_ONLY,
    requires: ['outputTokens', 'inputTokens', 'priceOutput'],
    formula: null,
    doc: 'templates/report-template.md',
    note: '出指标不出钱：无证据表明输出里有浪费，推理链属必要产出',
  },
  {
    id: 'W5',
    scope: 'global', name: '失败与重试浪费',
    evidence: EVIDENCE.UNVERIFIED, verdict: VERDICT.AVOID, kind: KIND.INDICATOR_ONLY,
    requires: ['retryCount', 'errorBreakdown'],
    formula: null,
    doc: 'templates/report-template.md',
    note: '429 通常不计费，报成节省就是忽悠；它的价值是「配额被打满」这个症状',
  },
  {
    id: 'W6',
    scope: 'global', name: '可批处理却走同步',
    evidence: EVIDENCE.OFFICIAL, verdict: VERDICT.RECOMMEND, kind: KIND.MEASURABLE,
    requires: ['offlineTaskCost', 'batchDiscount', 'stateDependency'],
    formula: 'batchRouting',
    doc: 'reference/05-batch.md',
    note: '仅限离线任务；有状态依赖（第 N 条用第 N-1 条输出）不适用',
  },
  {
    id: 'W7',
    scope: 'global', name: '环境未分离',
    evidence: EVIDENCE.UNVERIFIED, verdict: VERDICT.RECOMMEND, kind: KIND.MEASURABLE,
    requires: ['untaggedCostRatio', 'totalCost'],
    formula: 'envSeparation',
    doc: 'reference/13-methodology.md',
    note: '金额不大，但它带来可见性，是后面所有优化的前提',
  },
  {
    id: 'W8',
    scope: 'global', name: '重复嵌入 / 重复注入',
    evidence: EVIDENCE.UNVERIFIED, verdict: VERDICT.CONDITIONAL, kind: KIND.MEASURABLE,
    requires: ['embeddingCost', 'dedupRatio', 'totalCost'],
    formula: 'dedupEmbedding',
    doc: 'templates/report-template.md',
    note: '先量嵌入占总成本比例；占比小就不划算',
  },
  {
    id: 'W9',
    scope: 'global', name: 'Agent 循环失控与隐藏调用',
    evidence: EVIDENCE.OFFICIAL, verdict: VERDICT.RECOMMEND, kind: KIND.MEASURABLE,
    requires: ['callsPerRequest', 'hiddenCallCount', 'hiddenCallUnitPrice'],
    formula: 'hiddenCalls',
    doc: 'reference/06-agent-token.md',
    note: '官方量级 agent≈4× chat、多智能体≈15× chat',
  },
  {
    id: 'W10',
    scope: 'per-model', name: '超长 preamble / 重复工具定义',
    evidence: EVIDENCE.UNVERIFIED, verdict: VERDICT.CONDITIONAL, kind: KIND.MEASURABLE,
    requires: ['preambleChars', 'requestCount', 'priceCacheRead'],
    formula: 'preambleCost',
    doc: 'reference/06-agent-token.md',
    note: '单次折算可能不到 ¥1，不值得为省钱大动；但要盯注入机制膨胀',
  },
  {
    id: 'W11',
    scope: 'per-model', name: '上下文膨胀',
    evidence: EVIDENCE.THIRD_PARTY, verdict: VERDICT.RECOMMEND, kind: KIND.MEASURABLE,
    requires: ['avgContextTokens', 'callsPerTask', 'priceInput'],
    formula: 'contextInflation',
    doc: 'reference/06-agent-token.md',
    note: '与 W3 同源；根因是机器产生的内容（实测 85.7%），不是用户说的话',
  },
  {
    id: 'W12',
    scope: 'global', name: '语义缓存未启用',
    evidence: EVIDENCE.PAPER, verdict: VERDICT.CONDITIONAL, kind: KIND.MEASURABLE,
    requires: ['customerDupRate', 'totalCost'],
    formula: 'semanticCache',
    doc: 'reference/03-semantic-cache.md',
    note: '绝对命中率无权威公开数；厂商 70% 不得换算成客户的钱',
  },
  {
    id: 'W13',
    scope: 'global', name: '供应商价差 / 中转站套利',
    evidence: EVIDENCE.UNVERIFIED, verdict: VERDICT.AVOID, kind: KIND.UNMEASURABLE,
    requires: ['realtimePriceSpread'],
    formula: null,
    doc: 'reference/01-waste-matrix.md',
    note: '无可引用的实时价差表；中转站有合规风险，不适合作承重点',
  },
  {
    id: 'W14',
    scope: 'global', name: '自托管替代 API',
    evidence: EVIDENCE.THIRD_PARTY, verdict: VERDICT.AVOID, kind: KIND.MEASURABLE,
    requires: ['gpuHourlyPrice', 'utilization', 'apiEffectivePrice'],
    formula: 'selfHostBreakEven',
    doc: 'reference/08-selfhost.md',
    note: '利用率 7% 与 API 打平、5% 比 API 贵；break-even 算错是交付者责任',
  },
  {
    id: 'W15',
    scope: 'global', name: '微调 / 蒸馏',
    evidence: EVIDENCE.UNVERIFIED, verdict: VERDICT.AVOID, kind: KIND.UNMEASURABLE,
    requires: ['trainingData', 'evalSet', 'gpuCost', 'labelCost'],
    formula: null,
    doc: 'templates/report-template.md',
    note: '要碰客户训练数据与评测集，交付风险与报价量级不匹配',
  },
  {
    id: 'W16',
    scope: 'global', name: '多智能体放大',
    evidence: EVIDENCE.OFFICIAL, verdict: VERDICT.CONDITIONAL, kind: KIND.MEASURABLE,
    requires: ['subagentCalls', 'subagentContext', 'singleAgentBaseline'],
    formula: 'multiAgent',
    doc: 'reference/06-agent-token.md',
    note: '判断标准不是能不能拆，而是任务价值撑不撑得住 15×',
  },
  {
    id: 'W17',
    scope: 'global', name: '无成本归因 / 无标签 / 无预算告警',
    evidence: EVIDENCE.UNVERIFIED, verdict: VERDICT.RECOMMEND, kind: KIND.MEASURABLE,
    requires: ['tagCoverage', 'totalCost'],
    formula: 'attribution',
    doc: 'reference/07-tooling.md',
    note: '使能项非直接节省；无标签时后续每一项的深度都受限',
  },
  {
    id: 'W18',
    scope: 'global', name: '错峰调度未做',
    evidence: EVIDENCE.OFFICIAL, verdict: VERDICT.CONDITIONAL, kind: KIND.MEASURABLE,
    requires: ['peakTokenRatio', 'offPeakDiscount', 'hourlyUsage'],
    formula: 'offPeakShift',
    doc: 'reference/09-price-cn.md',
    note: '本机实测高峰仅 18.1%，杠杆已被占满；换客户要先量再说话',
  },
]);

/** 六类杠杆 —— 百分比不可相加（纪律条款） */
export const LEVERS = Object.freeze([
  { id: 'routing', name: '模型路由' },
  { id: 'semanticCache', name: '语义缓存' },
  { id: 'promptCache', name: '提示词缓存' },
  { id: 'compression', name: '提示词压缩' },
  { id: 'batch', name: '批处理' },
  { id: 'arbitrage', name: '供应商套利' },
  { id: 'offPeak', name: '错峰调度' },
  { id: 'structure', name: '结构杠杆（输出砍半 / 上下文剪枝）' },
]);

/** 明确不建议做的 4 项（报告里必须单独列出，这是差异化所在） */
export const AVOID_ITEMS = Object.freeze(['W5', 'W13', 'W14', 'W15']);

export function getItem(id) {
  return WASTE_ITEMS.find((x) => x.id === id) || null;
}

export function byVerdict(verdict) {
  return WASTE_ITEMS.filter((x) => x.verdict === verdict);
}
