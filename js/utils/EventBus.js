// EventBus.js - Simple pub/sub event system for decoupled component communication
export class EventBus {
    constructor(options = {}) {
        this.events = new Map();
        this.debug = options.debug || false;
        this.name = options.name || 'EventBus';

        // Track subscription IDs for easier cleanup
        this.subscriptionId = 0;
        this.subscriptions = new Map();

        if (this.debug) {
            console.log(`🚌 ${this.name} initialized in debug mode`);
        }
    }

    /**
     * Subscribe to an event
     * @param {string} event - Event name to subscribe to
     * @param {function} callback - Function to call when event is emitted
     * @returns {function} Unsubscribe function
     */
    subscribe(event, callback) {
        if (typeof callback !== 'function') {
            console.error(`EventBus: Callback must be a function for event "${event}"`);
            return () => {};
        }

        if (!this.events.has(event)) {
            this.events.set(event, new Map());
        }

        const eventSubscribers = this.events.get(event);
        const subId = ++this.subscriptionId;

        eventSubscribers.set(subId, callback);
        this.subscriptions.set(subId, { event, callback });

        if (this.debug) {
            console.log(`🔔 ${this.name}: Subscribed to "${event}" (ID: ${subId}, Total: ${eventSubscribers.size})`);
        }

        // Return unsubscribe function
        return () => {
            this.unsubscribe(event, subId);
        };
    }

    /**
     * Unsubscribe from an event
     * @param {string} event - Event name
     * @param {number} subscriptionId - Subscription ID to remove
     */
    unsubscribe(event, subscriptionId) {
        const eventSubscribers = this.events.get(event);
        if (eventSubscribers) {
            eventSubscribers.delete(subscriptionId);
            this.subscriptions.delete(subscriptionId);

            if (this.debug) {
                console.log(`🔕 ${this.name}: Unsubscribed from "${event}" (ID: ${subscriptionId}, Remaining: ${eventSubscribers.size})`);
            }

            // Clean up empty event maps
            if (eventSubscribers.size === 0) {
                this.events.delete(event);
            }
        }
    }

    /**
     * Emit an event with data
     * @param {string} event - Event name to emit
     * @param {any} data - Data to pass to subscribers (push pattern)
     */
    emit(event, data) {
        const eventSubscribers = this.events.get(event);

        if (!eventSubscribers || eventSubscribers.size === 0) {
            if (this.debug) {
                console.log(`📢 ${this.name}: Event "${event}" emitted but no subscribers`);
            }
            return;
        }

        if (this.debug) {
            console.log(`📢 ${this.name}: Emitting "${event}" to ${eventSubscribers.size} subscriber(s)`, data);
        }

        // Call each subscriber with the data
        eventSubscribers.forEach((callback, subId) => {
            try {
                callback(data);
            } catch (error) {
                console.error(`EventBus: Error in subscriber for "${event}" (ID: ${subId}):`, error);
            }
        });
    }

    /**
     * Check if an event has subscribers
     * @param {string} event - Event name
     * @returns {boolean}
     */
    hasSubscribers(event) {
        const eventSubscribers = this.events.get(event);
        return eventSubscribers && eventSubscribers.size > 0;
    }

    /**
     * Get subscriber count for an event
     * @param {string} event - Event name
     * @returns {number}
     */
    getSubscriberCount(event) {
        const eventSubscribers = this.events.get(event);
        return eventSubscribers ? eventSubscribers.size : 0;
    }

    /**
     * Clear all subscriptions for an event
     * @param {string} event - Event name
     */
    clearEvent(event) {
        if (this.events.has(event)) {
            const count = this.events.get(event).size;
            this.events.delete(event);

            // Remove from subscriptions map
            this.subscriptions.forEach((sub, id) => {
                if (sub.event === event) {
                    this.subscriptions.delete(id);
                }
            });

            if (this.debug) {
                console.log(`🧹 ${this.name}: Cleared ${count} subscription(s) for "${event}"`);
            }
        }
    }

    /**
     * Clear all events and subscriptions
     */
    clearAll() {
        const eventCount = this.events.size;
        const subCount = this.subscriptions.size;

        this.events.clear();
        this.subscriptions.clear();
        this.subscriptionId = 0;

        if (this.debug) {
            console.log(`🧹 ${this.name}: Cleared all ${subCount} subscription(s) across ${eventCount} event(s)`);
        }
    }

    /**
     * Get debug information about current subscriptions
     * @returns {object}
     */
    getDebugInfo() {
        const info = {
            totalEvents: this.events.size,
            totalSubscriptions: this.subscriptions.size,
            events: {}
        };

        this.events.forEach((subscribers, event) => {
            info.events[event] = {
                subscriberCount: subscribers.size,
                subscriberIds: Array.from(subscribers.keys())
            };
        });

        return info;
    }

    /**
     * Enable or disable debug mode
     * @param {boolean} enabled
     */
    setDebugMode(enabled) {
        this.debug = enabled;
        console.log(`🚌 ${this.name}: Debug mode ${enabled ? 'enabled' : 'disabled'}`);
    }
}

// Export as default as well for flexibility
export default EventBus;