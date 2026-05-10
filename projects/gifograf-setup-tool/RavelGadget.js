import { RavelElement } from '../../../base/ravel-element/src/RavelElement.js';
import globalStyles from '../../../../common/global-styles.js';
import { RavelMessages } from '../../../../../modules/RavelMessages.js';

export class RavelGadget extends RavelElement {
    static get localStyles() {
        return `
        <style>
        #container {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            border-radius: 20px;
            max-width: 500px;
            background-color: #ffffff;
        }
        #content {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            max-width: 460px;
            justify-content: space-around;
        }
        #connect-icon {
            font-size: 48px;
            width: 70px;
            height: 70px;
            text-align: center;
        }
        #uid {
            font-size: 24px;
        }
        #send, #send-button, #receive {
            width: 150px;
        }
        #local-controls-container {
            width: 120%;
            display: flex;
			justify-content: space-between;
			align-items: center;
		    font-size: 14px;
            position: relative;
            bottom: -80px;
            background-color: #ffffff;
            padding: 10px;
            border: 5px solid #eeeeee;
            border-radius: 20px;
        }
        #manual-comms {
            display: none;
        }
        </style>
        `;
    }
  
    static get html() { 
        return `
        <ravel-assembly id="gadget-assembly" show-controls="false">
        <div id="container">
        <div id="connect-icon">📠</div>
        <div id="content">
        <slot></slot>
        <div id="manual-comms">
        <input type="text" width="20" id="send"/>
        <button id="send-button">Send</button>
        <textarea cols="20" rows="1" id="receive"></textarea>
        </div>
        </div>
        <div id="uid"></div>
        <div id="local-controls-container">
            <div id="signals-in" class="control">⭕</div>
            <div id="signals-out" class="control">⭕</div>
            <!--<div id="streams" class="control">⭕</div>-->
        </div>
        </div>

        </ravel-assembly>
                
        `;
    }
 
    static get observedAttributes() { 
        return [...super.baseObservedAttributes, 'type', 'uid'];
    }

    constructor() {
        super();
        const template = document.createElement('template');
        template.innerHTML = globalStyles
            + this.constructor.localStyles
            + this.constructor.html
            + this.constructor.baseStyles;  
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
        this.advFilterList = [ { namePrefix: 'Ravel' } ];
        this.type = "ble";
        this.usbConnected = false;
        this.dockTarget = '';
        this.docked = true;
        this.icon = '📟';
        this.label = 'gadget';
        this.uid = '000000';
    }
  
    setup = () => {
        this.observedMessages = [`${this.label}`];
        this.subscribe(this.observedMessages);   
        if (this.type === 'ble') {
            this.shadowRoot.querySelector('#connect-icon').addEventListener('click', this.connectBle);
        }
        if (this.type === 'serial') {
            this.service = new WebSerialPort();
            if (this.service) {
                console.log('!!!!');
                this.service.on("ravel-gadget-data", this.serialRead);
            }
            this.shadowRoot.querySelector('#connect-icon').addEventListener('click', this.connectSerial);
        }
        this.shadowRoot.querySelector('#send-button').addEventListener('click', this.sendButton);
        this.addEventListener(`${this.label}`, this.handleEvents);
        if (this.label) this.shadowRoot.querySelector('#gadget-assembly').setAttribute('label', this.label);
        if (this.icon) this.shadowRoot.querySelector('#gadget-assembly').setAttribute('icon', this.icon);
        if (this.uid) this.shadowRoot.querySelector('#uid').innerHTML = this.uid;
        if (this.docked) this.shadowRoot.querySelector('#gadget-assembly').setAttribute('docked', true);
        console.log('gadet is docked ' + this.docked);
        if (this.dockTarget) this.shadowRoot.querySelector('#gadget-assembly').setAttribute('dock-target', this.dockTarget);
    }
    
    teardown = () => {
       this.unsubscribe(this.observedMessages);
       this.shadowRoot.querySelector('#connect-icon').removeEventListener('click', this.connect);
    }

    handleEvents = (evt) => {
        console.log(evt);
        if (evt.detail.cmd === 'maximize') this.shadowRoot.querySelector('#gadget-assembly').maximize();
    }

    connectBle = () => {
        console.log('connect-ble!');
		navigator.bluetooth.requestDevice({ 
			filters: this.advFilterList,
            optionalServices: [ 0xff00 ]   // All Ravel BLE Gadgets will have this service
			//acceptAllDevices: true       // To show all Bluetooth devices (comment out filters)
        })
        .then(device => {
             this.device = device;
             this.device.addEventListener('gattserverdisconnected', this.onDisconnected);
             return this.device.gatt.connect();
        })
        .then(server => server.getPrimaryService(0xff00))
        .then(service => service.getCharacteristics())
        .then(characteristics => this.subscribeToCharacteristics(characteristics))
        .then(() => {
            this.setConnectedStatus(true);
        })
        .catch(error => console.log('Connection failed!', error));
    }

    connectSerial = async () => {
        console.log('connect!');

        if (!this.usbConnected) {
            if (!this.service.port) {
                this.usbConnected = true;
                await this.service.openPort();
                if (this.service.port) this.setConnectedStatus(true);
            } 
        } else {
            this.usbConnected = false;
            if (this.service.port) {
                await this.service.closePort();
            } 
            this.setConnectedStatus(false);
        }
    }

    setConnectedStatus = (connected) => {
        if (connected) {
            this.shadowRoot.querySelector('#gadget-assembly').setAttribute('border-color', '#00ff00');
        } else {
            this.shadowRoot.querySelector('#gadget-assembly').setAttribute('border-color', '#eeeeee');
        }
    }

    subscribeToCharacteristics = (characteristics) => {
        for (let char of characteristics) {
            console.log(char.uuid);
            if (char.uuid.includes('fff1')) {
                this.writeCharacteristic = char;
            }
            if (char.uuid.includes('fff2')) {
                this.readCharacteristic = char;
                this.readCharacteristic.addEventListener('characteristicvaluechanged', this.readData);
                this.readCharacteristic.startNotifications();
            }
        }       
    }

    onDisconnected = (evt) => {
		this.writeCharacteristic = null;
		this.readCharacteristic = null;
        this.setConnectedStatus(false);
	     if (this.device) {
             this.device.removeEventListener('gattserverdisconnected', this.onDisconnected);
             if (this.device.gatt.connected) {
		        this.device.gatt.disconnect();
                this.device = null;
    		} 
        }
	}

    readData = (event, error) => {
        if (error) {
            console.log('error: ', error);
            return;
        }
        let valueToRead = event.target.value.getUint8(0);
        this.shadowRoot.querySelector('#receive').innerHTML = 'value: ' + valueToRead;
    }

    writeData = (data) => {
        if (this.device && this.device.gatt.connected) {
            let valueToSend = Uint8Array.of(data);
            if (this.writeCharacteristic) {
                console.log('sending ' + valueToSend);
                this.writeCharacteristic.writeValue(valueToSend);
            }
        }
    }

    sendButton = () => {
        this.writeData(this.shadowRoot.querySelector('#send').value);
    }

    attributeChangedCallback(name, oldValue, newValue) {
        // Call the parent's attributeChangedCallback to preserve its behavior
        super.attributeChangedCallback(name, oldValue, newValue);
        if (name === 'type') {
            this.type = newValue;
            console.log(this.type);
        }
        if (name === 'docked') {
            this.docked = true;
            console.log('docked' + this.docked);
        }
        if (name === 'dock-target') {
            this.dockTarget = newValue;
            console.log('target' + this.dockTarget);
        }
        if (name === 'uid') {
            this.uid = newValue;
        }
    }
}

class WebSerialPort {
    incomingSerialMessage = [];

    constructor() {
        // if webserial doesn't exist, return false:
        if (!navigator.serial) {
            alert("WebSerial is not enabled in this browser");
            return false;
        }
        this.autoOpen = true;
        //this.serialConnectCallback = this.serialConnect.bind(this);
        //this.serialDisconnectCallback = this.serialDisconnect.bind(this);
        this.port;
        this.reader;
        this.serialReadPromise;
        this.incoming = {
            data: null
        }
        // incoming serial data event:
        this.dataEvent = new CustomEvent('ravel-gadget-data', {
            detail: this.incoming,
            bubbles: true
        });

        // Note: Not currently implemented
        //navigator.serial.addEventListener("connect", this.serialConnectCallback);
        //navigator.serial.addEventListener("disconnect", this.serialDisconnectCallback);

        // Add the handler from the calling script as an event listener
        this.on = (message, handler) => {
            parent.addEventListener(message, handler);
        };
    }

    async openPort(thisPort) {
        try {
            if (thisPort == null) {
                // pop up window to select port:
                this.port = await navigator.serial.requestPort(
                    { filters: [ 
                    { // nrf52 default
                        usbVendorId: 0x2886,
                        usbProductId: 0x8045
                    },
                    { // esp32 default
                        usbVendorId: 0x303A,
                        usbProductId: 0x1001
                    }
                ] } 
                );
            } else {
                // open the port that was passed:
                this.port = thisPort;
            }
            // set port settings and open it:
            await this.port.open({ baudRate: 115200 });
            this.serialReadPromise = this.listenForSerial();

        } catch (err) {
            console.error("There was an error opening the serial port:", err);
        }
    }

    async closePort() {
        if (this.port) {
            // stop the reader, so you can close the port:
            this.reader.cancel();
            // wait for the listenForSerial function to stop:
            await this.serialReadPromise;
            // close the serial port itself:
            await this.port.close();
            // clear the port variable:
            this.port = null;
        }
    }

    async sendBytes(data) {
        // Data is a string here, for example "0801"
        // if there's no port open, skip this function:
        if (!this.port) return;
        // if the port's writable: 
        if (this.port.writable) {
            // initialize the writer:
            const writer = this.port.writable.getWriter();
            // convert the data to be sent to an array:
            let output = new TextEncoder().encode(data);  // This sends as ascii
            //let output = new Uint8Array(data.match(/../g).map(byte => parseInt(byte, 16)));
            // send it, then release the writer:
            writer.write(output).then(writer.releaseLock());
        }
    }

    async listenForSerial() {
        // if there's no serial port, return:
        if (!this.port) return;
        // while the port is open:
        while (this.port.readable) {
            // initialize the reader:
            this.reader = this.port.readable.getReader();
            try {
                // read incoming serial buffer:
                const { value, done } = await this.reader.read();
                if (done) {
                    break;
                }
                if (value) {
                    for (const byte of value) {
                        if (byte === 10) {   // 10 === newline
                            // Process complete message
                            //console.log("Full message:", this.incomingSerialMessage);
                            this.incoming.data = new Uint8Array(this.incomingSerialMessage);
                            // fire the event:
                            parent.dispatchEvent(this.dataEvent);
                            this.incomingSerialMessage = []; // Reset for next message
                        } else {
                            this.incomingSerialMessage.push(byte);
                        }
                    }
                }
            } catch (error) {
                // if there's an error reading the port:
                console.log(error);
            } finally {
                this.reader.releaseLock();
            }
        }
    }
}


customElements.define('ravel-gadget', RavelGadget);
