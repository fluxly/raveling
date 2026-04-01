/**
 * An {@link EventTarget} capable of receiving dispatched events.
 */
type MessengerTarget = EventTarget & { dispatchEvent(evt: Event): boolean };

/**
 * Describes the pub/sub messaging system used for inter-component communication.
 */
export interface RavelMessengerType {
    /** Map of message names to the list of targets subscribed to each. */
    subscriptions: Record<string, MessengerTarget[]>;
    /**
     * Dispatches a {@link CustomEvent} to every target subscribed to the given message.
     * @param msg - The message name (event type) to dispatch.
     * @param cmd - A command string included in the event detail.
     * @param content - Arbitrary payload included in the event detail.
     */
    sendMessage(msg: string, cmd: string, content: unknown): void;
    /**
     * Registers a target to receive events for the given message name.
     * @param msg - The message name to subscribe to.
     * @param target - The {@link MessengerTarget} that will receive dispatched events.
     */
    subscribe(msg: string, target: MessengerTarget): void;
    /**
     * Removes a target from the subscription list for the given message name.
     * @param msg - The message name to unsubscribe from.
     * @param target - The {@link MessengerTarget} to remove.
     */
    unsubscribe(msg: string, target: MessengerTarget): void;
}

/**
 * Singleton pub/sub messenger that decouples communication between Ravel
 * web components. Components subscribe by message name and receive
 * {@link CustomEvent} instances whose `detail` carries `{ cmd, content }`.
 */
export const RavelMessenger: RavelMessengerType = {
    subscriptions: {},

    sendMessage(msg, cmd, content) {
        console.log(msg);
        const evt = new CustomEvent(msg, { detail: { cmd: cmd, content: content } });

        const targets = this.subscriptions[msg];
        if (!targets || targets.length === 0) return;

        for (let i = 0; i < targets.length; i++) {
            targets[i].dispatchEvent(evt);
        }

    },

    subscribe(msg, target) {
        if (!this.subscriptions[msg]) {
            this.subscriptions[msg] = [];
        }
        this.subscriptions[msg].push(target);
    },

    unsubscribe(msg, target) {
        const targets = this.subscriptions[msg];
        if (!targets) return;

        const index = targets.indexOf(target);
        if (index !== -1) {
            targets.splice(index, 1);
        }
    }
};

export interface RavelMessageDetail {                                                                                                            
      cmd: string;                                                                                                                                       
      content: unknown;                                                                                                                                  
  }   
  