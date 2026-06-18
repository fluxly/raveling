import { RavelElement } from '../../../base/ravel-element/src/RavelElement.js';
import { RavelMessages } from '../../../../../modules/RavelMessages.js';
import globalStyles from '../../../../common/global-styles.js';

export class RavelSignalCollector extends RavelElement {
    static get localStyles() {
        return `
        <style>
        #assembly {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
        }
        #container {

            display: flex;
            flex-direction: column;
            padding: 20px;
            justify-content: center;
            align-items: center;
            border-radius: 20px;
            max-width: 500px;
            background-color: #ffffff;
        }
        #content {
            display: flex;
            flex-wrap: wrap;
            max-width: 400px;
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
        </style>
        `;
    }
  
    static get html() { 
        return `
        <ravel-assembly id="assembly" docked dock-target="collectors" icon="🏡" label="signal-collector">
        <div id="container">
        <div id="content">
            <ravel-signal icon="❌"></ravel-signal>
            <ravel-signal icon="⚡"></ravel-signal>
            <ravel-signal icon="🔴"></ravel-signal>
            <ravel-signal icon="🟠"></ravel-signal>
            <ravel-signal icon="🟡"></ravel-signal>
            <ravel-signal icon="🟢"></ravel-signal>
            <ravel-signal icon="🔵"></ravel-signal>
            <ravel-signal icon="🟣"></ravel-signal>
            <ravel-signal icon="⚪️"></ravel-signal>
            <ravel-signal icon="🟤"></ravel-signal>
            <ravel-signal icon="🟥"></ravel-signal>
            <ravel-signal icon="🟧"></ravel-signal>
            <ravel-signal icon="🟨"></ravel-signal>
            <ravel-signal icon="🟩"></ravel-signal>
            <ravel-signal icon="🟦"></ravel-signal>
            <ravel-signal icon="🟪"></ravel-signal>
            <ravel-signal icon="⬜️"></ravel-signal>
            <ravel-signal icon="🟫"></ravel-signal>
            <slot></slot>
        </div>
        </div>
        </ravel-assembly>
        `;
    }
 
    static get observedAttributes() { 
        return [...super.baseObservedAttributes];
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
        for (let child of this.shadowRoot.querySelector('slot').assignedElements()) {
            this.shadowRoot.querySelector('#content').appendChild(child);
        }
        this.shadowRoot.querySelector('slot').remove();
        let count = 0;
        for (let child of this.shadowRoot.querySelector('#content').children) {
            let icon = child.getAttribute('icon');
            RavelMessages.signalList[icon] = count;
            if (child.getAttribute('value')) {
                RavelMessages.signalList[icon] = child.getAttribute('value');
            }
            count++;   
        }
        this.addEventListener('signal', this.handleEvent);
    }
    
    disconnectedCallback() {
        this.teardown();
    }
    
    initialize() {
        RavelMessages.signalList = {};
    }
  
    setup = () => {
        this.observedMessages = ['signal'];
        this.subscribe(this.observedMessages);   
    }
    
    teardown = () => {
        this.unsubscribe(this.observedMessages);
    }

    handleEvent = (evt) => {
        // console.log(evt.detail.cmd + ' : ' + evt.detail.content);
        RavelMessages.signalList[evt.detail.cmd] = evt.detail.content;
        console.log(RavelMessages.signalList[evt.detail.cmd]);
    }

    getPicklist = () => {
        let htmlString = '';
        for (let key in RavelMessages.signalList) {
            htmlString += `<option value="${key}">${key}</option>`;
        }
        return `<select name="signal-list">${htmlString}</select>`;
    }

    attributeChangedCallback(name, oldValue, newValue) {
        // Call the parent's attributeChangedCallback to preserve its behavior
        super.attributeChangedCallback(name, oldValue, newValue);
        
        
    }
}

