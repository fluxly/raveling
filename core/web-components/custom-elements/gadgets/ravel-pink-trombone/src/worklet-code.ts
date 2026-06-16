/**
 * Combined AudioWorklet processor for Pink Trombone synthesis.
 *
 * Sources (both MIT licensed):
 *   - noise.js  — Simplex noise by Stefan Gustavson / Joseph Gentle (public domain)
 *   - pink_trombone_processor.js — Modular Pink Trombone by Yonatan Rozin,
 *       originally Pink Trombone by Neil Thapen © 2017
 *
 * Modifications: `export default class Noise` → `class Noise`;
 *   `import Noise` removed; `export function` → `function`.
 *   Combined into one Blob-friendly ES module with no external imports.
 */
export const TROMBONE_WORKLET_CODE = `
// ─── Simplex Noise (inlined from noise.js) ───────────────────────────────────
function Grad(x, y, z) { this.x = x; this.y = y; this.z = z; }
Grad.prototype.dot2 = function(x, y) { return this.x * x + this.y * y; };
Grad.prototype.dot3 = function(x, y, z) { return this.x * x + this.y * y + this.z * z; };

const _grad3 = [
  new Grad(1,1,0), new Grad(-1,1,0), new Grad(1,-1,0), new Grad(-1,-1,0),
  new Grad(1,0,1), new Grad(-1,0,1), new Grad(1,0,-1), new Grad(-1,0,-1),
  new Grad(0,1,1), new Grad(0,-1,1), new Grad(0,1,-1), new Grad(0,-1,-1)
];
const _p = [
  151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,
  6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,
  171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,
  55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,
  188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,
  206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,
  43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,
  210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,
  115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180
];
const _F2 = 0.5 * (Math.sqrt(3) - 1);
const _G2 = (3 - Math.sqrt(3)) / 6;

class Noise {
  constructor(seed = Math.random()) {
    this.perm = new Array(512);
    this.gradP = new Array(512);
    this.seed(seed);
  }
  seed(seed) {
    if (seed > 0 && seed < 1) seed *= 65536;
    seed = Math.floor(seed);
    if (seed < 256) seed |= seed << 8;
    for (let i = 0; i < 256; i++) {
      const v = (i & 1) ? (_p[i] ^ (seed & 255)) : (_p[i] ^ ((seed >> 8) & 255));
      this.perm[i] = this.perm[i + 256] = v;
      this.gradP[i] = this.gradP[i + 256] = _grad3[v % 12];
    }
  }
  simplex2(xin, yin) {
    let n0, n1, n2;
    const s = (xin + yin) * _F2;
    let i = Math.floor(xin + s);
    let j = Math.floor(yin + s);
    const t = (i + j) * _G2;
    const x0 = xin - i + t, y0 = yin - j + t;
    let i1, j1;
    if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
    const x1 = x0 - i1 + _G2, y1 = y0 - j1 + _G2;
    const x2 = x0 - 1 + 2 * _G2, y2 = y0 - 1 + 2 * _G2;
    i &= 255; j &= 255;
    const gi0 = this.gradP[i + this.perm[j]];
    const gi1 = this.gradP[i + i1 + this.perm[j + j1]];
    const gi2 = this.gradP[i + 1 + this.perm[j + 1]];
    let t0 = 0.5 - x0*x0 - y0*y0;
    if (t0 < 0) n0 = 0; else { t0 *= t0; n0 = t0*t0*gi0.dot2(x0, y0); }
    let t1 = 0.5 - x1*x1 - y1*y1;
    if (t1 < 0) n1 = 0; else { t1 *= t1; n1 = t1*t1*gi1.dot2(x1, y1); }
    let t2 = 0.5 - x2*x2 - y2*y2;
    if (t2 < 0) n2 = 0; else { t2 *= t2; n2 = t2*t2*gi2.dot2(x2, y2); }
    return 70 * (n0 + n1 + n2);
  }
  simplex1(x) { return this.simplex2(x * 1.2, -x * 0.7); }
}

// ─── Pink Trombone Processors (inlined from pink_trombone_processor.js) ───────
function clamp(number, min, max) {
  if (number < min) return min;
  else if (number > max) return max;
  else return number;
}

function moveTowards(current, target, amountUp, amountDown) {
  if (current < target) return Math.min(current + amountUp, target);
  else return Math.max(current - amountDown, target);
}

function constrain(n, low, high) {
  return Math.max(Math.min(n, high), low);
}

function map(n, start1, stop1, start2, stop2, withinBounds = true) {
  const newval = (n - start1) / (stop1 - start1) * (stop2 - start2) + start2;
  if (!withinBounds) return newval;
  if (start2 < stop2) return constrain(newval, start2, stop2);
  else return constrain(newval, stop2, start2);
}

class GlottisProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "frequency",        defaultValue: 140,   minValue: 20,   maxValue: 2000, automationRate: "k-rate" },
      { name: "intensity",        defaultValue: 1,     minValue: 0,    maxValue: 1,    automationRate: "a-rate" },
      { name: "tenseness",        defaultValue: 0.6,   minValue: 0,    maxValue: 1,    automationRate: "k-rate" },
      { name: "tenseness-mult",   defaultValue: 1,     minValue: 0,    maxValue: 1,    automationRate: "a-rate" },
      { name: "vibrato-amount",   defaultValue: 0.005, minValue: 0,    maxValue: 1,    automationRate: "k-rate" },
      { name: "vibrato-frequency",defaultValue: 6,     minValue: 0,    maxValue: 100,  automationRate: "k-rate" },
      { name: "pitchbend",        defaultValue: 0,     minValue: -24,  maxValue: 24,   automationRate: "a-rate" },
    ];
  }

  UITenseness = 0.6;
  UIFrequency = 140;
  vibratoAmount = 0.005;
  vibratoFrequency = 6;
  intensity = 0;
  loudness = 1;
  totalTime = 0;
  timeInWaveform = 0;
  waveformLength = 0;
  oldFrequency = 140;
  newFrequency = 140;
  smoothFrequency = 140;
  oldTenseness = 0.6;
  newTenseness = 0.6;
  noise = new Noise();

  constructor(options) {
    super();
    this.init();
    this.i = options.processorOptions.i;
  }

  init() { this.setupWaveform(0); }

  setupWaveform(lambda) {
    this.frequency = this.oldFrequency * (1-lambda) + this.newFrequency * lambda;
    let tenseness = this.oldTenseness * (1-lambda) + this.newTenseness * lambda;
    this.Rd = 3 * (1 - tenseness);
    this.waveformLength = 1 / this.frequency;
    let Rd = this.Rd;
    if (Rd < 0.5) Rd = 0.5;
    if (Rd > 2.7) Rd = 2.7;
    let Ra = -0.01 + 0.048 * Rd;
    let Rk = 0.224 + 0.118 * Rd;
    let Rg = (Rk / 4) * (0.5 + 1.2 * Rk) / (0.11 * Rd - Ra * (0.5 + 1.2 * Rk));
    let Ta = Ra, Tp = 1 / (2 * Rg), Te = Tp + Tp * Rk;
    let epsilon = 1 / Ta;
    let shift = Math.exp(-epsilon * (1 - Te));
    let Delta = 1 - shift;
    let RHSIntegral = (1 / epsilon) * (shift - 1) + (1 - Te) * shift;
    RHSIntegral = RHSIntegral / Delta;
    let totalLowerIntegral = -(Te - Tp) / 2 + RHSIntegral;
    let totalUpperIntegral = -totalLowerIntegral;
    let omega = Math.PI / Tp;
    let s = Math.sin(omega * Te);
    let y = -Math.PI * s * totalUpperIntegral / (Tp * 2);
    let z = Math.log(y);
    let alpha = z / (Tp / 2 - Te);
    let E0 = -1 / (s * Math.exp(alpha * Te));
    this.alpha = alpha; this.E0 = E0; this.epsilon = epsilon;
    this.shift = shift; this.Delta = Delta; this.Te = Te; this.omega = omega;
  }

  normalizedLFWaveform(t) {
    let output;
    if (t > this.Te) output = (-Math.exp(-this.epsilon * (t - this.Te)) + this.shift) / this.Delta;
    else output = this.E0 * Math.exp(this.alpha * t) * Math.sin(this.omega * t);
    return output * this.intensity * this.loudness;
  }

  runStep(lambda, noiseSource) {
    let timeStep = 1.0 / sampleRate;
    this.timeInWaveform += timeStep;
    this.totalTime += timeStep;
    if (this.timeInWaveform > this.waveformLength) {
      this.timeInWaveform -= this.waveformLength;
      this.setupWaveform(lambda);
    }
    let out = this.normalizedLFWaveform(this.timeInWaveform / this.waveformLength);
    let aspiration = this.intensity * (1 - Math.sqrt(this.UITenseness)) * this.getNoiseModulator() * noiseSource * 8;
    aspiration *= 0.2 + 0.02 * this.noise.simplex1(this.totalTime * 1.99);
    out += aspiration;
    return out;
  }

  getNoiseModulator() {
    let voiced = 0.1 + 0.2 * Math.max(0, Math.sin(Math.PI * 2 * this.timeInWaveform / this.waveformLength));
    return this.UITenseness * this.intensity * voiced + (1 - this.UITenseness * this.intensity) * 0.3;
  }

  finishBlock() {
    let vibrato = 0;
    vibrato += this.vibratoAmount * Math.sin(2 * Math.PI * this.totalTime * this.vibratoFrequency);
    vibrato += 0.02 * this.noise.simplex1(this.totalTime * 4.07);
    if (this.UIFrequency > this.smoothFrequency)
      this.smoothFrequency = Math.min(this.smoothFrequency * 1.1, this.UIFrequency);
    if (this.UIFrequency < this.smoothFrequency)
      this.smoothFrequency = Math.max(this.smoothFrequency / 1.1, this.UIFrequency);
    this.oldFrequency = this.newFrequency;
    this.newFrequency = this.smoothFrequency * (1 + vibrato);
    this.oldTenseness = this.newTenseness;
    this.newTenseness = this.UITenseness
      + 0.1 * this.noise.simplex1(this.totalTime * 0.46)
      + 0.05 * this.noise.simplex1(this.totalTime * 0.36);
  }

  process(inputs, outputs, params) {
    this.vibratoAmount    = params["vibrato-amount"][0];
    this.vibratoFrequency = params["vibrato-frequency"][0];
    if (!inputs[0][0]) return true;
    try {
      const inputArray   = inputs[0][0];
      const outArray     = outputs[0][0];
      const noiseModArray = outputs[1][0];
      for (let j = 0, N = outArray.length; j < N; j++) {
        const tensenessMult = params["tenseness-mult"][j] || params["tenseness-mult"][0];
        this.UITenseness = params["tenseness"][0] * tensenessMult;
        this.loudness    = Math.pow(tensenessMult * this.UITenseness, 0.25);
        this.intensity   = params["intensity"][j]  || params["intensity"][0];
        this.UIFrequency = params["frequency"][0] *
          Math.pow(2, (params["pitchbend"][j] || params["pitchbend"][0]) / 12);
        const lambda1 = j / N;
        const samp = this.runStep(lambda1, inputArray[j]);
        outArray[j]     = samp;
        noiseModArray[j] = this.getNoiseModulator();
      }
      this.finishBlock();
      return true;
    } catch (e) {
      console.error("glottis error:", e);
      return true;
    }
  }
}

class TractProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "n",                     defaultValue: 44,   minValue: 30,  maxValue: 60,  automationRate: "k-rate" },
      { name: "velum-target",          defaultValue: 0.01, minValue: 0,   maxValue: 0.4, automationRate: "a-rate" },
      { name: "constriction-index",    defaultValue: 0,    minValue: 0,                  automationRate: "a-rate" },
      { name: "constriction-diameter", defaultValue: 3,                   maxValue: 5,   automationRate: "a-rate" },
      { name: "constriction2-index",   defaultValue: 0,    minValue: 0,                  automationRate: "a-rate" },
      { name: "constriction2-diameter",defaultValue: 3,                   maxValue: 5,   automationRate: "a-rate" },
      { name: "lip-diameter",          defaultValue: 1.5,  minValue: 0,   maxValue: 1.5 },
      { name: "movement-speed",        defaultValue: 15,                                 automationRate: "k-rate" },
      { name: "fricative-strength",    defaultValue: 1,    minValue: 0,   maxValue: 1,   automationRate: "a-rate" },
      { name: "tongue-index",          defaultValue: 12.9, minValue: 0,   maxValue: 44,  automationRate: "k-rate" },
      { name: "tongue-diameter",       defaultValue: 2.43, minValue: 2.05,maxValue: 3.50,automationRate: "k-rate" },
    ];
  }

  n = 44;
  bladeStart = 10; tipStart = 32; lipStart = 39;
  R = []; L = []; reflection = []; junctionOutputR = []; junctionOutputL = [];
  diameter = []; targetDiameter = []; A = [];
  glottalReflection = 0.75; lipReflection = -0.85; lastObstruction = -1;
  fade = 1.0; movementSpeed = 15; transients = []; transientStrength = 0.3;
  lipOutput = 0; noseOutput = 0; velumTarget = 0.01; fricative_strength = 1;
  blockTime = 128 / sampleRate;
  constrictionIndex = 0; constrictionDiameter = 3;
  constriction2Index = 0; constriction2Diameter = 3;
  tongueIndex = 12.9; tongueDiameter = 2.43; lipDiameter = 5;

  constructor(options) {
    super();
    this.i = options.processorOptions.i;
    this.init();
  }

  init(n = 44) {
    this.n = n;
    this.bladeStart = Math.floor(10 * this.n / 44);
    this.tipStart   = Math.floor(32 * this.n / 44);
    this.lipStart   = Math.floor(39 * this.n / 44);
    this.diameter       = new Float64Array(this.n);
    this.targetDiameter = new Float64Array(this.n);
    this.getTargetDiameters();
    for (let i = 0; i < this.targetDiameter.length; i++) this.diameter[i] = this.targetDiameter[i];
    this.R               = new Float64Array(this.n);
    this.L               = new Float64Array(this.n);
    this.reflection      = new Float64Array(this.n + 1);
    this.newReflection   = new Float64Array(this.n + 1);
    this.junctionOutputR = new Float64Array(this.n + 1);
    this.junctionOutputL = new Float64Array(this.n + 1);
    this.A               = new Float64Array(this.n);
    this.noseLength       = Math.floor(28 * this.n / 44);
    this.noseStart        = this.n - this.noseLength + 1;
    this.noseR            = new Float64Array(this.noseLength);
    this.noseL            = new Float64Array(this.noseLength);
    this.noseJunctionOutputR = new Float64Array(this.noseLength + 1);
    this.noseJunctionOutputL = new Float64Array(this.noseLength + 1);
    this.noseReflection   = new Float64Array(this.noseLength + 1);
    this.noseDiameter     = new Float64Array(this.noseLength);
    this.noseA            = new Float64Array(this.noseLength);
    for (let i = 0; i < this.noseLength; i++) {
      let d, dv = 2 * (i / this.noseLength);
      if (dv < 1) d = 0.4 + 1.6 * dv; else d = 0.5 + 1.5 * (2 - dv);
      this.noseDiameter[i] = Math.min(d, 1.9);
    }
    this.newReflectionLeft = this.newReflectionRight = this.newReflectionNose = 0;
    this.calculateReflections();
    this.calculateNoseReflections();
    this.noseDiameter[0] = this.velumTarget;
    this.port.postMessage({ d: this.diameter, v: this.noseDiameter[0] });
  }

  calculateReflections() {
    for (let i = 0; i < this.n; i++) this.A[i] = this.diameter[i] * this.diameter[i];
    for (let i = 1; i < this.n; i++) {
      this.reflection[i] = this.newReflection[i];
      if (this.A[i] === 0) this.newReflection[i] = 0.999;
      else this.newReflection[i] = (this.A[i-1] - this.A[i]) / (this.A[i-1] + this.A[i]);
    }
    this.reflectionLeft  = this.newReflectionLeft;
    this.reflectionRight = this.newReflectionRight;
    this.reflectionNose  = this.newReflectionNose;
    const sum = this.A[this.noseStart] + this.A[this.noseStart+1] + this.noseA[0];
    this.newReflectionLeft  = (2 * this.A[this.noseStart]   - sum) / sum;
    this.newReflectionRight = (2 * this.A[this.noseStart+1] - sum) / sum;
    this.newReflectionNose  = (2 * this.noseA[0]            - sum) / sum;
  }

  calculateNoseReflections() {
    for (let i = 0; i < this.noseLength; i++) this.noseA[i] = this.noseDiameter[i] * this.noseDiameter[i];
    for (let i = 1; i < this.noseLength; i++)
      this.noseReflection[i] = (this.noseA[i-1] - this.noseA[i]) / (this.noseA[i-1] + this.noseA[i]);
  }

  reshapeTract(deltaTime) {
    const amount = this.movementSpeed < 0 ? Infinity : deltaTime * this.movementSpeed;
    let newLastObstruction = -1;
    for (let i = 0; i < this.n; i++) {
      const dia = this.diameter[i], tgt = this.targetDiameter[i];
      if (dia <= 0) newLastObstruction = i;
      let slowReturn;
      if (i < this.noseStart) slowReturn = 0.6;
      else if (i >= this.tipStart) slowReturn = 1.0;
      else slowReturn = 0.6 + 0.4 * (i - this.noseStart) / (this.tipStart - this.noseStart);
      this.diameter[i] = moveTowards(dia, tgt, slowReturn * amount, 2 * amount);
    }
    if (this.lastObstruction > -1 && newLastObstruction === -1 && this.noseA[0] < 0.05 && this.fricative_strength)
      this.addTransient(this.lastObstruction);
    this.lastObstruction = newLastObstruction;
    this.noseDiameter[0] = moveTowards(this.noseDiameter[0], this.velumTarget, amount * 0.25, amount * 0.1);
    this.noseA[0] = this.noseDiameter[0] * this.noseDiameter[0];
  }

  addTransient(position) {
    this.transients.push({ position, timeAlive: 0, lifeTime: 0.2, strength: this.transientStrength, exponent: 200 });
  }

  processTransients() {
    for (let i = 0; i < this.transients.length; i++) {
      const tr = this.transients[i];
      const amplitude = tr.strength * Math.pow(2, -tr.exponent * tr.timeAlive);
      this.R[tr.position] += amplitude / 2;
      this.L[tr.position] += amplitude / 2;
      tr.timeAlive += 1.0 / (sampleRate * 2);
    }
    for (let i = this.transients.length - 1; i >= 0; i--)
      if (this.transients[i].timeAlive > this.transients[i].lifeTime) this.transients.splice(i, 1);
  }

  addTurbulenceNoise(turbulenceNoise, noiseModulator) {
    if (this.constrictionIndex < 2 || this.constrictionIndex > this.n) return;
    if (this.constrictionDiameter <= 0) return;
    const intensity = this.fricative_strength * 2;
    this.addTurbulenceNoiseAtIndex(0.66 * turbulenceNoise * intensity, this.constrictionIndex,  this.constrictionDiameter,  noiseModulator);
    this.addTurbulenceNoiseAtIndex(0.66 * turbulenceNoise * intensity, this.constriction2Index, this.constriction2Diameter, noiseModulator);
  }

  addTurbulenceNoiseAtIndex(turbulenceNoise, index, diameter, noiseModulator) {
    const i = Math.floor(index), delta = index - i;
    turbulenceNoise *= noiseModulator;
    const thinness0 = clamp(8 * (0.7 - diameter), 0, 1);
    const openness  = clamp(30 * (diameter - 0.3), 0, 1);
    const noise0 = turbulenceNoise * (1 - delta) * thinness0 * openness;
    const noise1 = turbulenceNoise * delta       * thinness0 * openness;
    this.R[i+1] += noise0/2; this.L[i+1] += noise0/2;
    this.R[i+2] += noise1/2; this.L[i+2] += noise1/2;
  }

  runStep(glottalOutput, turbulenceNoise, lambda, noiseModulator) {
    this.processTransients();
    this.addTurbulenceNoise(turbulenceNoise, noiseModulator);
    this.junctionOutputR[0]    = this.L[0] * this.glottalReflection + glottalOutput;
    this.junctionOutputL[this.n] = this.R[this.n-1] * this.lipReflection;
    for (let i = 1; i < this.n; i++) {
      const r = this.reflection[i] * (1-lambda) + this.newReflection[i] * lambda;
      const w = r * (this.R[i-1] + this.L[i]);
      this.junctionOutputR[i] = this.R[i-1] - w;
      this.junctionOutputL[i] = this.L[i]   + w;
    }
    const ni = this.noseStart;
    let r = this.newReflectionLeft  * (1-lambda) + this.reflectionLeft  * lambda;
    this.junctionOutputL[ni] = r * this.R[ni-1] + (1+r) * (this.noseL[0] + this.L[ni]);
    r = this.newReflectionRight * (1-lambda) + this.reflectionRight * lambda;
    this.junctionOutputR[ni] = r * this.L[ni]   + (1+r) * (this.R[ni-1] + this.noseL[0]);
    r = this.newReflectionNose  * (1-lambda) + this.reflectionNose  * lambda;
    this.noseJunctionOutputR[0] = r * this.noseL[0] + (1+r) * (this.L[ni] + this.R[ni-1]);
    for (let i = 0; i < this.n; i++) {
      this.R[i] = this.junctionOutputR[i]   * 0.999;
      this.L[i] = this.junctionOutputL[i+1] * 0.999;
    }
    this.lipOutput = this.R[this.n-1];
    this.noseJunctionOutputL[this.noseLength] = this.noseR[this.noseLength-1] * this.lipReflection;
    for (let i = 1; i < this.noseLength; i++) {
      const w = this.noseReflection[i] * (this.noseR[i-1] + this.noseL[i]);
      this.noseJunctionOutputR[i] = this.noseR[i-1] - w;
      this.noseJunctionOutputL[i] = this.noseL[i]   + w;
    }
    for (let i = 0; i < this.noseLength; i++) {
      this.noseR[i] = this.noseJunctionOutputR[i]   * this.fade;
      this.noseL[i] = this.noseJunctionOutputL[i+1] * this.fade;
    }
    this.noseOutput = this.noseR[this.noseLength-1];
  }

  finishBlock() {
    this.reshapeTract(this.blockTime);
    this.calculateReflections();
  }

  getTargetDiameters() {
    try {
      for (let i = 0; i < this.n; i++) {
        let d;
        if      (i < 7  * this.n / 44 - 0.5) d = 0.6;
        else if (i < 12 * this.n / 44)        d = 1.1;
        else                                   d = 1.5;
        this.targetDiameter[i] = d;
      }
      for (let i = this.bladeStart; i < this.lipStart; i++) {
        const t = 1.1 * Math.PI * (this.tongueIndex - i) / (this.tipStart - this.bladeStart);
        const fixedTongueDiameter = 2 + (this.tongueDiameter - 2) / 1.5;
        let curve = (1.5 - fixedTongueDiameter + 1.7) * Math.cos(t);
        if (i === this.bladeStart - 2 || i === this.lipStart - 1)  curve *= 0.8;
        if (i === this.bladeStart     || i === this.lipStart - 2)  curve *= 0.94;
        this.targetDiameter[i] = 1.5 - curve;
      }
      const applyConstriction = (index, dia) => {
        if (!index || dia <= -1.6) return;
        if (index > this.noseStart && dia < -0.8) this.velumTarget = 0.4;
        dia -= 0.3;
        if (dia < 0) dia = 0;
        const width = map(index, 25/44*this.n, this.tipStart, 10, 5) / 44 * this.n;
        if (index >= 2 && index < this.n && dia < 3) {
          const intIndex = Math.round(index);
          for (let i = -Math.ceil(width) - 1; i < width + 1; i++) {
            if (intIndex + i < 0 || intIndex + i >= this.n) continue;
            let relpos = Math.abs((intIndex + i) - index) - 0.5;
            let shrink;
            if (relpos <= 0)      shrink = 0;
            else if (relpos > width) shrink = 1;
            else shrink = 0.5 * (1 - Math.cos(Math.PI * relpos / width));
            if (dia < this.targetDiameter[intIndex + i])
              this.targetDiameter[intIndex + i] = dia + (this.targetDiameter[intIndex + i] - dia) * shrink;
          }
        }
      };
      applyConstriction(this.constrictionIndex,  this.constrictionDiameter);
      applyConstriction(this.constriction2Index, this.constriction2Diameter);
      const lIndex = this.n - 2, lDia = this.lipDiameter, lWidth = 5;
      const intLip = Math.round(lIndex);
      for (let i = -Math.ceil(lWidth) - 1; i < lWidth + 1; i++) {
        if (intLip + i < 0 || intLip + i >= this.n) continue;
        let relpos = Math.abs((intLip + i) - lIndex) - 0.5;
        let shrink;
        if (relpos <= 0)       shrink = 0;
        else if (relpos > lWidth) shrink = 1;
        else shrink = 0.5 * (1 - Math.cos(Math.PI * relpos / lWidth));
        if (lDia < this.targetDiameter[intLip + i])
          this.targetDiameter[intLip + i] = lDia + (this.targetDiameter[intLip + i] - lDia) * shrink;
      }
    } catch (e) { console.log(e); }
  }

  process(inputs, outputs, params) {
    if (!inputs[0][0]) return true;
    const glottalSignal  = inputs[0][0];
    const fricativeNoise = inputs[1][0];
    const noiseModArray  = inputs[2][0];
    try {
      const newN = Math.floor(params["n"][0]);
      if (newN !== this.n) this.init(newN);
      this.velumTarget          = params["velum-target"][0];
      this.constrictionIndex    = params["constriction-index"][0];
      this.constrictionDiameter = params["constriction-diameter"][0] + 0.3;
      this.constriction2Index    = params["constriction2-index"][0];
      this.constriction2Diameter = params["constriction2-diameter"][0] + 0.3;
      this.tongueIndex    = params["tongue-index"][0];
      this.tongueDiameter = params["tongue-diameter"][0];
      this.lipDiameter    = params["lip-diameter"][0];
      this.getTargetDiameters();
      this.movementSpeed     = params["movement-speed"][0];
      this.fricative_strength = params["fricative-strength"][0];
      const outL = outputs[0][0], outR = outputs[0][1];
      for (let j = 0, N = outL.length; j < N; j++) {
        const lambda1 = j / N, lambda2 = (j + 0.5) / N;
        const go = glottalSignal[j];
        let vocalOutput = 0;
        this.runStep(go, fricativeNoise[j], lambda1, noiseModArray[j]);
        vocalOutput += this.lipOutput + this.noseOutput;
        this.runStep(go, fricativeNoise[j], lambda2, noiseModArray[j]);
        vocalOutput += this.lipOutput + this.noseOutput;
        const samp = vocalOutput * 0.125;
        outL[j] = samp; outR[j] = samp;
      }
      this.finishBlock();
      this.port.postMessage({ d: this.diameter, v: this.noseDiameter[0] });
    } catch (e) {
      console.error("tract error:", e);
      return false;
    }
    return true;
  }
}

registerProcessor("glottis", GlottisProcessor);
registerProcessor("tract",   TractProcessor);
`;
