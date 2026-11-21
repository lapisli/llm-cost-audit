/**
 * render-html.mjs —— 把 estimate() 的结果渲染成自包含 HTML 报告
 *
 * 为什么要有这个：
 *   客户和大多数非工程用户不装 Markdown 阅读器。一份双击就能打开、
 *   能直接打印成 PDF 的报告，比一堆 .md 有用得多。
 *
 * 设计约束：
 *   - 自包含：没有 CDN、没有外链字体、没有 JS 依赖，断网也能看
 *   - 打印友好：@media print 下隐藏交互元素、保留颜色
 *   - 所有用户数据都经过 escape，账单里的模型名不会变成标签
 */

const STATUS_LABEL = {
  hit: '命中',
  miss: '未命中',
  unmeasurable: '待核实',
  indicator: '指标',
  avoid: '不建议',
  error: '异常',
};

const STATUS_CLASS = {
  hit: 's-hit',
  miss: 's-miss',
  unmeasurable: 's-na',
  indicator: 's-ind',
  avoid: 's-avoid',
  error: 's-err',
};

/** 计算所需的内部字段名 → 给客户看的中文 */
const FIELD_LABEL = {
  modelCostBreakdown: '分模型成本明细',
  shadowEval: '影子评测结果',
  cacheReadTokens: '缓存命中 token 数',
  billedInputTokens: '计费输入 token 数',
  cachePriceRatio: '缓存价倍率',
  totalInputTokens: '总输入 token 数',
  requestCount: '请求次数',
  priceInput: '输入单价',
  outputTokens: '输出 token 数',
  inputTokens: '输入 token 数',
  priceOutput: '输出单价',
  retryCount: '重试次数',
  errorBreakdown: '错误码分布',
  offlineTaskCost: '离线任务成本',
  batchDiscount: '批处理折扣',
  stateDependency: '任务间状态依赖',
  untaggedCostRatio: '无标签成本占比',
  totalCost: '总成本',
  embeddingCost: '嵌入成本',
  dedupRatio: '内容去重率',
  callsPerRequest: '单次请求调用数',
  hiddenCallCount: '隐藏调用次数',
  hiddenCallUnitPrice: '隐藏调用单价',
  preambleChars: '系统提示字符数',
  priceCacheRead: '缓存读取单价',
  avgContextTokens: '平均上下文 token 数',
  callsPerTask: '单任务调用次数',
  customerDupRate: '客户重复提问率',
  realtimePriceSpread: '实时价差表',
  gpuHourlyPrice: 'GPU 时价',
  utilization: '利用率',
  apiEffectivePrice: 'API 有效单价',
  trainingData: '训练数据',
  evalSet: '评测集',
  gpuCost: 'GPU 成本',
  labelCost: '标注成本',
  subagentCalls: '子代理调用次数',
  subagentContext: '子代理上下文长度',
  singleAgentBaseline: '单智能体基线',
  tagCoverage: '标签覆盖率',
  peakTokenRatio: '高峰时段 token 占比',
  offPeakDiscount: '错峰折扣',
  hourlyUsage: '分时用量',
};

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function money(v, currency) {
  if (!Number.isFinite(v)) return '—';
  const sym = currency === 'USD' ? '$' : '¥';
  return sym + v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct(v) {
  return Number.isFinite(v) ? v.toFixed(2) + '%' : '—';
}

const CSS = `
:root{
  --ink:#14181f; --ink-2:#4a5462; --ink-3:#7d8794;
  --line:#e3e7ec; --bg:#fff; --bg-2:#f7f9fb;
  --accent:#1f5eff; --accent-bg:#eef3ff;
  --ok:#0a7d4f; --ok-bg:#e8f6ef;
  --warn:#a86400; --warn-bg:#fdf4e3;
  --stop:#b02a37; --stop-bg:#fdecee;
}
*{box-sizing:border-box}
body{
  margin:0; padding:0; background:var(--bg-2); color:var(--ink);
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",
    "Hiragino Sans GB","Microsoft YaHei","Source Han Sans SC",sans-serif;
  font-size:15px; line-height:1.7;
  -webkit-font-smoothing:antialiased;
}
main{
  max-width:1080px; margin:0 auto; padding:48px 40px 64px;
  background:var(--bg); min-height:100vh;
}
header{border-bottom:2px solid var(--ink); padding-bottom:20px; margin-bottom:32px}
h1{margin:0 0 6px; font-size:28px; letter-spacing:-.02em; font-weight:700}
.sub{margin:0; color:var(--ink-3); font-size:14px}
h2{font-size:17px; margin:40px 0 14px; padding-bottom:8px; border-bottom:1px solid var(--line); font-weight:600}
h2:first-of-type{margin-top:32px}

.kpis{display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin:28px 0 8px}
.kpi{border:1px solid var(--line); border-radius:10px; padding:16px 18px; background:var(--bg)}
.kpi span{display:block; font-size:12px; color:var(--ink-3); letter-spacing:.04em; margin-bottom:6px}
.kpi strong{display:block; font-size:26px; font-weight:700; letter-spacing:-.02em; font-variant-numeric:tabular-nums}
.kpi em{display:block; font-style:normal; font-size:12px; color:var(--ink-3); margin-top:4px}
.kpi.accent{background:var(--accent-bg); border-color:#c9daff}
.kpi.accent strong{color:var(--accent)}
.kpi.muted strong{color:var(--ink-3); font-size:22px}

table{width:100%; border-collapse:collapse; font-size:13.5px; margin:8px 0 4px}
th{
  text-align:left; font-weight:600; font-size:12px; color:var(--ink-2);
  letter-spacing:.03em; padding:9px 10px; border-bottom:1.5px solid var(--ink);
  white-space:nowrap;
}
td{padding:9px 10px; border-bottom:1px solid var(--line); vertical-align:top}
tbody tr:nth-child(even){background:var(--bg-2)}
td.num{text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap}
td.id{font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:12.5px; color:var(--ink-3)}
.tag{
  display:inline-block; padding:1px 7px; border-radius:4px; font-size:11.5px;
  font-weight:600; white-space:nowrap;
}
.s-hit{background:var(--ok-bg); color:var(--ok)}
.s-miss{background:var(--warn-bg); color:var(--warn)}
.s-na{background:#eef0f3; color:var(--ink-3)}
.s-ind{background:#eef0f3; color:var(--ink-2)}
.s-avoid{background:var(--stop-bg); color:var(--stop)}
.s-err{background:var(--stop-bg); color:var(--stop)}

.note{color:var(--ink-2); font-size:12.5px; line-height:1.55}

.avoid-box{border-left:3px solid var(--stop); background:var(--stop-bg); padding:4px 0 4px 18px; margin:12px 0}
.avoid-box li{margin:10px 0}
.avoid-box b{color:var(--stop)}

.discipline{background:var(--bg-2); border:1px solid var(--line); border-radius:10px; padding:18px 22px; margin:16px 0}
.discipline ol{margin:8px 0 0; padding-left:20px}
.discipline li{margin:8px 0; font-size:13.5px}

.method{font-size:12.5px; color:var(--ink-2); background:var(--bg-2); border-radius:8px; padding:12px 16px; margin:12px 0}
footer{margin-top:48px; padding-top:18px; border-top:1px solid var(--line); font-size:12px; color:var(--ink-3)}

@media print{
  body{background:#fff}
  main{max-width:none; padding:0}
  h2{page-break-after:avoid}
  table{page-break-inside:auto}
  tr{page-break-inside:avoid}
  .kpis{page-break-inside:avoid}
}
`;

/**
 * @param {object} result estimate() 的返回值
 * @param {object} [opts]
 * @param {string} [opts.title] 报告标题
 * @param {string} [opts.client] 客户名（可选）
 * @returns {string} 完整 HTML 文档
 */
export function renderHtml(result, opts = {}) {
  const { meta = {}, findings = [], identifiedTotal = {}, avoidList = [], missing = [] } = result;
  const cur = meta.currency || 'CNY';
  const title = opts.title || 'LLM 成本审计 · 节省测算';

  const kpiRows = [
    ['总成本', money(meta.totalCost, cur), meta.period ? `账单期间 ${esc(meta.period)}` : '账单期间未标注', ''],
    [
      '已识别节省',
      money(identifiedTotal.value, cur),
      `占总额 ${pct(identifiedTotal.pctOfTotal)}`,
      'accent',
    ],
    ['已实现节省', 'null', '未做 A/B 对照，不给数', 'muted'],
  ];

  const kpis = kpiRows
    .map(
      ([label, value, sub, cls]) => `
    <div class="kpi ${cls}">
      <span>${label}</span>
      <strong>${value}</strong>
      <em>${sub}</em>
    </div>`
    )
    .join('');

  const rows = findings
    .map((f) => {
      const cls = STATUS_CLASS[f.status] || 's-na';
      return `
      <tr>
        <td class="id">${esc(f.id)}</td>
        <td>${esc(f.name)}</td>
        <td><span class="tag ${cls}">${esc(STATUS_LABEL[f.status] || f.status)}</span></td>
        <td class="num">${Number.isFinite(f.saving) ? money(f.saving, cur) : '—'}</td>
        <td class="note">${esc(f.evidence)}</td>
        <td class="note">${esc(f.reason || f.note || '')}</td>
      </tr>`;
    })
    .join('');

  const avoid = avoidList.length
    ? `<ul class="avoid-box">
    ${avoidList.map((a) => `<li><b>${esc(a.id)} ${esc(a.name)}</b>：${esc(a.reason)}</li>`).join('\n    ')}
  </ul>`
    : '<p class="note">无。</p>';

  const missingBlock = missing.length
    ? `<div class="method"><b>缺这些数据，相关项只能判「待核实」：</b>
    <ul>${missing
      .map((m) => {
        const fields = (m.requires || []).map((f) => FIELD_LABEL[f] || f).join('、');
        return `<li><b>${esc(m.id)}</b>：${esc(fields)}</li>`;
      })
      .join('\n      ')}</ul></div>`
    : '';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>${CSS}</style>
</head>
<body>
<main>
  <header>
    <h1>${esc(title)}</h1>
    <p class="sub">${opts.client ? esc(opts.client) + ' · ' : ''}18 项浪费矩阵 · 逐项折算 · 证据分级</p>
  </header>

  <section class="kpis">${kpis}
  </section>

  <h2>18 项浪费矩阵</h2>
  <table>
    <thead>
      <tr><th>编号</th><th>浪费项</th><th>状态</th><th>金额</th><th>证据</th><th>说明</th></tr>
    </thead>
    <tbody>${rows}
    </tbody>
  </table>

  <h2>不建议做</h2>
  ${avoid}

  <h2>计算纪律</h2>
  <div class="discipline">
    <ol>
      <li><b>百分比不可相加。</b>六个杠杆作用在同一个 token 上，各自 30% 加起来不是 180%。这里只报联合反事实下的一个数。</li>
      <li><b>已实现 ≠ 已识别。</b>没做 A/B 对照之前，「已实现节省」永远是 null，不是估算值。</li>
      <li><b>证据不足的钱不进合计。</b>「厂商宣传」和「未核实」的项只做提示，不计入总额。</li>
    </ol>
  </div>

  <div class="method">${esc(identifiedTotal.method || '')}</div>
  ${missingBlock}

  <footer>
    由 llm-cost-audit 生成 · ${new Date().toISOString().slice(0, 10)}<br>
    本报告只做测算，不承诺结果。落地后的实际节省须以 A/B 对照为准。
  </footer>
</main>
</body>
</html>`;
}

export default renderHtml;
