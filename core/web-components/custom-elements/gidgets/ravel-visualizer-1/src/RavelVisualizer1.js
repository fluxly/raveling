import { RavelElement } from '../../../base/ravel-element/src/RavelElement.js';
import globalStyles from '../../../../common/global-styles.js';

export class RavelVisualizer1 extends RavelElement {
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
        this.padding = 10;
        this.color = '#ff0000';
        this.analyser = null; 
        this.dataArray = null;
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

    setAnalyser(analyser) {
        this.analyser = analyser;
        this.dataArray = new Uint8Array(analyser.fftSize);
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
            p.frameRate(15); 
            console.log('setup!');
        };

        p.draw = () => {
            p.background(this.color);
            if (this.analyser && this.dataArray) {
                //let midY = p.height / 2;
                this.analyser.getByteTimeDomainData(this.dataArray);
                //p.noStroke();
                //p.fill(0, 255, 0);
                p.stroke(0, 255, 0);
                p.strokeWeight(2);
                p.noFill();
                p.beginShape();
                for (let i = 0; i < this.dataArray.length; i++) {
                    const x = p.map(i, 0, this.dataArray.length, 0, p.width);
                    const y = p.map(this.dataArray[i], 0, 255, 0, p.height - this.padding);
                    p.vertex(x, y);
                    //p.rect(x, (midY), 1, (y - (midY)) * 1.5, 20);
                }
                p.endShape();
            } else {
                p.fill(25);
                p.textAlign(p.CENTER, p.CENTER);
                p.text("No analyser connected", p.width / 2, p.height / 2);
            }
        }
    }   
}