/**
 * Vision service — classifies item photos using Claude vision.
 *
 * Reads image files via Tauri fs plugin, sends as base64 to Anthropic,
 * returns classification and stores result as a research_event.
 */

import { readFile } from '@tauri-apps/plugin-fs';
import { aiService } from '../../../backend/ai-service/index';
import { insertResearchEvent } from '../db/index';

export interface VisionResult {
    category:       string;
    confidence:     number;
    detected_text:  string[];
    condition_notes: string;
    tags:           string[];
}

const SYSTEM = `You are an expert collectibles appraiser's assistant.
Analyze photos of physical items to identify their type and condition.
Always respond with valid JSON only — no explanation, no markdown.`;

const PROMPT = `Analyze this item photo for a collectibles catalog.

Return a JSON object with exactly these fields:
{
  "category": string (one of: "book", "tool", "record", "magazine", "toy", "clothing", "electronics", "art", "other"),
  "confidence": number between 0 and 1,
  "detected_text": string[] (any text visible — titles, labels, barcodes, ISBNs),
  "condition_notes": string (one sentence describing apparent physical condition),
  "tags": string[] (2-6 descriptive tags)
}`;

export async function classifyPhoto(
    photoPath: string,
    itemId:    string,
): Promise<VisionResult | null> {
    if (!aiService.isConfigured) return null;

    try {
        const bytes    = await readFile(photoPath);
        const base64   = _toBase64(bytes);
        const mimeType = _mimeType(photoPath);

        const result = await aiService.askJson<VisionResult>({
            prompt:      PROMPT,
            systemPrompt: SYSTEM,
            images:      [{ data: base64, mimeType }],
            model:       'claude-haiku-4-5-20251001',
        });

        if (!result) return null;

        // Clamp confidence
        result.confidence = Math.max(0, Math.min(1, result.confidence ?? 0.5));

        // Store as research event
        await insertResearchEvent({
            id:          crypto.randomUUID(),
            item_id:     itemId,
            service:     'vision',
            provider:    'anthropic',
            cmd:         'classify',
            result:      JSON.stringify(result),
            confidence:  result.confidence,
            source:      null,
            approved_at: null,
        });

        return result;
    } catch (err) {
        console.error('[vision] classifyPhoto error:', err);
        return null;
    }
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
