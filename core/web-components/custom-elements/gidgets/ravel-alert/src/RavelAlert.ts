import { RavelElement } from '../../../../common/RavelElement';

/**
 * A floating capsule-shaped alert that appears in the lower viewport.
 * Triggered by a window message; responds with a button selection or
 * auto-dissolves when used as an interstitial notification.
 *
 * When a `followup` message is set, the alert alternates between the
 * primary and followup text every 5 s after the first 5 s of display —
 * useful for long-running operations where the user needs reassurance.
 *
 * ### Attributes
 * | Attribute  | Type                              | Default  | Description                                  |
 * |------------|-----------------------------------|----------|----------------------------------------------|
 * | `text`     | string                            | `''`     | Primary message text                         |
 * | `followup` | string                            | `''`     | Secondary message shown after 5 s            |
 * | `color`    | `red\|yellow\|green\|blue`        | `blue`   | Dominant color variant                       |
 * | `buttons`  | comma-separated string            | `''`     | Visible buttons: cancel, ok, continue        |
 * | `timeout`  | number (ms)                       | `3000`   | Default interstitial duration                |
 * | `visible`  | boolean (presence)                | —        | Show the alert (no timeout)                  |
 *
 * ### Messages received (on `'ravel-alert'` channel)
 * | cmd    | content                                                              | Effect                                |
 * |--------|----------------------------------------------------------------------|---------------------------------------|
 * | `show` | `{ text, color, buttons?, interstitial?, timeout?, followup? }`      | Show alert; dissolves if interstitial |
 * | `hide` | —                                                                    | Dismiss the alert                     |
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
            background: rgba(24, 24, 24, 0.93);
            border: 3px solid var(--alert-accent, #00F0FF);
            box-sizing: border-box;
            text-align: center;
        }
        #message {
            font-size: 1.4rem;
            color: #ffffff;
            line-height: 1.3;
            transition: opacity 0.28s ease;
        }
        #buttons {
            display: flex;
            gap: 14px;
            justify-content: center;
        }
        #buttons button {
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 999px;
            padding: 10px 32px;
            font-size: 0.9rem;
            cursor: pointer;
            font: inherit;
            background: rgba(255, 255, 255, 0.08);
            color: rgba(255, 255, 255, 0.8);
            transition: background 0.15s;
        }
        #buttons button:hover {
            background: rgba(255, 255, 255, 0.18);
        }
        #buttons button.primary {
            background: var(--alert-accent, #00F0FF);
            border-color: transparent;
            color: #181818;
        }
        #buttons button.primary:hover {
            filter: brightness(1.15);
        }
        #progress {
            position: absolute;
            bottom: 0;
            left: 0;
            height: 4px;
            width: 100%;
            background: var(--alert-accent, #00F0FF);
            transform-origin: left center;
            display: none;
        }
        @keyframes ra-progress {
            from { transform: scaleX(1); }
            to   { transform: scaleX(0); }
        }
    `;

    private static readonly COLOR_ACCENT: Record<string, string> = {
        red:    '#FF37A8',  // Fluoro Pink   — error / danger
        yellow: '#FE6810',  // Fluoro Orange — warning / caution
        green:  '#A7FF00',  // Fluoro Lime   — success / ready
        blue:   '#00F0FF',  // Fluoro Cyan   — info / active
    };

    private static readonly FOLLOWUP_DELAY_MS = 5000;
    private static readonly FOLLOWUP_INTERVAL_MS = 5000;

    static get observedAttributes(): string[] {
        return [
            ...RavelElement.baseObservedAttributes,
            'text', 'followup', 'color', 'buttons', 'timeout', 'visible',
        ];
    }

    private alertBoxEl!: HTMLElement;
    private messageEl!:  HTMLElement;
    private buttonsEl!:  HTMLElement;
    private progressEl!: HTMLElement;

    private _text         = '';
    private _followup     = '';
    private _color        = 'blue';
    private _buttons:       string[] = [];
    private _interstitial = false;
    private _timeout      = 3000;
    private _visible      = false;

    private _timeoutHandle:  ReturnType<typeof setTimeout>  | null = null;
    private _followupHandle: ReturnType<typeof setTimeout>  | null = null;
    private _alternateHandle: ReturnType<typeof setInterval> | null = null;
    private _showingFollowup = false;

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
            if (content?.followup     != null) this._followup     = content.followup;
            if (content?.color        != null) this._color        = content.color;
            if (content?.buttons      != null) this._buttons      = this._parseButtons(content.buttons);
            if (content?.timeout      != null) this._timeout      = Number(content.timeout) || 3000;
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
            this._startFollowup();
        } else if (cmd === 'hide') {
            this._setVisible(false);
        }
    };

    // Clears all active timers and resets followup state.
    private _clearTimer(): void {
        if (this._timeoutHandle !== null) {
            clearTimeout(this._timeoutHandle);
            this._timeoutHandle = null;
        }
        if (this._followupHandle !== null) {
            clearTimeout(this._followupHandle);
            this._followupHandle = null;
        }
        if (this._alternateHandle !== null) {
            clearInterval(this._alternateHandle);
            this._alternateHandle = null;
        }
        this._showingFollowup = false;
    }

    // Fades the message out, swaps text, fades back in.
    private _fadeMessage(text: string): void {
        this.messageEl.style.opacity = '0';
        setTimeout(() => {
            this.messageEl.textContent = text;
            this.messageEl.style.opacity = '1';
        }, 280);
    }

    // Starts the followup alternation cycle if a followup message is set.
    private _startFollowup(): void {
        if (!this._followup) return;
        this._followupHandle = setTimeout(() => {
            this._showingFollowup = true;
            this._fadeMessage(this._followup);
            this._alternateHandle = setInterval(() => {
                this._showingFollowup = !this._showingFollowup;
                this._fadeMessage(this._showingFollowup ? this._followup : this._text);
            }, RavelAlert.FOLLOWUP_INTERVAL_MS);
        }, RavelAlert.FOLLOWUP_DELAY_MS);
    }

    private _startProgress(ms: number): void {
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
        if (!animate) this.style.transition = 'none';
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
        this.messageEl.style.opacity = '1';
        this.alertBoxEl.style.setProperty(
            '--alert-accent',
            RavelAlert.COLOR_ACCENT[this._color] ?? RavelAlert.COLOR_ACCENT.blue
        );

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
                if (this.messageEl && !this._showingFollowup) this.messageEl.textContent = this._text;
                break;
            case 'followup':
                this._followup = newValue ?? '';
                break;
            case 'color':
                this._color = newValue ?? 'blue';
                if (this.alertBoxEl) {
                    this.alertBoxEl.style.setProperty(
                        '--alert-accent',
                        RavelAlert.COLOR_ACCENT[this._color] ?? RavelAlert.COLOR_ACCENT.blue
                    );
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
