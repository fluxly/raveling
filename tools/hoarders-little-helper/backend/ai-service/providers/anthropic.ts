/**
 * Thin Anthropic Messages API client.
 * Uses the browser's native fetch() — available in Tauri's WebView (CSP: null).
 */

const API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

export interface ImageBlock {
    type:       'image';
    source:     {
        type:       'base64';
        media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
        data:       string;  // base64 encoded
    };
}

export interface TextBlock {
    type: 'text';
    text: string;
}

export type ContentBlock = ImageBlock | TextBlock;

export interface AnthropicResponse {
    content:    { type: 'text'; text: string }[];
    usage:      { input_tokens: number; output_tokens: number };
    model:      string;
    stop_reason: string;
}

export class AnthropicClient {
    private _apiKey: string;
    private _model:  string;

    constructor(apiKey: string, model = DEFAULT_MODEL) {
        this._apiKey = apiKey;
        this._model  = model;
    }

    async complete(
        userContent: string | ContentBlock[],
        systemPrompt?: string,
    ): Promise<AnthropicResponse> {
        const body: Record<string, unknown> = {
            model:      this._model,
            max_tokens: 1024,
            messages:   [
                { role: 'user', content: userContent },
            ],
        };

        if (systemPrompt) {
            body['system'] = systemPrompt;
        }

        const res = await fetch(API_URL, {
            method:  'POST',
            headers: {
                'Content-Type':      'application/json',
                'x-api-key':         this._apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const err = await res.text().catch(() => res.statusText);
            throw new Error(`Anthropic API error ${res.status}: ${err}`);
        }

        return res.json() as Promise<AnthropicResponse>;
    }

    /** Convenience: return just the text of the first content block. */
    async ask(prompt: string, systemPrompt?: string): Promise<string> {
        const resp = await this.complete(prompt, systemPrompt);
        return resp.content[0]?.text ?? '';
    }

    /** Ask with one or more images (base64) + an optional text prompt. */
    async askWithImage(
        imageBase64s: { data: string; mimeType: 'image/jpeg' | 'image/png' | 'image/webp' }[],
        textPrompt:   string,
        systemPrompt?: string,
    ): Promise<string> {
        const blocks: ContentBlock[] = [
            ...imageBase64s.map(img => ({
                type:   'image' as const,
                source: {
                    type:       'base64' as const,
                    media_type: img.mimeType,
                    data:       img.data,
                },
            })),
            { type: 'text' as const, text: textPrompt },
        ];
        const resp = await this.complete(blocks, systemPrompt);
        return resp.content[0]?.text ?? '';
    }
}
