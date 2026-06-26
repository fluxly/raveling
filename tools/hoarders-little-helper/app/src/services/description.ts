/**
 * Description service — generates listing copy for a cataloged item.
 *
 * Uses Claude sonnet to produce multiple description formats in one pass:
 *   - short_title:          60–80 chars, clean title-case
 *   - long_title:           100–150 chars, fully descriptive
 *   - description:          150–300 words, factual + appealing prose
 *   - seo_summary:          140–160 chars, one searchable sentence
 *   - condition_notes:      1–2 sentences on physical state
 *   - marketplace_title:    ≤80 chars, keyword-rich for eBay/Etsy
 *   - abebooks_description: bibliographic style for book dealers
 *
 * Results stored as a research_event (cmd='describe') so they appear
 * in the quiddity panel and research log.
 */

import { aiService }            from '../../../backend/ai-service/index';
import { insertResearchEvent, listResearchEventsForItem, type ResearchEventRow, type ItemRow } from '../db/index';

export interface DescriptionResult {
    short_title:           string;
    long_title:            string;
    description:           string;
    seo_summary:           string;
    condition_notes:       string;
    marketplace_title:     string;
    abebooks_description:  string;
}

const SYSTEM = `You are an expert collectibles cataloger and copywriter with deep knowledge of
book dealing, antiques, vintage tools, and rare items. Write accurate, appealing, factual descriptions.
Never exaggerate condition or rarity. Respond with valid JSON only — no markdown, no explanation.`;

export async function generateDescriptions(
    item: ItemRow,
    itemId: string,
): Promise<DescriptionResult | null> {
    if (!aiService.isConfigured) return null;

    // ── Build context from research events ────────────────────────────────────
    const events    = await listResearchEventsForItem(itemId);
    const context   = _buildContext(item, events);
    const prompt    = _buildPrompt(context);

    const result = await aiService.askJson<DescriptionResult>({
        prompt,
        systemPrompt: SYSTEM,
        model:        'claude-sonnet-4-6',
    });

    if (!result) return null;

    // Store as research event
    await insertResearchEvent({
        id:          crypto.randomUUID(),
        item_id:     itemId,
        service:     'description',
        provider:    'anthropic',
        cmd:         'describe',
        result:      JSON.stringify(result),
        confidence:  _confidenceFromContext(events),
        source:      null,
        approved_at: null,
    });

    return result;
}

/** Load the most recent description for an item, if any. */
export async function loadDescription(itemId: string): Promise<DescriptionResult | null> {
    const events = await listResearchEventsForItem(itemId);
    const latest = events.find(e => e.cmd === 'describe' && e.result);
    if (!latest) return null;
    try { return JSON.parse(latest.result!) as DescriptionResult; } catch { return null; }
}

// ── Context builder ────────────────────────────────────────────────────────────

interface DescriptionContext {
    item:        ItemRow;
    wecMatch?:   { qid: string; explanation: string; confidence: number };
    ocrData?:    { isbn?: string; publisher?: string; edition?: string };
    visionData?: { category?: string; condition_notes?: string; tags?: string[] };
    tags:        string[];
}

function _buildContext(item: ItemRow, events: ResearchEventRow[]): DescriptionContext {
    const ctx: DescriptionContext = { item, tags: [] };

    for (const ev of events) {
        if (!ev.result) continue;
        try {
            const data = JSON.parse(ev.result);
            if (ev.cmd === 'match' && data.matches?.[0] && data.matches[0].confidence > 0.5) {
                ctx.wecMatch = {
                    qid:         data.matches[0].qid,
                    explanation: data.matches[0].explanation,
                    confidence:  data.matches[0].confidence,
                };
            }
            if (ev.cmd === 'extract') {
                ctx.ocrData = {
                    isbn:      data.isbn      ?? undefined,
                    publisher: data.publisher ?? undefined,
                    edition:   data.edition   ?? undefined,
                };
            }
            if (ev.cmd === 'classify') {
                ctx.visionData = {
                    category:       data.category       ?? undefined,
                    condition_notes: data.condition_notes ?? undefined,
                    tags:           data.tags           ?? [],
                };
                if (Array.isArray(data.tags)) ctx.tags.push(...data.tags);
            }
        } catch { /* skip malformed */ }
    }

    return ctx;
}

function _buildPrompt(ctx: DescriptionContext): string {
    const { item, wecMatch, ocrData, visionData } = ctx;
    const lines: string[] = ['Generate catalog descriptions for this collectible item.', ''];

    lines.push('## Item Data');
    if (item.title)     lines.push(`Title: ${item.title}`);
    if (item.brand)     lines.push(`Brand/Maker: ${item.brand}`);
    if (item.author)    lines.push(`Author: ${item.author}`);
    if (item.publisher) lines.push(`Publisher: ${item.publisher}`);
    if (item.category)  lines.push(`Category: ${item.category}`);
    if (item.year)      lines.push(`Year: ${item.year}`);
    if (item.condition) lines.push(`Condition grade: ${item.condition}`);
    if (item.materials) lines.push(`Materials: ${item.materials}`);
    if (item.dimensions) lines.push(`Dimensions: ${item.dimensions}`);
    if (item.notes)     lines.push(`Seller notes: ${item.notes}`);

    if (ocrData) {
        lines.push('');
        lines.push('## OCR Data (from photo)');
        if (ocrData.isbn)      lines.push(`ISBN: ${ocrData.isbn}`);
        if (ocrData.publisher) lines.push(`Publisher (OCR): ${ocrData.publisher}`);
        if (ocrData.edition)   lines.push(`Edition: ${ocrData.edition}`);
    }

    if (visionData?.condition_notes) {
        lines.push('');
        lines.push('## Visual Condition (AI photo analysis)');
        lines.push(visionData.condition_notes);
    }

    if (wecMatch) {
        lines.push('');
        lines.push('## Provenance');
        lines.push(`This item appears in the Whole Earth Catalog (${wecMatch.qid}).`);
        lines.push(wecMatch.explanation);
    }

    lines.push('');
    lines.push('## Required Output (JSON)');
    lines.push(`Return a JSON object with exactly these fields:
{
  "short_title":          string (60–80 chars, title-case, no "Vintage" filler),
  "long_title":           string (100–150 chars, includes author/year/edition if relevant),
  "description":          string (150–300 words, 2–3 paragraphs, factual + appealing),
  "seo_summary":          string (140–160 chars, keyword-rich, one sentence),
  "condition_notes":      string (1–2 sentences, specific about the physical state),
  "marketplace_title":    string (≤80 chars, keyword-optimized for eBay/Etsy search),
  "abebooks_description": string (bibliographic style, cite edition/ISBN/publisher, professional tone)
}`);

    return lines.join('\n');
}

function _confidenceFromContext(events: ResearchEventRow[]): number {
    const hasWec   = events.some(e => e.cmd === 'match' && (e.confidence ?? 0) > 0.5);
    const hasOcr   = events.some(e => e.cmd === 'extract' && e.result);
    const hasVision = events.some(e => e.cmd === 'classify');
    let score = 0.4;
    if (hasWec)    score += 0.3;
    if (hasOcr)    score += 0.2;
    if (hasVision) score += 0.1;
    return Math.min(1, score);
}
