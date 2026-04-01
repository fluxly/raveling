import  { RavelMessages }  from '../../../../../modules/RavelMessages.js';

export class RavelElement extends HTMLElement {
	static get baseStyles() {
        return `
        <style>
		#container {
		    pointer-events: auto;
		}
		#controls-container {
		    margin: 20px 10px;
		    display: flex;
			justify-content: space-between;
			align-items: center;
		    font-size: 14px;
			background-color: #ffffff;
		}
		#signals-in, #signals-out {
		    margin-right: 10px;
		}
		#controls-container {
		    display:none;
		}
        </style>
        `;
    }
  
    static get baseHtml() { 
        return `
    <div id="controls-container">
    <div id="signals-in" class="control">⭕</div>
	<div id="signals-out" class="control">⭕</div>
	<!--<div id="streams" class="control">⭕</div>-->
    </div>
    `;
    }

	constructor() {
		super();
        this.dockTarget = '';
		this.name = '';
		this.icon = '';
		this.signalsIn = [];
		this.signalsOut = [];
		this.streams = [];
		this.docked = false;
		this.showControls = false;
		this.messageOnClick = [];
		window.addEventListener('load', this.onPageLoaded);
	}
	
	static get baseObservedAttributes() { 
        return [ 'icon', 'label', 'type', 'show-close', 'show-controls',
				 'docked', 'dock-target', 'state', 'size', 'theme',
			     'positioned', 'width', 'height', 'x', 'y', 'scale', 
				 'no-click', 'show-feedback', 'virtual-click', 'virtual-drag', 'virtual-release',
				 'message-on-click', 'signals-in', 'signals-out', 'streams',
				'role', 'aria-roledescription', 'tabindex', 'aria-label', 'aria-description'
		];
    }

	sendMessage(msg, cmd, content) {
        RavelMessages.sendMessage(msg, cmd, content);
	}

	broadcastMessage(msg, cmd, content) {
        let evt = new CustomEvent(msg, { detail: { cmd: cmd, content: content }});
        window.dispatchEvent(evt);
	}

	subscribe(msgList) {
        for (let msg of msgList) {
            RavelMessages.subscribe(msg, this);
		}
	}
	
	unsubscribe(msgList) {
		for (let msg of msgList) {
			RavelMessages.unsubscribe(msg, this);
		}
	}

	onPageLoaded = () => {
	    this.updateSignals();
	}

	handleMessageOnClick = () => {
		console.log('message-on-click!');
		if (this.messageOnClick.length > 0) {
			this.sendMessage(this.messageOnClick[0], this.messageOnClick[1], this.messageOnClick[2]);
			console.log(`${this.messageOnClick[0]}, ${this.messageOnClick[1]}, ${this.messageOnClick[2]}`);
		}
	}

	updateSignals = () => {
		this.removeDuplicateSignals();
		/*if (this.signalsIn.length > 0) {
			this.shadowRoot.querySelector('#signals-in').innerHTML = '';
		}
		for (let inputIcon of this.signalsIn) {
			this.shadowRoot.querySelector('#signals-in').innerHTML += this.checkSignal(inputIcon);
		}
		if (this.signalsOut.length > 0) {
			this.shadowRoot.querySelector('#signals-out').innerHTML = '';
		}
		for (let outputIcon of this.signalsOut) {
			this.shadowRoot.querySelector('#signals-out').innerHTML += this.checkSignal(outputIcon);
		}
		*/
	}


	checkSignal = (signalIcon) => {	
		if (signalIcon) {
			if (RavelMessages.signalList[signalIcon])  {
				return signalIcon;
			} else {
				return '❌';
			}
		}
	}

	removeDuplicateSignals = () => {

	}

	checkStream = (streamIcon) => {
		return streamIcon;
	}

	attributeChangedCallback(name, oldValue, newValue) {
		if (name === 'icon') {
			this.icon = newValue;
		}
		if (name === 'label') {
			this.label = newValue;
		}
		if (name === 'docked') {
			this.docked = true;
		}
		if (name === 'dock-target') {
			this.dockTarget = newValue;
		}
		if (name === 'width') {
            this.width = Number(newValue);
        }
        if (name === 'height') {
            this.height = Number(newValue);
        }
		if (name === 'size') {
            this.size = Number(newValue);
        }
        if (name === 'x') {
            this.x = Number(newValue);
        }
        if (name === 'y') {
            this.y = Number(newValue);
        }
		if (name === 'message-on-click') {
			this.messageOnClick = newValue.split(',');
		}
		if (name === 'signals-in') {
			this.signalsIn = newValue.split(',');
		}
		if (name === 'signals-out') {
			this.signalsOut = newValue.split(',');
		}
		if (name === 'streams') {
			this.streams = newValue.split(',');
		}
		if (name === 'show-controls') {
			this.showControls = true;
		}
	}

} 