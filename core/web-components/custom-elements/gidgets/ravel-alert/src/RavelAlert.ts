import { RavelElement } from '../../../../common/RavelElement';

/**
 * A floating capsule-shaped alert that appears in the lower viewport.
 * Triggered by a window message; responds with a button selection or
 * auto-dissolves when used as an interstitial notification.
 *
 * ### Attributes
 * | Attribute  | Type                              | Default  | Description                           |
 * |------------|-----------------------------------|----------|---------------------------------------|
 * | `text`     | string                            | `''`     | Message text                          |
 * | `color`    | `red\|yellow\|green\|blue`        | `blue`   | Dominant color variant                |
 * | `buttons`  | comma-separated string            | `''`     | Visible buttons: cancel, ok, continue |
 * | `timeout`  | number (ms)                       | `3000`   | Default interstitial duration         |
 * | `visible`  | boolean (presence)                | —        | Show the alert (no timeout)           |
 *
 * ### Messages received (on `'ravel-alert'` channel)
 * | cmd    | content                                                    | Effect                           |
 * |--------|------------------------------------------------------------|----------------------------------|
 * | `show` | `{ text, color, buttons?, interstitial?, timeout? }`       | Show alert; dissolves if interstitial |
 * | `hide` | —                                                          | Dismiss the alert                |
 *
 * ### Messages broadcast (on `'ravel-alert'` channel)
 * | cmd        | content                       | Trigger             |
 * |------------|-------------------------------|---------------------|
 * | `response` | `{ id, button }`              | Button pressed      |
 * | `dissolve` | `{ id }`                      | Interstitial expired|
 */
export class RavelAlert extends RavelElement {

    private static readonly localStyles = `
        :host {
            position: fixed;
            bottom: 22vh;
            left: 50%;
            width: 60vw;
            z-index: 9999;
            transition: opacity 0.22s ease, transform 0.22s ease;
        }
        #alert-box {
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 22px;
            padding: 30px 44px;
            border-radius: 32px;
            overflow: hidden;
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.12);
            box-sizing: border-box;
            text-align: center;
        }
        #message {
            font-size: 1.6rem;
            font-weight: 400;
            color: #ffffff;
            line-height: 1.45;
            letter-spacing: 0.2px;
            font-family: 'Segoe UI', system-ui, sans-serif;
        }
        #buttons {
            display: flex;
            gap: 14px;
            justify-content: center;
        }
        #buttons button {
            border: none;
            border-radius: 999px;
            padding: 10px 32px;
            font-size: 1rem;
            cursor: pointer;
            font-family: inherit;
            background: rgba(255, 255, 255, 0.15);
            color: rgba(255, 255, 255, 0.8);
            letter-spacing: 0.4px;
            transition: background 0.15s;
        }
        #buttons button:hover {
            background: rgba(255, 255, 255, 0.26);
        }
        #buttons button.primary {
            background: rgba(255, 255, 255, 0.26);
            color: #ffffff;
            font-weight: 500;
        }
        #buttons button.primary:hover {
            background: rgba(255, 255, 255, 0.38);
        }
        #progress {
            position: absolute;
            bottom: 0;
            left: 0;
            height: 3px;
            width: 100%;
            background: rgba(255, 255, 255, 0.45);
            transform-origin: left center;
            display: none;
        }
        @keyframes ra-progress {
            from { transform: scaleX(1); }
            to   { transform: scaleX(0); }
        }
    `;

    private static readonly COLOR_BG: Record<string, string> = {
        red:    'rgba(214, 28,  28,  0.93)',
        yellow: 'rgba(196, 138, 0,   0.93)',
        green:  'rgba(22,  160, 70,  0.93)',
        blue:   'rgba(24,  72,  218, 0.93)',
    };

    static get observedAttributes(): string[] {
        return [
            ...RavelElement.baseObservedAttributes,
            'text', 'color', 'buttons', 'timeout', 'visible',
        ];
    }

    private alertBoxEl!: HTMLElement;
    private messageEl!:  HTMLElement;
    private buttonsEl!:  HTMLElement;
    private progressEl!: HTMLElement;

    private _text         = '';
    private _color        = 'blue';
    private _buttons:       string[] = [];
    private _interstitial = false;
    private _timeout      = 3000;
    private _visible      = false;
    private _timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    protected initialize(): void {
        super.initialize();

        const style = document.createElement('style');
        style.textContent = RavelAlert.localStyles;
        this.shadowRoot!.insertBefore(style, this.container);

        this.alertBoxEl = document.createElement('div');
        this.alertBoxEl.id = 'alert-box';

        this.messageEl = document.createElement('div');
        this.messageEl.id = 'message';

        this.buttonsEl = document.createElement('div');
        this.buttonsEl.id = 'buttons';

        this.progressEl = document.createElement('div');
        this.progressEl.id = 'progress';

        this.alertBoxEl.appendChild(this.messageEl);
        this.alertBoxEl.appendChild(this.buttonsEl);
        this.alertBoxEl.appendChild(this.progressEl);
        this.container.appendChild(this.alertBoxEl);
    }

    protected setup(): void {
        super.setup();
        this._setVisible(this._visible, false);
        window.addEventListener('ravel-alert', this._handleMessage as EventListener);
    }

    protected teardown(): void {
        this._clearTimer();
        window.removeEventListener('ravel-alert', this._handleMessage as EventListener);
        super.teardown();
    }

    private _handleMessage = (e: CustomEvent): void => {
        const { cmd, content } = e.detail ?? {};
        if (cmd === 'show') {
            this._clearTimer();
            if (content?.text         != null) this._text         = content.text;
            if (content?.color        != null) this._color        = content.color;
            if (content?.buttons      != null) this._buttons      = this._parseButtons(content.buttons);
            if (content?.timeout      != null) this._timeout      = Number(content.timeout) || 3000;
            // interstitial defaults to false each show so a follow-up show without it resets to button mode
            this._interstitial = Boolean(content?.interstitial);
            this._render();
            this._setVisible(true);
            if (this._interstitial) {
                this._startProgress(this._timeout);
                this._timeoutHandle = setTimeout(() => {
                    this._setVisible(false);
                    this.broadcastMessage('ravel-alert', 'dissolve', { id: this.id });
                }, this._timeout);
            }
        } else if (cmd === 'hide') {
            this._setVisible(false);
        }
    };

    private _clearTimer(): void {
        if (this._timeoutHandle !== null) {
            clearTimeout(this._timeoutHandle);
            this._timeoutHandle = null;
        }
    }

    private _startProgress(ms: number): void {
        // Restart CSS animation by forcing a reflow between animation: none and the real value
        this.progressEl.style.animation = 'none';
        void this.progressEl.offsetWidth;
        this.progressEl.style.animation = `ra-progress ${ms}ms linear forwards`;
    }

    private _parseButtons(val: string | string[]): string[] {
        if (Array.isArray(val)) return val;
        if (typeof val === 'string') return val.split(',').map(s => s.trim()).filter(Boolean);
        return [];
    }

    private _setVisible(on: boolean, animate = true): void {
        if (!on) this._clearTimer();
        this._visible = on;
        if (!animate) {
            this.style.transition = 'none';
        }
        if (on) {
            this.style.opacity = '1';
            this.style.pointerEvents = 'auto';
            this.style.transform = 'translateX(-50%) translateY(0)';
        } else {
            this.style.opacity = '0';
            this.style.pointerEvents = 'none';
            this.style.transform = 'translateX(-50%) translateY(16px)';
        }
        if (!animate) {
            requestAnimationFrame(() => { this.style.transition = ''; });
        }
    }

    private _render(): void {
        this.messageEl.textContent = this._text;
        this.alertBoxEl.style.background =
            RavelAlert.COLOR_BG[this._color] ?? RavelAlert.COLOR_BG.blue;

        // Buttons — hidden in interstitial mode
        this.buttonsEl.style.display = this._interstitial ? 'none' : 'flex';
        this.buttonsEl.innerHTML = '';
        if (!this._interstitial) {
            for (const btn of this._buttons) {
                const el = document.createElement('button');
                el.textContent = btn === 'ok' ? 'OK' : btn.charAt(0).toUpperCase() + btn.slice(1);
                if (btn === 'ok' || btn === 'continue') el.classList.add('primary');
                el.addEventListener('click', () => this._onButton(btn));
                this.buttonsEl.appendChild(el);
            }
        }

        // Progress bar — only shown in interstitial mode
        this.progressEl.style.display = this._interstitial ? 'block' : 'none';
    }

    private _onButton(btn: string): void {
        this.broadcastMessage('ravel-alert', 'response', { id: this.id, button: btn });
        this._setVisible(false);
    }

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        super.attributeChangedCallback(name, oldValue, newValue);

        switch (name) {
            case 'text':
                this._text = newValue ?? '';
                if (this.messageEl) this.messageEl.textContent = this._text;
                break;
            case 'color':
                this._color = newValue ?? 'blue';
                if (this.alertBoxEl) {
                    this.alertBoxEl.style.background =
                        RavelAlert.COLOR_BG[this._color] ?? RavelAlert.COLOR_BG.blue;
                }
                break;
            case 'buttons':
                this._buttons = this._parseButtons(newValue ?? '');
                if (this.buttonsEl) this._render();
                break;
            case 'timeout':
                this._timeout = Number(newValue) || 3000;
                break;
            case 'visible':
                this._setVisible(newValue !== null);
                break;
        }
    }
}
