import { RavelElement } from '../../../base/ravel-element/src/RavelElement.js';
import globalStyles from '../../../../common/global-styles.js';

export class RavelVisualizer2 extends RavelElement {
    static get localStyles() {
        return `
        <style>
        #container {
            position: absolute;
            cursor: pointer;
            user-select: none;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        #screen {
            position: absolute;
            width: 100%;
            height: 100%;
        }
        #sensor {
            position: absolute;
            background-color: rgba(255, 255, 0, 0.5);
            border-radius: 24px;
        }
        #waveform {
            position: absolute;
        }
        .pixelArt {
            position: absolute;
        }
        .transparent {
            background-color: rgba(255, 255, 255, 0);
        }
        .light-pixel {
            background-color: #aaaaaa;
        }
        .dark-pixel {
            background-color: #000000;
        }
        .color-pixel {
            background-color: #FFFF00;
        }
        .shadow {
            height: 10%;
            opacity: 0.5;
            background-color: #000000;
        }
        @-webkit-keyframes pulse {
          to {
            -webkit-transform: scale(1.1);
            transform: scale(1.1);
          }
        }
        @keyframes pulse {
          to {
            -webkit-transform: scale(1.1);
            transform: scale(1.1);
          }
        }
        .pulse {
          display: inline-block;
          vertical-align: middle;
          -webkit-transform: perspective(1px) translateZ(0);
          transform: perspective(1px) translateZ(0);
          box-shadow: 0 0 1px rgba(0, 0, 0, 0);
         -webkit-animation-name: pulse;
          animation-name: pulse;
          -webkit-animation-duration: 0.3s;
          animation-duration: 0.3s;
          -webkit-animation-timing-function: linear;
          animation-timing-function: linear;
          -webkit-animation-iteration-count: infinite;
          animation-iteration-count: infinite;
          -webkit-animation-direction: alternate;
          animation-direction: alternate;
        }
        </style>
        `;
    }
  
    static get html() { 
        return `
        <div id="container">
        <div id="screen">
            <div id="top-side" class="dark-pixel pixelArt"></div>
            <div id="left-side" class="dark-pixel pixelArt"></div>
            <div id="right-side" class="dark-pixel pixelArt"></div>
            <div id="bottom-side" class="dark-pixel pixelArt"></div>
            <div id="p5-container" class="light-pixel pixelArt">       
            </div>
            <div id="container-shadow" class="shadow pixelArt"></div>
        </div>
        </div>
        `;
    }
 
    static get observedAttributes() { 
        return [...super.baseObservedAttributes, 
            'w', 'h', 'color', 'pixel-size', 'signals', 'signal-out' ];
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
        this.teardown();
    }
    
    initialize() {
        this.container = this.shadowRoot.querySelector('#container');
        this.center = this.shadowRoot.querySelector('#p5-container');
        this.waveform = this.shadowRoot.querySelector('#waveform');
        this.x = 0;
        this.y = 0;
        this.width = 50;
        this.height = 50;
        this.pixelSize = 20;
        this.color = '#ff0000';
        this.audioBuffer = null;
        this.audioBuffer = null;
        this.playheadSample = null;
    }
  
    setup = () => {
        //this.observedMessages = ['message'];
        //this.subscribe(this.observedMessages);  
        this.container.style.top = `${this.y}px`;
        this.container.style.left = `${this.x}px`;
        this.container.style.width = `${this.width}px`;
        this.container.style.height = `${this.height}px`;
        this.buildScreen();
        this.center.style.backgroundColor = `${this.color}`;
        
        this.p5instance = new p5((p) => this.sketch1(p));
        //this.p5instance = new p5(this.sketch1); 
    
    }
    
    buildScreen = () => {
        let innerW = this.width - this.pixelSize * 2;
        let innerH = this.height - this.pixelSize * 2;
        let centerW = innerW;
        this.innerMax = centerW;

        console.log(`${innerW} ${innerH}`);
        this.setPixelDimensions('top-side', innerW, this.pixelSize);
        this.setPixelDimensions('left-side', this.pixelSize, innerH);
        this.setPixelDimensions('bottom-side', innerW, this.pixelSize);
        this.setPixelDimensions('right-side', this.pixelSize, innerH );
        this.setPixelDimensions('p5-container', centerW, innerH);
        this.setPixelDimensions('container-shadow', innerW, this.pixelSize);

        this.setPixelPosition('top-side', this.pixelSize, 0);
        this.setPixelPosition('left-side', 0, this.pixelSize);
        this.setPixelPosition('bottom-side', this.pixelSize, innerH + this.pixelSize);
        this.setPixelPosition('right-side', innerW + this.pixelSize, this.pixelSize);
        this.setPixelPosition('p5-container', this.pixelSize, this.pixelSize);
        this.setPixelPosition('container-shadow', this.pixelSize, innerH);
    }

    setPixelDimensions = (id, w, h) => {
        this.shadowRoot.querySelector(`#${id}`).style.width = `${w}px`;
        this.shadowRoot.querySelector(`#${id}`).style.height = `${h}px`;
    }

    setPixelPosition = (id, x, y) => {
        this.shadowRoot.querySelector(`#${id}`).style.top = `${y}px`;
        this.shadowRoot.querySelector(`#${id}`).style.left = `${x}px`;
    }

    setBuffer(buffer) {
        this.audioBuffer = buffer;
        this.p5instance.redraw();
    }

    setPosition(sampleIndex) {
        this.playheadSample = sampleIndex;
        this.p5instance.redraw();
    }

    teardown = () => {
       // this.unsubscribe(this.observedMessages);
    }

    attributeChangedCallback(name, oldValue, newValue) {
        // Call the parent's attributeChangedCallback to preserve its behavior
        super.attributeChangedCallback(name, oldValue, newValue);
        if (name === 'signals') {
            this.signals = newValue.split(',');
        }
        if (name === 'signal-out') {
            this.signalOut = newValue;
        }
        if (name === 'no-click') {
            this.noClick = true;
        }
        if (name === 'color') {
            this.color = newValue;
        }
        if (name === 'pixel-size') {
            this.pixelSize = Number(newValue);
        }
    }

    sketch1 = (p) => {
        p.setup = () => {
            const canvas = p.createCanvas(this.width - this.pixelSize * 2, this.height - this.pixelSize * 2);
            canvas.parent(this.shadowRoot.querySelector('#p5-container'));
            canvas.style('visibility', 'visible');
            p.frameRate(30); // update at 30fps
        };

        p.draw = () => {
            p.background(this.color);

            if (!this.audioBuffer) {
                p.fill(this.color);
                p.textAlign(p.CENTER, p.CENTER);
                p.text("No audio loaded", p.width / 2, p.height / 2);
                return;
            }

            const channelData = this.audioBuffer.getChannelData(0);
            const step = Math.ceil(channelData.length / p.width);
            const midY = p.height / 2;

            p.noStroke();

            // Draw waveform
            for (let x = 0; x < p.width; x++) {
                const sliceStart = x * step;
                let min = 1.0, max = -1.0;
                for (let i = 0; i < step; i++) {
                    const s = channelData[sliceStart + i] || 0;
                    if (s < min) min = s;
                    if (s > max) max = s;
                }
                const y1 = midY + min * midY;
                const y2 = midY + max * midY;
                let squiggleMax = 2;
                let squiggle = (Math.random() * squiggleMax) - (squiggleMax / 2);
                p.noFill();
                p.stroke(25, 25, 25);
                p.rect(x, y1 + squiggle, 1, y2 - y1 + squiggle);
            }

            // Draw playhead (yellow)
            if (this.playheadSample != null) {
                const playheadX = Math.floor(this.playheadSample / step);
                if (playheadX >= 0 && playheadX < p.width) {
                    const sliceStart = playheadX * step;
                    let min = 1.0, max = -1.0;
                    for (let i = 0; i < step; i++) {
                        const s = channelData[sliceStart + i] || 0;
                        if (s < min) min = s;
                        if (s > max) max = s;
                    }
                    const y1 = midY + min * midY;
                    const y2 = midY + max * midY;
                    p.noStroke();
                    p.fill(255, 255, 255, 100); // yellow
                    //p.rect(playheadX, y1-10, 3, y2 - y1 + 10);
                    p.circle(playheadX, midY, y2 - y1);
                    p.circle(playheadX, midY, (y2 - y1) / 2);
                    p.circle(playheadX, midY, 4);
                }
            }
        }
    }   
}