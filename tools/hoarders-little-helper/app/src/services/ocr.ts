/**
 * OCR service — extracts structured text from item photos.
 *
 * Looks for ISBNs, UPCs, titles, dates, publisher labels, condition stamps.
 * Results stored as research_events for human review + field approval.
 */

import { readFile } from '@tauri-apps/plugin-fs';
import { aiService } from '../../../backend/ai-service/index';
import { insertResearchEvent } from '../db/index';

export interface OcrResult {
    isbn:       string | null;
    upc:        string | null;
    title:      string | null;
    author:     string | null;
    year:       number | null;
    publisher:  string | null;
    edition:    string | null;
    condition:  string | null;   // if a condition grade is stamped/written
    other_text: string[];
}

const SYSTEM = `You are a cataloging assistant specializing in identifying collectibles from photos.
Extract any structured data visible in the image.
Always respond with valid JSON only — no explanation, no markdown.`;

const PROMPT = `Extract any text from this photo that would help identify a collectible item.

Look carefully for: ISBN-10 or ISBN-13 (often on back cover), UPC barcodes,
title text, author names, publication year, publisher name, edition info,
condition stamps or grades (e.g. "VG+", "Fine", "G"), price stickers.

Return a JSON object with exactly these fields:
{
  "isbn":       string | null  (digits only, no dashes),
  "upc":        string | null  (digits only),
  "title":      string | null,
  "author":     string | null,
  "year":       number | null  (4-digit year only),
  "publisher":  string | null,
  "edition":    string | null  (e.g. "First Edition", "3rd printing"),
  "condition":  string | null  (standardized: "poor"|"fair"|"good"|"vg"|"fine"|"mint" or null),
  "other_text": string[]       (any other notable text, max 5 items)
}`;

export async function extractText(
    photoPath: string,
    itemId:    string,
): Promise<OcrResult | null> {
    if (!aiService.isConfigured) return null;

    try {
        const bytes    = await readFile(photoPath);
        const base64   = _toBase64(bytes);
        const mimeType = _mimeType(photoPath);

        const result = await aiService.askJson<OcrResult>({
            prompt:      PROMPT,
            systemPrompt: SYSTEM,
            images:      [{ data: base64, mimeType }],
            model:       'claude-haiku-4-5-20251001',
        });

        if (!result) return null;

        // Normalize ISBN — strip non-digits, validate length
        if (result.isbn) {
            const digits = result.isbn.replace(/\D/g, '');
            result.isbn  = (digits.length === 10 || digits.length === 13) ? digits : null;
        }

        // Store as research event only if we got something useful
        const hasData = result.isbn || result.title || result.author || result.year;
        if (hasData) {
            await insertResearchEvent({
                id:          crypto.randomUUID(),
                item_id:     itemId,
                service:     'ocr',
                provider:    'anthropic',
                cmd:         'extract',
                result:      JSON.stringify(result),
                confidence:  _confidence(result),
                source:      null,
                approved_at: null,
            });
        }

        return result;
    } catch (err) {
        console.error('[ocr] extractText error:', err);
        return null;
    }
}

/** Rough confidence score based on how much structured data was found. */
function _confidence(r: OcrResult): number {
    let score = 0;
    if (r.isbn)      score += 0.35;
    if (r.title)     score += 0.25;
    if (r.author)    score += 0.15;
    if (r.year)      score += 0.10;
    if (r.publisher) score += 0.05;
    if (r.upc)       score += 0.10;
    return Math.min(1, score);
}

function _toBase64(bytes: Uint8Array): string {
    let binary = '';
    const chunk = 8192;
    for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
}

function _mimeType(path: string): 'image/jpeg' | 'image/png' | 'image/webp' {
    const ext = path.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'png')  return 'image/png';
    if (ext === 'webp') return 'image/webp';
    return 'image/jpeg';
}
