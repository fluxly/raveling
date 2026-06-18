import { RavelElement } from '../../../base/ravel-element/src/RavelElement.js';
import globalStyles from '../../../../common/global-styles.js';

export class RavelFluxlySoundEngine extends RavelElement {
    static get localStyles() {
        return `
        <style>
        #container {
            position: relative;
            background-color: #000000;
            color: #ffffff;
            position: relative;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            width: 1000px;
            height: 800px;
            display: none;
        }
        #start {
            color: #ffffff;
            cursor: pointer;
        }
        </style>
        `;
    }
  
    static get html() { 
        return `
        <div id="container">
            <input type="range" min="-5" max="5" step="0.01" value="1" id="rate">
            <div id="start">Start!</div>
        </div>
        `;
    }
 
    static get observedAttributes() { 
        return [...super.baseObservedAttributes, 'message-id', 'show-control', 'filename', 
          'initial-value', 'min', 'max', 'no-loop'];
    }

    constructor() {
        super();
        const template = document.createElement('template');
        template.innerHTML = globalStyles
            + this.constructor.localStyles
            + this.constructor.html;
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.appendChild(template.content.cloneNode(true));
        this.initialize();
    }
  
    connectedCallback() {
        this.setup();
    }
    
    disconnectedCallback() {
        // Safely disconnect and release everything
        if (this.node) {
          this.node.disconnect();
          this.node = null;
        }
        
        if (this.audioContext) {
            this.audioContext.close(); // Stops processing and frees audio resources
            this.audioContext = null;
        }
        this.teardown();
    }
    
    initialize() {
        this.container = this.shadowRoot.querySelector('#container');
        this.messageId = 'ravel-fluxly-sound-engine';
        this.filename = 'sample-0.wav';
    }
  
    setup = async () => {
      console.log('setup!');
        this.observedMessages = [`${this.messageId}`, 'close-cryptid', 'playback-rate', 'resume' ];
        this.subscribe(this.observedMessages);   
        this.startAudio();

        this.shadowRoot.querySelector('#rate').addEventListener('input', (evt) => {
            this.sendMessage('ravel-fluxly-sound-engine', 'playback-rate', evt.target.value);
        });

        this.addEventListener(this.messageId, (evt) => {
          //console.log(evt.detail.content);
          if (evt.detail.cmd === 'playback-rate') {
              this.rate = parseFloat(evt.detail.content);
              try {
                this.node.parameters.get('playbackRate').setValueAtTime(this.rate, this.audioContext.currentTime);
              } catch (e) {
                console.log(evt.detail.cmd);
              }
          }
          /* Not used?
          if (evt.detail.cmd === 'start-audio') {
            console.log('start');
            this.startAudio();
          }
          if (evt.detail.cmd === 'stop-audio') {
            console.log('stop');
            this.stopAudio();
          }
          */
          if (evt.detail.cmd === 'resume') {
            console.log('resume playing in a no loop situation');
            this.resumeAudio();
          }
      });

        this.shadowRoot.querySelector('#start').addEventListener('click', (e) => {
            this.startAudio();
        });
    }

    startAudio = async () => {
      console.log('start audio');
        const blob = new Blob([this.workletCode], { type: 'application/javascript' });
        const blobUrl = URL.createObjectURL(blob);
        this.audioContext = new AudioContext();
        await this.audioContext.audioWorklet.addModule(blobUrl);
        this.node = new AudioWorkletNode(this.audioContext, 'sample-player', {
            outputChannelCount: [1],
            numberOfInputs: 0,
            numberOfOutputs: 1,
            parameterData: { 
                playbackRate: 1.0,
                noLoop: this.noLoop
            }
        });
        
        // Load WAV file and send to worklet
        const response = await fetch(this.filename);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
        
        // Extract Float32Arrays
        const channelData = [];
        for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
            // Copy the data — don't just pass the view!
            channelData.push(audioBuffer.getChannelData(i).slice());
        }

        // Send the raw data
        this.node.port.postMessage({
            type: 'sample-data',
            channelData: channelData,
            sampleRate: audioBuffer.sampleRate,
            length: audioBuffer.length,
        });

        this.node.connect(this.audioContext.destination);
        this.audioContext.resume();
    }

    stopAudio = () => {
        console.log('it never really stops...)');
    }

    resumeAudio = (evt) => {
        try {
          this.node.port.postMessage({ playing: true });
        } catch (e) {
          console.log(e);
        }
    }

    teardown = () => {
       this.unsubscribe(this.observedMessages);
    }


    attributeChangedCallback(name, oldValue, newValue) {
        // Call the parent's attributeChangedCallback to preserve its behavior
        super.attributeChangedCallback(name, oldValue, newValue);
        if (name === 'show-control') {
            this.container.style.display = 'flex';
        }
        if (name === 'message-id') {
          this.messageId = newValue;
        }
        if (name === 'filename') {
          this.filename = newValue;
        }
        if (name === 'no-loop') {
          this.noLoop = true;
        }
    }

    workletCode = `
class SamplePlayerProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: 'playbackRate',
        defaultValue: 1.0,
        minValue: -16.0,
        maxValue: 16.0,
        automationRate: 'a-rate'
      },
      {
        name: 'noLoop',
        defaultValue: true 
      }
    ];
  }

  constructor() {
      super();
      this.channelData = [];
      this.sampleRate = 44100;
      this.length = 0;
      this.position = 0;
      this.playing = true;

      this.port.onmessage = (event) => {
        const { type, channelData, sampleRate, length } = event.data;
        if (type === 'sample-data') {
            this.channelData = channelData.map(arr => new Float32Array(arr));
            this.sampleRate = sampleRate;
            this.length = length;
            this.position = 0;
        }
        if (event.data.hasOwnProperty('playing')) {
            this.playing = !!event.data.playing;
        }
      };
  }

  process(inputs, outputs, parameters) {
    if (!this.channelData.length) return true;
    if (!this.playing) return true;

    const output = outputs[0];
    const rateParam = parameters.playbackRate;
    const numChannels = output.length;

    for (let i = 0; i < output[0].length; i++) {
      const rate = rateParam.length > 1 ? rateParam[i] : rateParam[0];

      for (let ch = 0; ch < numChannels; ch++) {
        const data = this.channelData[ch % this.channelData.length];
        const idx = Math.floor(this.position) % this.length;
        const sample = data[(idx + this.length) % this.length];
        output[ch][i] = sample;
      }
    
      this.position += rate;

      // Loop
      if (parameters.noLoop) {
          if (this.position >= this.length) {
              this.position = 0 ;
              this.playing = false;
          }
          if (this.position < 0) {
              this.position = this.length - 1;
              this.playing = false;
          }
      } else {
          if (this.position >= this.length) {
              this.position = 0 ;
              this.playing = true;
          }
          if (this.position < 0) {
              this.position = this.length - 1;
              this.playing = true;
          }
      }     
    }

    return true;
  }
}

registerProcessor('sample-player', SamplePlayerProcessor);
`;
}

