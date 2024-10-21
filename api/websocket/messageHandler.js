// src/api/websocket/messageHandler.js

const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const MessageService = require('../../services/messageService');
const LOGGER = require('log4js').getLogger('websocket/messageHandler.js');

class MessageHandler {
    constructor(server) {
        this.wss = new WebSocket.Server({ server });
        this.clients = new Map();
        this.setupWebSocket();
    }

    setupWebSocket() {
        this.wss.on('connection', (ws, req) => {
            const token = this.extractToken(req);
            if (!token) {
                ws.close(1008, 'Authorization failed');
                return;
            }

            jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
                if (err) {
                    ws.close(1008, 'Invalid token');
                    return;
                }

                const userId = decoded.userId;
                this.clients.set(userId, ws);

                ws.on('message', (message) => this.handleMessage(userId, message));
                ws.on('close', () => this.handleClose(userId));
            });
        });
    }

    extractToken(req) {
        const auth = req.headers['authorization'];
        if (auth && auth.startsWith('Bearer ')) {
            return auth.slice(7);
        }
        return null;
    }

    async handleMessage(userId, message) {
        try {
            const parsedMessage = JSON.parse(message);
            switch (parsedMessage.type) {
                case 'SEND_MESSAGE':
                    await this.handleSendMessage(userId, parsedMessage.data);
                    break;
                case 'READ_MESSAGE':
                    await this.handleReadMessage(userId, parsedMessage.data);
                    break;
                default:
                    LOGGER.warn(`Unknown message type: ${parsedMessage.type}`);
            }
        } catch (error) {
            LOGGER.error('Error handling WebSocket message:', error);
        }
    }

    async handleSendMessage(senderId, { recipientId, content }) {
        const message = await MessageService.createMessage(senderId, recipientId, content);
        this.sendToUser(recipientId, {
            type: 'NEW_MESSAGE',
            data: message
        });
    }

    async handleReadMessage(userId, { messageId }) {
        await MessageService.markMessageAsRead(messageId, userId);
    }

    handleClose(userId) {
        this.clients.delete(userId);
    }

    sendToUser(userId, data) {
        const client = this.clients.get(userId);
        if (client && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    }

    broadcastMessage(data) {
        this.wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(data));
            }
        });
    }
}

module.exports = MessageHandler;