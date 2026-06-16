/**
 * AudioWorklet processor that captures mono audio from the input and forwards
 * batched blocks to the main thread for libpd processing.
 *
 * Accumulates `TAP_BLOCK` samples (must be a multiple of 64) then transfers
 * the buffer to the main thread.  Using 1024 samples ≈ 23ms at 44100 Hz —
 * fast enough for real-time vocal parameter tracking.
 */
export const TAP_WORKLET_CODE = `
const TAP_BLOCK = 1024; // samples; must be a multiple of 64

class GlottalizerTapProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this._buf = new Float32Array(TAP_BLOCK);
        this._pos = 0;
    }

    process(inputs) {
        const ch = inputs[0]?.[0];
        if (!ch) return true;

        let srcPos = 0;
        while (srcPos < ch.length) {
            const toCopy = Math.min(ch.length - srcPos, TAP_BLOCK - this._pos);
            this._buf.set(ch.subarray(srcPos, srcPos + toCopy), this._pos);
            this._pos  += toCopy;
            srcPos     += toCopy;

            if (this._pos >= TAP_BLOCK) {
                const outBuf = this._buf;
                this._buf = new Float32Array(TAP_BLOCK);
                this._pos = 0;
                // Transfer ownership — zero-copy path
                this.port.postMessage({ type: 'audio', buf: outBuf }, [outBuf.buffer]);
            }
        }
        return true;
    }
}

registerProcessor('glottalizer-tap', GlottalizerTapProcessor);
`;
