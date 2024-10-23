// messageDao.js
const Message = require('../models/Message');
const logger = require('../../utils/logger');

class MessageDao {
   /**
    * Create new private message
    */
   async createMessage(messageData) {
       try {
           const message = new Message({
               commitment: messageData.commitment,
               nullifier: messageData.nullifier,
               encryptedContent: messageData.encryptedContent,
               sender: messageData.sender,
               recipient: messageData.recipient,
               proof: messageData.proof,
               room: messageData.room,
               type: messageData.type || 'direct'
           });

           await message.save();
           logger.info(`Message created with commitment: ${message.commitment}`);
           return message;

       } catch (error) {
           logger.error('Failed to create message:', error);
           throw error;
       }
   }

   /**
    * Get message by commitment
    */
   async getMessageByCommitment(commitment) {
       try {
           return await Message.findOne({ commitment });
       } catch (error) {
           logger.error(`Failed to get message with commitment ${commitment}:`, error);
           throw error;
       }
   }

   /**
    * Get user's messages with pagination
    */
   async getUserMessages(address, options = {}) {
       try {
           const { 
               offset = 0, 
               limit = 20,
               type,
               status,
               room
           } = options;

           const query = {
               $or: [
                   { sender: address },
                   { recipient: address }
               ]
           };

           if (type) query.type = type;
           if (status) query.status = status;
           if (room) query.room = room;

           return await Message.find(query)
               .sort({ timestamp: -1 })
               .skip(offset)
               .limit(limit);

       } catch (error) {
           logger.error(`Failed to get messages for user ${address}:`, error);
           throw error;
       }
   }

   /**
    * Mark message as read
    */
   async markMessageAsRead(commitment) {
       try {
           const message = await Message.findOne({ commitment });
           if (!message) throw new Error('Message not found');

           await message.markAsRead();
           return message;

       } catch (error) {
           logger.error(`Failed to mark message ${commitment} as read:`, error);
           throw error;
       }
   }

   /**
    * Delete message
    */
   async deleteMessage(commitment) {
       try {
           return await Message.deleteOne({ commitment });
       } catch (error) {
           logger.error(`Failed to delete message ${commitment}:`, error);
           throw error;
       }
   }

   /**
    * Get room messages
    */
   async getRoomMessages(roomId, options = {}) {
       try {
           const { offset = 0, limit = 50 } = options;

           return await Message.find({ room: roomId })
               .sort({ timestamp: -1 })
               .skip(offset)
               .limit(limit);

       } catch (error) {
           logger.error(`Failed to get messages for room ${roomId}:`, error);
           throw error;
       }
   }
}