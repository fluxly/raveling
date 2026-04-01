import { RavelElement } from '../../../base/ravel-element/src/RavelElement.js';
import globalStyles from '../../../../common/global-styles.js';
import { componentPath } from '../../../../common/RavelComponentPath.js';

export class RavelButton extends RavelElement {
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
        #button-background {
            position: absolute;
            width: 100%;
            height: 100%;
        }
        #sensor {
            position: absolute;
            border-radius: 24px;
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
        #shadow {
            opacity: 0.5;
            background-color: #000000;
        }
        #button-image img {
            margin-left: 20%;
            margin-top: 15%;
            width: 60%;
            height: 60%;
        }
        #handle-container {
            position: absolute;
        }
            @-webkit-keyframes pulse {
          to {
            -webkit-transform: scale(1.1);
            transform: scale(1.1);
          }
        }
        @keyframes pulse {
          to {
            -webkit-transform: scale(.8);
            transform: scale(.8);
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
          -webkit-animation-duration: 0.1s;
          animation-duration: 0.1s;
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
        <div id="sensor"></div>
        <div id="button-background">
            <div id="top-side" class="dark-pixel pixelArt"></div>
            <div id="left-side" class="dark-pixel pixelArt"></div>
            <div id="right-side" class="dark-pixel pixelArt"></div>
            <div id="bottom-side" class="dark-pixel pixelArt"></div>            
            <div id="center" class="light-pixel pixelArt">
                    <div id="button-image"></div>
            </div>
            <div id="shadow" class="pixelArt"></div>
        </div>
        </div>
        `;
    }
 
    static get observedAttributes() { 
        return [...super.baseObservedAttributes, 
            'size', 'w', 'h', 'image',
            'color', 'pixel-size', 'margin',
            'value', 'signals', 'signal-out'];
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
        this.buttonBackground = this.shadowRoot.querySelector('#button-background');
        this.sensor = this.shadowRoot.querySelector('#sensor');
        this.signals = [];
        this.value = 0;
        this.noClick = false;
        this.showFeedback = false;
        this.x = 0;
        this.y = 0;
        this.width = 50;
        this.height = 50;
        this.pixelSize = 20;
        this.image = null;
        this.offsetX = 0;
        this.offsetY = 0;
        this.margin = 0;
        this.color = '#ff0000';
    }
  
    setup = () => {
        this.observedMessages = [`${this.id}`];
        this.subscribe(this.observedMessages);
        this.subscribe(this.signals);  
        this.container.style.top = `${this.y}px`;
        this.container.style.left = `${this.x}px`;
        this.container.style.width = `${this.width}px`;
        this.container.style.height = `${this.height}px`;
        this.buildButton();

        this.sensor.style.width = `${this.width + this.pixelSize * 2}px`;
        this.sensor.style.height = `${this.height + this.pixelSize * 2}px`;

        if (this.image) {
            this.shadowRoot.querySelector('#button-image').innerHTML = `<img src="${componentPath}/${this.image}"/>`;
            console.log(`<img src="${componentPath}/${this.image}/>`);
        }

        this.shadowRoot.querySelector('#center').style.backgroundColor = this.color;
        //const rect = this.container.getBoundingClientRect();
        //this.centerX = rect.left + rect.width / 2;
        //this.centerY = rect.top + rect.height / 2;
        if (!this.noClick) {
            this.addEventListener('pointerdown', this.handleClick);
        }
        this.addEventListener(`${this.id}`, this.handleEvent);
        //this.broadcastMessage('register-sensor', this.id, { x: rect.x, y: rect.y, w: this.w, h: this.height });
        this.broadcastMessage('register-sensor', this.id, this.container);
        
    }

    handleClick = (e) => {
        e.preventDefault();
        // Update center values dynamically in case layout shifted
        this.calculateValue(e.clientX);
        this.container.classList.add('pulse');
        setTimeout(() => {
            this.container.classList.remove('pulse');
        }, 200);
        document.addEventListener('pointermove', this.dragElement);
        document.addEventListener('pointerup', this.endDragElement);
        document.addEventListener('pointerleave', this.endDragElement);
    }

    dragElement = (e) => {
        e.preventDefault();
        this.calculateValue(e.clientX + this.offsetX);
    }

    endDragElement = () => {
        document.removeEventListener('pointermove', this.dragElement);
        document.removeEventListener('pointerup', this.endDragElement);
        document.removeEventListener('pointerleave', this.endDragElement);
    }

    handleEvent = (e) => {
        e.preventDefault();
        const type = e.detail.cmd;
        console.log(type);
        if (type === 'select') {
            this.sensor.style.backgroundColor = 'rgba(255, 255, 0, 0.5)';
        }
        if (type === 'unselect') {
            this.sensor.style.backgroundColor = 'rgba(255, 255, 255, 0)';
        }
        if (type === 'virtual-click') {
            this.offsetX = Number(e.detail.content.offsetX);
            this.offsetX = Number(e.detail.content.offsetY);
            const rect = this.container.getBoundingClientRect();
            this.calculateValue(e.clientX - rect.x);
            this.container.classList.add('pulse');
            setTimeout(() => {
                this.container.classList.remove('pulse');
            }, 200);
            document.addEventListener('pointermove', this.dragElement);
            document.addEventListener('pointerup', this.endDragElement);
            document.addEventListener('pointerleave', this.endDragElement);
        }
        if (type === 'virtual-drag') {
            this.calculateValue(e.clientX, e.clientY);
        }
        if (type === 'virtual-release') {
            this.offsetX = 0;
            this.offsetY = 0;
            document.removeEventListener('pointermove', this.dragElement);
            document.removeEventListener('pointerup', this.endDragElement);
            document.removeEventListener('pointerleave', this.endDragElement);
        }
    }

    
    teardown = () => {
        this.unsubscribe(this.signals);
        this.broadcastMessage('register-sensor', this.id);
        if (!this.noClick) {
            this.removeEventListener('pointerdown', this.handleClick);
        }
        this.removeEventListener(`${this.id}`, this.handleEvent);
    }
    
    calculateValue = (x, y) => {
    }

    buildButton = () => {
        let innerW = this.width - this.pixelSize * 2;
        let innerH = this.height - this.pixelSize * 2;
        let centerW = innerW - this.margin * 2;
        this.innerMax = centerW - this.margin;

        console.log(`${innerW} ${innerH}`);
        this.setPixelDimensions('top-side', innerW, this.pixelSize);
        this.setPixelDimensions('left-side', this.pixelSize, innerH);
        this.setPixelDimensions('bottom-side', innerW, this.pixelSize);
        this.setPixelDimensions('right-side', this.pixelSize, innerH );
        this.setPixelDimensions('center', centerW, innerH);
        this.setPixelDimensions('shadow', innerW, this.pixelSize);

        this.setPixelPosition('top-side', this.pixelSize, 0);
        this.setPixelPosition('left-side', 0, this.pixelSize);
        this.setPixelPosition('bottom-side', this.pixelSize, innerH + this.pixelSize);
        this.setPixelPosition('right-side', innerW + this.pixelSize, this.pixelSize);
        this.setPixelPosition('center', this.margin + this.pixelSize, this.pixelSize);
        this.setPixelPosition('shadow', this.pixelSize, innerH);
    }

    setPixelDimensions = (id, w, h) => {
        this.shadowRoot.querySelector(`#${id}`).style.width = `${w}px`;
        this.shadowRoot.querySelector(`#${id}`).style.height = `${h}px`;
    }

    setPixelPosition = (id, x, y) => {
        this.shadowRoot.querySelector(`#${id}`).style.top = `${y}px`;
        this.shadowRoot.querySelector(`#${id}`).style.left = `${x}px`;
    }
    
    attributeChangedCallback(name, oldValue, newValue) {
        // Call the parent's attributeChangedCallback to preserve its behavior
        super.attributeChangedCallback(name, oldValue, newValue);
        if (name === 'size') {
            this.size = Number(newValue);
        }
        if (name === 'x') {
            this.x = Number(newValue);
        }
        if (name === 'y') {
            this.y = Number(newValue);
        }
        if (name === 'src') {
            this.src = newValue;
        }
        if (name === 'image') {
            this.image = newValue;
        }
        if (name === 'w') {
            this.width = Number(newValue);
            console.log(this.width);
        }
        if (name === 'h') {
            this.height = Number(newValue);
            console.log(this.height);
        }
        if (name === 'orientation') {
            this.orientation = newValue;
        }
        if (name === 'value') {
            this.value = Number(newValue);
        }
        if (name === 'signals') {
            this.signals = newValue.split(',');
        }
        if (name === 'signal-out') {
            this.signalOut = newValue;
        }
        if (name === 'no-click') {
            this.noClick = true;
        }
        if (name === 'show-feedback') {
            this.showFeedback = true;
        }
        if (name === 'color') {
            this.color = newValue;
        }
        if (name === 'pixel-size') {
            this.pixelSize = Number(newValue);
        }
        if (name === 'margin') {
            this.margin = Number(newValue);
        }
    }

    map = (val, in_min, in_max, out_min, out_max) => {
        return (val - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
    }
}
