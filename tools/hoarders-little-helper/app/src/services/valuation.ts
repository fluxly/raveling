/**
 * Valuation service — aggregates price estimates from Q-Thread evidence
 * and (optionally, user-triggered) from Claude AI.
 *
 * Q-Thread runMatch() already stores valueEstimate inside each 'match' event.
 * This service reads those events, merges estimates from multiple threads,
 * and provides an AI research path using Claude sonnet.
 */

import { aiService }            from '../../../backend/ai-service/index';
import {
    listResearchEventsForItem, insertResearchEvent,
    type ResearchEventRow, type ItemRow,
} from '../db/index';
import type { ThreadEvidence }  from './qthread-registry';

export interface ValuationSource {
    threadId:    string;
    confidence:  number;
    low:         number;
    expected:    number;
    optimistic:  number;
    basis:       string;
}

export interface ValuationResult {
    low:        number;   // USD cents
    expected:   number;
    optimistic: number;
    currency:   string;
    basis:      string;
    sources:    ValuationSource[];
    aiEstimate: boolean;  // true if Claude produced this result
}

// ── Load valuation from existing research events ───────────────────────────────

export async function loadValuation(itemId: string): Promise<ValuationResult | null> {
    const events = await listResearchEventsForItem(itemId);

    // Prefer dedicated AI valuation event if present
    const aiEvent = [...events].reverse().find(e => e.cmd === 'value' && e.service === 'ai');
    if (aiEvent?.result) {
        try { return JSON.parse(aiEvent.result) as ValuationResult; } catch { /* fall through */ }
    }

    // Otherwise merge Q-Thread estimates from match events
    return _mergeFromMatchEvents(events);
}

function _mergeFromMatchEvents(events: ResearchEventRow[]): ValuationResult | null {
    const sources: ValuationSource[] = [];

    for (const ev of events) {
        if (ev.cmd !== 'match' || !ev.result) continue;
        try {
            const evidence = JSON.parse(ev.result) as ThreadEvidence;
            if (!evidence.valueEstimate) continue;
            const { low, expected, optimistic, currency: _c, basis } = evidence.valueEstimate;
            sources.push({
                threadId:   evidence.threadId,
                confidence: ev.confidence ?? 0.5,
                low:        _toCents(low),
                expected:   _toCents(expected),
                optimistic: _toCents(optimistic),
                basis,
            });
        } catch { /* skip malformed */ }
    }

    if (sources.length === 0) return null;

    // Weighted average by confidence
    const totalWeight = sources.reduce((s, src) => s + src.confidence, 0);
    const wAvg = (key: 'low' | 'expected' | 'optimistic'): number =>
        Math.round(sources.reduce((s, src) => s + src[key] * src.confidence, 0) / totalWeight);

    return {
        low:        wAvg('low'),
        expected:   wAvg('expected'),
        optimistic: wAvg('optimistic'),
        currency:   'USD',
        basis:      sources.map(s => s.basis).join(' '),
        sources,
        aiEstimate: false,
    };
}

// ── Claude AI valuation ────────────────────────────────────────────────────────

const SYSTEM = `You are an experienced rare-book dealer and collectibles appraiser.
Provide honest, conservative market valuations based on current collector demand.
Respond with valid JSON only — no markdown, no explanation.`;

export async function askClaudeValuation(
    item: ItemRow,
    itemId: string,
    existingEstimate: ValuationResult | null,
): Promise<ValuationResult | null> {
    if (!aiService.isConfigured) return null;

    const prompt = _buildPrompt(item, existingEstimate);
    const raw    = await aiService.askJson<{
        low: number; expected: number; optimistic: number; basis: string;
    }>({ prompt, systemPrompt: SYSTEM, model: 'claude-sonnet-4-6' });

    if (!raw) return null;

    const result: ValuationResult = {
        low:        _toCents(raw.low),
        expected:   _toCents(raw.expected),
        optimistic: _toCents(raw.optimistic),
        currency:   'USD',
        basis:      raw.basis ?? '',
        sources:    existingEstimate?.sources ?? [],
        aiEstimate: true,
    };

    await insertResearchEvent({
        id:          crypto.randomUUID(),
        item_id:     itemId,
        service:     'ai',
        provider:    'anthropic',
        cmd:         'value',
        result:      JSON.stringify(result),
        confidence:  0.65,
        source:      null,
        approved_at: null,
    });

    return result;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function _toCents(dollars: number): number {
    if (!dollars || isNaN(dollars)) return 0;
    // If the number is already large (>500), assume it's already in cents
    // (Q-Thread heuristics store in dollars, AI returns in dollars)
    return dollars < 500 ? Math.round(dollars * 100) : Math.round(dollars);
}

function _buildPrompt(item: ItemRow, existing: ValuationResult | null): string {
    const lines: string[] = ['Estimate the resale value of this collectible item on the secondary market.', ''];
    lines.push('## Item');
    if (item.title)     lines.push(`Title: ${item.title}`);
    if (item.author)    lines.push(`Author: ${item.author}`);
    if (item.publisher) lines.push(`Publisher: ${item.publisher}`);
    if (item.year)      lines.push(`Year: ${item.year}`);
    if (item.category)  lines.push(`Category: ${item.category}`);
    if (item.condition) lines.push(`Condition: ${item.condition}`);
    if (item.notes)     lines.push(`Notes: ${item.notes}`);

    if (existing) {
        const fmt = (c: number) => `$${(c / 100).toFixed(0)}`;
        lines.push('');
        lines.push('## Q-Thread estimate for reference');
        lines.push(`Low: ${fmt(existing.low)}, Expected: ${fmt(existing.expected)}, Optimistic: ${fmt(existing.optimistic)}`);
        lines.push(existing.basis);
    }

    lines.push('');
    lines.push('## Required JSON output');
    lines.push(`{
  "low":        number (USD dollars, conservative floor — items in poor condition),
  "expected":   number (USD dollars, typical collector market price for stated condition),
  "optimistic": number (USD dollars, best realistic case — ideal buyer, great listing),
  "basis":      string (1-2 sentences explaining your reasoning and market sources)
}`);

    return lines.join('\n');
}
