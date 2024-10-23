// eventEmitter.js
const EventEmitter = require('events');
const logger = require('../../utils/logger');

class CipherZeroEventEmitter extends EventEmitter {
   constructor() {
       super();
       this.eventHistory = new Map(); // Store recent events for debugging
       this.eventHandlers = new Map(); // Store registered handlers
       this.setupErrorHandling();
   }

   /**
    * Enhanced emit with logging and error handling
    */
   emit(eventType, data) {
       try {
           // Validate event type
           if (!this.isValidEventType(eventType)) {
               throw new Error(`Invalid event type: ${eventType}`);
           }

           // Add metadata to event
           const eventData = this.enrichEventData(eventType, data);

           // Store in history
           this.storeEventInHistory(eventType, eventData);

           // Log event
           logger.debug(`Event emitted: ${eventType}`, { 
               eventType, 
               timestamp: eventData.timestamp 
           });

           // Emit event
           super.emit(eventType, eventData);
           
           // Emit wildcard event for global listeners
           super.emit('*', { type: eventType, data: eventData });

           return true;
       } catch (error) {
           logger.error(`Error emitting event ${eventType}:`, error);
           this.emit('system:error', { 
               error, 
               context: { eventType, data } 
           });
           return false;
       }
   }

   /**
    * Register event handler with validation
    */
   on(eventType, handler) {
       try {
           // Validate event type
           if (!this.isValidEventType(eventType)) {
               throw new Error(`Invalid event type: ${eventType}`);
           }

           // Wrap handler with error handling
           const wrappedHandler = this.wrapHandlerWithErrorHandling(
               eventType, 
               handler
           );

           // Store handler reference
           this.eventHandlers.set(handler, wrappedHandler);

           // Register handler
           super.on(eventType, wrappedHandler);

           logger.debug(`Handler registered for ${eventType}`);
       } catch (error) {
           logger.error(`Error registering handler for ${eventType}:`, error);
           throw error;
       }
   }

   /**
    * Remove event handler
    */
   off(eventType, handler) {
       try {
           const wrappedHandler = this.eventHandlers.get(handler);
           if (wrappedHandler) {
               super.off(eventType, wrappedHandler);
               this.eventHandlers.delete(handler);
               logger.debug(`Handler removed for ${eventType}`);
           }
       } catch (error) {
           logger.error(`Error removing handler for ${eventType}:`, error);
           throw error;
       }
   }

   /**
    * Wait for specific event
    */
   waitForEvent(eventType, timeout = 5000) {
       return new Promise((resolve, reject) => {
           const timer = setTimeout(() => {
               this.off(eventType, handler);
               reject(new Error(`Timeout waiting for event ${eventType}`));
           }, timeout);

           const handler = (data) => {
               clearTimeout(timer);
               this.off(eventType, handler);
               resolve(data);
           };

           this.on(eventType, handler);
       });
   }

   /**
    * Check if event type exists in EventTypes
    */
   isValidEventType(eventType) {
       // Traverse EventTypes object to find event type
       const types = eventType.split(':');
       let current = require('./eventTypes');
       
       for (const type of types) {
           current = current[type];
           if (!current) return false;
       }
       
       return true;
   }

   /**
    * Add metadata to event data
    */
   enrichEventData(eventType, data) {
       return {
           type: eventType,
           timestamp: Date.now(),
           id: this.generateEventId(),
           data
       };
   }

   /**
    * Generate unique event ID
    */
   generateEventId() {
       return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
   }

   /**
    * Store event in history (limited size)
    */
   storeEventInHistory(eventType, data) {
       const MAX_HISTORY = 1000;
       
       const history = this.eventHistory.get(eventType) || [];
       history.unshift({ timestamp: Date.now(), data });
       
       if (history.length > MAX_HISTORY) {
           history.pop();
       }
       
       this.eventHistory.set(eventType, history);
   }

   /**
    * Get event history
    */
   getEventHistory(eventType, limit = 100) {
       const history = this.eventHistory.get(eventType) || [];
       return history.slice(0, limit);
   }

   /**
    * Wrap event handler with error handling
    */
   wrapHandlerWithErrorHandling(eventType, handler) {
       return async (...args) => {
           try {
               await handler(...args);
           } catch (error) {
               logger.error(
                   `Error in handler for ${eventType}:`, 
                   error
               );
               this.emit('system:error', { 
                   error, 
                   context: { eventType, args } 
               });
           }
       };
   }

   /**
    * Setup error handling for the emitter
    */
   setupErrorHandling() {
       this.on('error', (error) => {
           logger.error('EventEmitter error:', error);
       });

       process.on('uncaughtException', (error) => {
           logger.error('Uncaught exception in EventEmitter:', error);
           this.emit('system:error', { error });
       });
   }

   /**
    * Clean up resources
    */
   destroy() {
       this.removeAllListeners();
       this.eventHistory.clear();
       this.eventHandlers.clear();
   }
}

module.exports = new CipherZeroEventEmitter();