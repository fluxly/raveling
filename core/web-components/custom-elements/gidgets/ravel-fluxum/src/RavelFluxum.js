import { RavelElement } from '../../../base/ravel-element/src/RavelElement.js';
import globalStyles from '../../../../common/global-styles.js';
import { RavelEmoji } from '../../../../../modules/RavelEmoji.js';
import { RavelUtilities } from '../../../../../modules/RavelUtilities.js';

export class RavelFluxum extends RavelElement {
    static get localStyles() {
        return `
        <style>
        #bubble-container {
            position: absolute;
            opacity: 1.0;
            display: none;
        }
        #container {
            position:absolute;
        }
        #bubble {
            font-family: "Silkscreen";
            font-size: 10;
            color: #333333;
            background-color: #ffffff;
            padding:4px 10px 4px 10px;
            border: 3px solid #ffeebb;
            border-radius: 12px;
        }
        #bubble-stem {
            position: absolute;
            top: 90%;
            left: 10%;
            width: 10px;
            height: 10px;
            background-color: #ffffff;
            border-left: 3px solid #ffeebb;
            border-right: 3px solid #ffeebb;
            border-bottom: 3px solid #ffeebb;
            border-bottom-left-radius: 100%;
            border-bottom-right-radius: 100%;
        }
        #eyes-closed {
            display:none;
        }
        .green-glow {
            background-color: rgba(45,255,196,0.5);
            box-shadow: 0px 0px 20px 20px rgba(45,255,196,0.5);
        }
        .red-glow {
            background-color: rgba(255,0,0,0.5);
            box-shadow: 0px 0px 20px 20px rgba(255,0,0,0.5);
        }
        .yellow-glow {
            background-color: rgba(255,255,0,0.5);
            box-shadow: 0px 0px 20px 20px rgba(255,255,0,0.5);
        }
        </style>
        `;
    }
  
    static get html() { 
        return `
        <div id="container" >
        <div id="icon">🐹</div>
        </div>
        <div id="bubble-container">
        <div id="bubble">Hello World 😶🐵😑</div>
        <div id="bubble-stem"></div>
        </div>
        `;
    }
 
    static get observedAttributes() { 
        return [...super.baseObservedAttributes, 'icon', 'size', 
            'x', 'y', 'angle', 'show-hint',
            'bubble-text-size', 'color', 'use-svg'];
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
        this.icon = this.shadowRoot.querySelector('#icon');
        this.bubble = this.shadowRoot.querySelector('#bubble-container');
        this.angle = 0;
        this.prevAngle = 0;
        this.useEmbeddedSvg = false;
        this.showHint = false;
    }
  
    setup = () => {
        this.observedMessages = ['message'];
        this.icon.style['font-size'] = `${this.size}px`;
        this.icon.style['line-height'] = `${this.size}px`;
        this.container.style.top = `${this.y - (this.size / 2)}px`;
        this.container.style.left = `${this.x - (this.size / 2)}px`;
        this.container.style['border-radius'] = `${this.size}px`;
        this.container.style.width = `${this.size}px`;
        this.container.style.height = `${this.size}px`;
        this.container.style.transform = `rotate(${this.angle}deg)`;
        this.bubble.style.left = `${this.x}px`;
        this.bubble.style.top = `${this.y - 60}px`;
        if (this.useEmbeddedSvg) {
            this.icon.innerHTML = this.svg;
            console.log(this.shadowRoot.querySelector('#fluxum-svg'));
            this.shadowRoot.querySelector('#fluxum-svg').style.width = `${this.size}px`;
            this.shadowRoot.querySelector('#fluxum-svg').style.height = `${this.size}px`;
            this.shadowRoot.querySelector('#fluxum-svg').querySelector('#fluxum-background-1').style.fill = `${this.color}`;
            this.shadowRoot.querySelector('#fluxum-svg').querySelector('#fluxum-background-2').style.fill = `${this.color}`;
        }
        if (this.color) {
            this.container.style.backgroundColor = RavelUtilities.convertHexToRgbaColor(this.color, 0.5);
            this.container.style.boxShadow = `0px 0px 20px 20px ${RavelUtilities.convertHexToRgbaColor(this.color, 0.5)}`;
        }
        if (this.showHint) {
            console.log('show-hint');
            this.shadowRoot.querySelector('#bubble-container').style.display = 'block';
        }
        this.subscribe(this.observedMessages);   
    }
    
    teardown = () => {
       // this.unsubscribe(this.observedMessages);
    }
    
    transform(x, y, angle) {
        this.x = x;
        this.y = y;
        if (x >= 0) this.container.style.top = `${this.y}px`;
        if (y >= 0) this.container.style.left = `${this.x}px`;
        this.container.style.transform = `rotate(${angle}rad)`;
        this.bubble.style.left = `${this.x}px`;
        this.bubble.style.top = `${this.y - 60}px`;
        this.prevAngle = angle;
    }
    
    attributeChangedCallback(name, oldValue, newValue) {
        // Call the parent's attributeChangedCallback to preserve its behavior
        super.attributeChangedCallback(name, oldValue, newValue);
        if (name === 'x') {
            this.x = Number(newValue);
        }
        if (name === 'y') {
            this.y = Number(newValue);
        }
        if (name === 'color') {
            this.color = newValue;
        }
        if (name === 'angle') {
            this.angle = Number(newValue);
        }
        if (name === 'icon') {
            this.overlay.innerText = RavelEmoji[newValue];
        } 
        if (name === 'size') {
            this.size = parseInt(newValue, 10);
        }
        if (name === 'bubble-text-size') {
            this.bubble.style['font-size'] = `${newValue}px`;
        }
        if (name === 'use-svg') {
            this.useEmbeddedSvg = true;
        }
        if (name === 'show-hint') {
            this.showHint = true;
        }
    }

    svg = `
    <?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg
   width="52.724949mm"
   height="52.725464mm"
   viewBox="0 0 52.724949 52.725464"
   version="1.1"
   id="fluxum-svg"
   xml:space="preserve"
   inkscape:version="1.3.2 (091e20e, 2023-11-25)"
   sodipodi:docname="pixelated-fluxum-red.svg"
   xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
   xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
   xmlns="http://www.w3.org/2000/svg"
   xmlns:svg="http://www.w3.org/2000/svg"><sodipodi:namedview
     id="namedview1"
     pagecolor="#ffffff"
     bordercolor="#666666"
     borderopacity="1.0"
     inkscape:showpageshadow="2"
     inkscape:pageopacity="0.0"
     inkscape:pagecheckerboard="0"
     inkscape:deskcolor="#d1d1d1"
     inkscape:document-units="mm"
     inkscape:zoom="0.2973261"
     inkscape:cx="625.57576"
     inkscape:cy="1014.0381"
     inkscape:window-width="1400"
     inkscape:window-height="836"
     inkscape:window-x="0"
     inkscape:window-y="38"
     inkscape:window-maximized="0"
     inkscape:current-layer="layer1" /><defs
     id="defs1" /><g
     inkscape:label="Layer 1"
     inkscape:groupmode="layer"
     id="layer1"
     transform="translate(-12.903449,-37.37456)"><g
       id="g6"
       transform="translate(-17.797518,-48.498237)"><path
         id="fluxum-background-1"
         style="opacity:0.700741;fill:#f01400;fill-opacity:1;stroke-width:0.347006"
         d="M 46.273661,85.872795 V 101.446 H 30.700968 v 21.57957 h 15.572693 v 15.57269 H 67.853223 V 123.02557 H 83.425916 V 101.446 H 67.853223 V 85.872795 Z" /><path
         id="fluxum-background-2"
         style="opacity:1;fill:#f01500;fill-opacity:1;stroke-width:0.37625"
         d="m -91.100899,41.156661 h -5.228105 v -5.116484 h -31.813046 v 5.116484 h -5.2281 v 31.813045 h 5.2281 v 5.117001 h 31.813046 v -5.117001 h 5.228105 z"
         transform="rotate(-90)" /><g
         id="g20"
         transform="translate(-13.793077,-67.630569)"><path
           id="rect17"
           style="opacity:1;fill:#ffffff;fill-opacity:1;stroke-width:0.352777"
           d="m 76.418075,164.62716 v 1.72393 h -1.946652 v 1.50171 h -2.001945 v 14.68283 h 2.001945 v 1.50172 h 1.946652 v 1.72444 h 8.676473 v -1.72444 h 1.946651 v -1.50172 h 2.001945 V 167.8528 h -2.001945 v -1.50171 h -1.946651 v -1.72393 z" /><path
           id="rect16"
           style="opacity:1;fill:#ffffff;fill-opacity:1;stroke-width:0.352425"
           d="m 54.838513,168.52046 v 2.27997 h -1.723926 v 13.01471 h 1.723926 v 2.27996 h 10.567314 v -2.27996 h 1.723926 v -13.01471 h -1.723926 v -2.27997 z" /><rect
           style="opacity:1;fill:#000000;fill-opacity:1;stroke-width:0.352777"
           id="rect19"
           width="6.0066624"
           height="8.7875252"
           x="56.729588"
           y="173.19209" /><rect
           style="opacity:1;fill:#000000;fill-opacity:1;stroke-width:0.352777"
           id="rect20"
           width="9.0099936"
           height="10.567276"
           x="76.084389"
           y="170.85617" /></g></g></g></svg>

    `;
}

