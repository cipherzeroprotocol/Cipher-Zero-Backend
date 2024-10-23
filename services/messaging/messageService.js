const { randomBytes } = require('crypto');
const { MessageDao } = require('../../mongo-db/dao');
const EncryptionService = require('./encryptionService');
const logger = require('../../utils/logger');
const events = require('../../api/websocket/events/eventEmitter');
const EventTypes = require('../../api/websocket/events/eventTypes');

class MessageService {
   constructor(messageDao, proofService) {
       this.messageDao = messageDao;
       this.proofService = proofService;
       this.encryptionService = new EncryptionService();
   }

   /**
    * Send private message with ZK proof
    */
   async sendPrivateMessage({
       content,
       sender,
       recipient,
       recipientPubKey,
       roomId = null
   }) {
       try {
           // Generate message key and nonce
           const messageKey = await randomBytes(32);
           const nonce = await randomBytes(16);

           // Encrypt message content
           const encryptedContent = await this.encryptionService.encryptMessage(
               content,
               messageKey,
               nonce
           );

           // Encrypt message key for recipient
           const encryptedKey = await this.encryptionService.encryptKey(
               messageKey,
               recipientPubKey
           );

           // Generate ZK proof
           const { proof, commitment, nullifier } = await this.proofService.generateMessageProof({
               messageHash: this.encryptionService.hashMessage(content),
               sender,
               recipient,
               nonce
           });

           // Create message record
           const message = await this.messageDao.createMessage({
               commitment,
               nullifier,
               encryptedContent,
               encryptedKey,
               sender,
               recipient,
               proof,
               room: roomId,
               type: roomId ? 'room' : 'direct',
               nonce
           });

           events.emit(EventTypes.MESSAGE.SENT, {
               messageId: message._id,
               sender,
               recipient,
               room: roomId
           });

           return message;

       } catch (error) {
           logger.error('Failed to send private message:', error);
           throw error;
       }
   }

   /**
    * Receive and decrypt private message
    */
   async receivePrivateMessage(messageId, recipientPrivateKey) {
       try {
           const message = await this.messageDao.getMessageByCommitment(messageId);
           if (!message) {
               throw new Error('Message not found');
           }

           // Verify message proof
           const isValid = await this.proofService.verifyMessageProof(
               message.proof,
               message.commitment
           );
           if (!isValid) {
               throw new Error('Invalid message proof');
           }

           // Decrypt message key
           const messageKey = await this.encryptionService.decryptKey(
               message.encryptedKey,
               recipientPrivateKey
           );

           // Decrypt message content
           const decryptedContent = await this.encryptionService.decryptMessage(
               message.encryptedContent,
               messageKey,
               message.nonce
           );

           // Mark message as delivered
           message.status = 'delivered';
           await message.save();

           events.emit(EventTypes.MESSAGE.RECEIVED, {
               messageId: message._id,
               sender: message.sender,
               recipient: message.recipient
           });

           return {
               ...message.toObject(),
               content: decryptedContent
           };

       } catch (error) {
           logger.error('Failed to receive private message:', error);
           throw error;
       }
   }

   /**
    * Get user's messages with decryption
    */
   async getUserMessages(userAddress, privateKey, options = {}) {
       try {
           const messages = await this.messageDao.getUserMessages(
               userAddress,
               options
           );

           // Decrypt messages
           const decryptedMessages = await Promise.all(
               messages.map(async message => {
                   try {
                       const decryptedMessage = await this.receivePrivateMessage(
                           message._id,
                           privateKey
                       );
                       return decryptedMessage;
                   } catch (error) {
                       logger.error(`Failed to decrypt message ${message._id}:`, error);
                       return message;
                   }
               })
           );

           return decryptedMessages;

       } catch (error) {
           logger.error(`Failed to get messages for user ${userAddress}:`, error);
           throw error;
       }
   }

   /**
    * Get room messages with decryption
    */
   async getRoomMessages(roomId, privateKey, options = {}) {
       try {
           const messages = await this.messageDao.getRoomMessages(roomId, options);

           // Decrypt messages
           const decryptedMessages = await Promise.all(
               messages.map(async message => {
                   try {
                       const decryptedMessage = await this.receivePrivateMessage(
                           message._id,
                           privateKey
                       );
                       return decryptedMessage;
                   } catch (error) {
                       logger.error(`Failed to decrypt room message ${message._id}:`, error);
                       return message;
                   }
               })
           );

           return decryptedMessages;

       } catch (error) {
           logger.error(`Failed to get messages for room ${roomId}:`, error);
           throw error;
       }
   }
}