[中文](README.md) | **English**

# llm-cost-audit

**Turn your LLM bill into a checkable waste report — 18 criteria, real numbers, evidence grades, and an explicit list of what *not* to do.**

[![CI](https://github.com/lapisli/llm-cost-audit/actions/workflows/ci.yml/badge.svg)](https://github.com/lapisli/llm-cost-audit/actions/workflows/ci.yml)
[![tests](https://img.shields.io/badge/tests-97%20passing-brightgreen)]()
[![license](https://img.shields.io/badge/license-MIT-blue)]()

---

## Who this is for

Teams spending more than roughly $70/month on LLM APIs. Consultants who need to deliver a cost audit. Anyone who has read ten "reduce your AI costs" articles and still doesn't know what to change on *their own* bill.

**Not for you** if your bill is a few dollars — the savings won't cover the time you spend reading this.

---

## The problem

Most "AI cost optimization" content stops at the first step: a list of levers — caching, routing, batching, compression — without telling you which ones actually have money on *your* bill, how much, or whether they're worth touching.

| | Most guides | This project |
|---|---|---|
| What you get | A list of levers | Which ones have money on **your** bill |
| How the number is derived | "Save up to 90%" | Joint counterfactual: max within a source group, sum across independent groups, capped at the bill |
| What not to touch | Not mentioned | 4 items explicitly marked "don't do this", with reasons |
| Evidence | None | Five grades: official / paper / third-party measured / vendor claim / unverified |
| Realized savings | "Identified" passed off as realized | `null` — until you run a two-period comparison |

---

## Quick start

Requires Node.js 18+. **Zero dependencies.**

```bash
# npm package not published yet — clone for now
git clone https://github.com/lapisli/llm-cost-audit.git
cd llm-cost-audit

node scripts/estimate.mjs --list                     # the 18 criteria, no bill needed
node scripts/estimate.mjs examples/sample-bill.json  # run on a real self-audit
node scripts/estimate.mjs --list-prices              # 14 models, each with source + date
node scripts/compare.mjs examples/sample-bill.json examples/sample-bill-after.json
npm test                                             # 97 tests
```

Works with bills from OpenAI, Anthropic, LiteLLM, or any CSV:

```bash
node scripts/ingest.mjs usage.json --from openai --out bill.json
```

Unrecognized fields go into `warnings` — **it never guesses a value to fill a gap**.

---

## What you get

```
LLM 成本审计结果              (output text is Chinese; the numbers are not)
════════════════════════════════════════════════════════════
账单期间   2026-10
总成本     ¥751.5
模型数     1

【已识别节省（identified）】
金额合计   ¥28.78
占总额     3.83%

【已实现节省（realized）】
数值       null（未做 A/B 对照）
```

Note the `null`. **It does not hand you a flattering percentage.** That is deliberate — a single bill cannot prove causation, so the tool refuses to pretend it can.

---

## Three things that make it different

**1. It says "don't do this."**

4 of the 18 items are explicitly marked as not worth doing, with reasons. For example: failed/retried requests are usually *not* billed, so reporting 380 retries as savings is dishonest. A report that only ever says "you can save here" has no credibility.

**2. Percentages are never summed.**

"Routing saves 85% + caching saves 90% + batching saves 50%" is the fastest way to get caught by a client. Different denominators, no additive rule, levers that kill each other, and identified ≠ realized. The code uses a joint counterfactual instead.

**3. Every number carries an evidence grade.**

Vendor claims are listed separately and excluded from totals. You can see them; they just don't count as money.

---

## Full documentation

The detailed docs — the 18-item matrix, per-item criteria, pricing tables, report templates, known limitations — are in **[Chinese](README.md)**.

That is the primary language of this project on purpose: the pricing data, the reference library, and the target market are all Chinese. An English translation of 380 lines would be worse than a link.

This README is the signboard. The Chinese one is the manual.

---

## Also an Agent Skill

Installable into any client that supports the skills spec:

```bash
npx skills add lapisli/llm-cost-audit --all
```

Your assistant then loads this workflow when you ask things like "why is my LLM bill so high" or "write me a cost audit report".

---

## License

MIT.
