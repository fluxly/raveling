/**
 * AIService — provider abstraction with SQLite response cache.
 *
 * Single shared instance. Call `AIService.get()` after `initDb()`.
 * Call `setApiKey(key)` before making requests (or configure via Settings).
 *
 * All responses are cached keyed by (provider, model, SHA-256 of prompt).
 * Cache is permanent — useful for expensive PDF import runs.
 */

import { AnthropicClient } from './providers/anthropic';
import { getAiCache, setAiCache, getSetting } from '../../app/src/db/index';

export type AiModel =
    | 'claude-haiku-4-5-20251001'    // fast + cheap — OCR, classification
    | 'claude-sonnet-4-6';           // nuanced — PDF import, explanations

const DEFAULT_MODEL: AiModel = 'claude-haiku-4-5-20251001';

export interface AiRequest {
    prompt:      string;
    systemPrompt?: string;
    images?:     { data: string; mimeType: 'image/jpeg' | 'image/png' | 'image/webp' }[];
    model?:      AiModel;
    noCache?:    boolean;
}

export class AIService {
    private static _instance: AIService | null = null;
    private _apiKey: string | null = null;

    static get(): AIService {
        if (!AIService._instance) AIService._instance = new AIService();
        return AIService._instance;
    }

    /** Load API key from DB settings. Called once at startup. */
    async init(): Promise<void> {
        const key = await getSetting('anthropic_api_key');
        if (key) this._apiKey = key;
    }

    setApiKey(key: string): void { this._apiKey = key; }
    getApiKey(): string | null    { return this._apiKey; }
    get isConfigured(): boolean   { return !!this._apiKey; }

    /**
     * Make an AI request, returning the text response.
     * Returns null if no API key is configured.
     */
    async ask(req: AiRequest): Promise<string | null> {
        if (!this._apiKey) return null;

        const model  = req.model ?? DEFAULT_MODEL;
        const client = new AnthropicClient(this._apiKey, model);

        if (!req.noCache) {
            const hash   = await _hash(`${model}::${req.systemPrompt ?? ''}::${req.prompt}::${req.images?.map(i => i.data.slice(0, 64)).join('|') ?? ''}`);
            const cached = await getAiCache(hash);
            if (cached) return cached;

            const response = req.images?.length
                ? await client.askWithImage(req.images, req.prompt, req.systemPrompt)
                : await client.ask(req.prompt, req.systemPrompt);

            await setAiCache(hash, 'anthropic', model, response);
            return response;
        }

        return req.images?.length
            ? await client.askWithImage(req.images, req.prompt, req.systemPrompt)
            : await client.ask(req.prompt, req.systemPrompt);
    }

    /**
     * Ask and parse the response as JSON. Returns null on any failure.
     */
    async askJson<T>(req: AiRequest): Promise<T | null> {
        try {
            const text = await this.ask(req);
            if (!text) return null;

            // Strip markdown code fences if present
            const clean = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
            return JSON.parse(clean) as T;
        } catch {
            return null;
        }
    }
}

async function _hash(text: string): Promise<string> {
    const buf  = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export const aiService = AIService.get();
