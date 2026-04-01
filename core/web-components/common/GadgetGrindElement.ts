import  { GadgetGrindMessenger }  from '../../GadgetGrindMessenger';

/**
 * Abstract base class for all Gadget Grind custom elements.
 *
 * Provides shared infrastructure that every component in the simulation relies on:
 * - Pub/sub messaging via {@link GadgetGrindMessenger}
 * - Window-level event broadcasting
 * - Common `x` / `y` observed attributes for grid positioning
 *
 * Subclasses must implement {@link initialize}, {@link setup}, and
 * {@link teardown} to manage their own Shadow DOM and lifecycle concerns.
 *
 * @extends HTMLElement
 */
export class GadgetGrindElement extends HTMLElement {
	static baseStyles = ``;
    static baseHtml = ``;

    /** Horizontal grid position set via the `x` attribute. */
    private x: number = 0;
    /** Vertical grid position set via the `y` attribute. */
	private y: number = 0;

    /** Message names this element is currently subscribed to. */
	public observedMessages: string[] = [];

    /**
     * Attributes shared by all Gadget Grind elements.
     * Subclasses spread this into their own `observedAttributes` list.
     * @returns The base attribute names `['x', 'y']`.
     */
	static get baseObservedAttributes() {
        return [ 'x', 'y' ];
    }

	constructor() {
		super();
	}

    /**
     * Sends a targeted message through the {@link GadgetGrindMessenger} pub/sub system.
     * @param msg - The message name (event type).
     * @param cmd - A command string included in the event detail.
     * @param content - Arbitrary payload included in the event detail.
     */
	sendMessage(msg: string, cmd: string, content: unknown) {
        GadgetGrindMessenger.sendMessage(msg, cmd, content);
	}

    /**
     * Dispatches a {@link CustomEvent} on the global `window` object,
     * bypassing the pub/sub subscription list.
     * @param msg - The event type name.
     * @param cmd - A command string included in the event detail.
     * @param content - Arbitrary payload included in the event detail.
     */
	broadcastMessage(msg: string, cmd: string, content: unknown) {
        let evt = new CustomEvent(msg, { detail: { cmd: cmd, content: content }});
        window.dispatchEvent(evt);
	}

    /**
     * Subscribes this element to a list of message names via the messenger.
     * @param msgList - Message names to subscribe to.
     */
	subscribe(msgList: string[]) {
        for (let msg of msgList) {
            GadgetGrindMessenger.subscribe(msg, this);
		}
	}

    /**
     * Unsubscribes this element from a list of message names.
     * @param msgList - Message names to unsubscribe from.
     */
	unsubscribe(msgList: string[]) {
	    for (let msg of msgList) {
			GadgetGrindMessenger.unsubscribe(msg, this);
		}
	}

    /**
     * Reacts to attribute changes on the element. Handles the base `x` and `y`
     * attributes; subclasses should call `super.attributeChangedCallback()`
     * to preserve this behaviour.
     * @param name - The name of the changed attribute.
     * @param oldValue - The previous attribute value, or `null`.
     * @param newValue - The new attribute value, or `null`.
     */
	attributeChangedCallback(
		name: string,
        oldValue: string | null,
        newValue: string | null
    ) {
        if (name === 'x') {
            this.x = Number(newValue);
        }
        if (name === 'y') {
            this.y = Number(newValue);
        }
	}
} 