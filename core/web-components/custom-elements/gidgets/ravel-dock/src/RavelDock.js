import { RavelElement } from '../../../base/ravel-element/src/RavelElement.js';
import globalStyles from '../../../../common/global-styles.js';
import  { RavelMessages }  from '../../../../../modules/RavelMessages.js';

export class RavelDock extends RavelElement {
    static get localStyles() {
        return `
        <style>
        #container {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            border-radius: 20px;
            width: 100%;
            height: 100%;
        }
        #content {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            max-width: 100%;
        }
        .content > ravel-signal {
            flex: 1 1 50px;
        }
        #icon {
            font-size: 48px;
        }
        #label {
            font-size: 24px;
        }
        .dock-item {
            font-size: 24px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            padding: 10px;
        }
        .dock-item-icon {
            font-size: 32px;
             pointer-events: auto; 
        }
        .dock-item-label {
            font-size: 14px;
        }
        </style>
        `;
    }
  
    static get html() { 
        return `
        <div id="container">
        <div id="icon">🍔</div>
        <div id="label"></div>
        <div id="content">
        </div>
        </div>
        `;
    }
 
    static get observedAttributes() { 
        return [...super.baseObservedAttributes, 'rows', 'cols'];
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
        this.rows = 1;
        this.cols = 1;
    }
  
    setup = () => {
        this.observedMessages = [`${this.label}`];
        this.subscribe(this.observedMessages);   
        this.addEventListener(`${this.label}`, this.handleDockEvent);
        this.shadowRoot.querySelector('#label').innerHTML = `${this.label}`;
        this.shadowRoot.querySelector('#icon').innerHTML = `${this.icon}`;
    }
    
    teardown = () => {
        this.unsubscribe(this.observedMessages);
        this.removeEventListener(`${this.name}`, this.handleDockEvent);
    }

    handleDockEvent = (evt) => {
        
        if (evt.detail.cmd === 'register') {
            let div = document.createElement('div');
            div.innerHTML = `
            <div id="dock-item-${evt.detail.content.label}" class="dock-item-icon">${evt.detail.content.icon}</div>
            <div class="dock-item-label">${evt.detail.content.label}</div>
            `;
            div.classList.add('dock-item');
            this.shadowRoot.querySelector('#content').appendChild(div);
            div.addEventListener('click', (e) => {
                console.log('click ' + evt.detail.content.label);
                RavelMessages.sendMessage(`${evt.detail.content.label}`, 'maximize', '');
            });
        }
        if (evt.detail.cmd === 'minimize') {

        }
        if (evt.detail.cmd === 'maximize') {

        }
    }

    attributeChangedCallback(name, oldValue, newValue) {
        // Call the parent's attributeChangedCallback to preserve its behavior
        super.attributeChangedCallback(name, oldValue, newValue);
        
        if (name === 'rows') {
            this.rows = parseInt(newValue, 10);
        }
        if (name === 'cols') {
            this.cols = parseInt(newValue, 10);
        }
        if (name === 'w') {
            
        }
        if (name === 'h') {
            
        }
       
    }
}
