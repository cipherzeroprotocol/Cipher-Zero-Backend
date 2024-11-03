// /realtime/handlers/messageHandler.js
const { EventEmitter } = require('events');
const { MessageService } = require('../../services/messageService');
const logger = require('../../utils/logger');

class MessageHandler extends EventEmitter {
    constructor(io) {
        super();
        this.io = io;
        this.messageService = new MessageService();
        this.activeUsers = new Map(); // userId -> { socket, publicKey }
        this.rooms = new Map(); // roomId -> { members, owner, messages }
        this.MAX_ROOM_MESSAGES = 100;
    }

    /**
     * Initialize handler
     */
    async initialize() {
        this.setupSocketHandlers();
        logger.info('MessageHandler initialized');
    }

    /**
     * Handle user connection
     */
    async handleUserConnect(socket, data) {
        try {
            const { userId, publicKey } = data;

            // Store user connection
            this.activeUsers.set(userId, {
                socket,
                publicKey,
                status: 'online',
                lastSeen: Date.now()
            });

            // Join user's personal room
            socket.join(`user:${userId}`);

            // Notify others
            this.broadcastUserStatus(userId, 'online');

            // Send active users list
            socket.emit('users:active', {
                users: Array.from(this.activeUsers.entries()).map(([id, data]) => ({
                    id,
                    status: data.status,
                    lastSeen: data.lastSeen
                }))
            });

            logger.info(`User connected: ${userId}`);

        } catch (error) {
            logger.error('User connection failed:', error);
            throw error;
        }
    }

    /**
     * Handle direct message
     */
    async handleDirectMessage(socket, data) {
        try {
            const { content, recipient } = data;

            // Check if recipient is online
            const recipientData = this.activeUsers.get(recipient);
            if (!recipientData) {
                throw new Error('Recipient not found or offline');
            }

            // Send through message service
            const message = await this.messageService.sendPrivateMessage({
                content,
                sender: socket.user.id,
                recipient,
                recipientPubKey: recipientData.publicKey
            });

            // Emit to recipient
            recipientData.socket.emit('message:received', {
                id: message.id,
                sender: socket.user.id,
                content: message.encryptedContent,
                timestamp: message.timestamp
            });

            // Confirm to sender
            socket.emit('message:sent', {
                id: message.id,
                recipient,
                timestamp: message.timestamp
            });

        } catch (error) {
            logger.error('Direct message failed:', error);
            throw error;
        }
    }

    /**
     * Handle room creation
     */
    async handleRoomCreate(socket, data) {
        try {
            const { name, isPrivate = false } = data;

            // Create room
            const roomId = await this.messageService.createRoom({
                name,
                owner: socket.user.id,
                isPrivate
            });

            // Store room data
            this.rooms.set(roomId, {
                name,
                owner: socket.user.id,
                members: new Set([socket.user.id]),
                messages: [],
                isPrivate,
                created: Date.now()
            });

            // Join room
            socket.join(roomId);

            // Notify creation
            socket.emit('room:created', {
                roomId,
                name,
                isPrivate
            });

            logger.info(`Room created: ${roomId} by ${socket.user.id}`);

        } catch (error) {
            logger.error('Room creation failed:', error);
            throw error;
        }
    }

    /**
     * Handle room join
     */
    async handleRoomJoin(socket, data) {
        try {
            const { roomId } = data;

            // Check room exists
            const room = this.rooms.get(roomId);
            if (!room) {
                throw new Error('Room not found');
            }

            // Check access for private rooms
            if (room.isPrivate) {
                const hasAccess = await this.messageService.checkRoomAccess(
                    roomId,
                    socket.user.id
                );
                if (!hasAccess) throw new Error('Access denied');
            }

            // Add to room
            room.members.add(socket.user.id);
            socket.join(roomId);

            // Send room info
            socket.emit('room:joined', {
                roomId,
                name: room.name,
                members: Array.from(room.members),
                messages: room.messages.slice(-50) // Last 50 messages
            });

            // Notify room members
            this.io.to(roomId).emit('room:member_joined', {
                roomId,
                userId: socket.user.id,
                timestamp: Date.now()
            });

        } catch (error) {
            logger.error('Room join failed:', error);
            throw error;
        }
    }

    /**
     * Handle room leave
     */
    handleRoomLeave(socket, data) {
        try {
            const { roomId } = data;
            
            // Check room exists
            const room = this.rooms.get(roomId);
            if (!room) return;

            // Remove from room
            room.members.delete(socket.user.id);
            socket.leave(roomId);

            // Delete room if empty
            if (room.members.size === 0) {
                this.rooms.delete(roomId);
            }

            // Notify room members
            this.io.to(roomId).emit('room:member_left', {
                roomId,
                userId: socket.user.id,
                timestamp: Date.now()
            });

        } catch (error) {
            logger.error('Room leave failed:', error);
            throw error;
        }
    }

    /**
     * Handle room message
     */
    async handleRoomMessage(socket, data) {
        try {
            const { roomId, content } = data;

            // Check room exists
            const room = this.rooms.get(roomId);
            if (!room) {
                throw new Error('Room not found');
            }

            // Check membership
            if (!room.members.has(socket.user.id)) {
                throw new Error('Not a room member');
            }

            // Send through message service
            const message = await this.messageService.sendRoomMessage({
                content,
                sender: socket.user.id,
                roomId
            });

            // Store message
            room.messages.push(message);
            if (room.messages.length > this.MAX_ROOM_MESSAGES) {
                room.messages.shift();
            }

            // Broadcast to room
            this.io.to(roomId).emit('room:message', {
                id: message.id,
                roomId,
                sender: socket.user.id,
                content: message.encryptedContent,
                timestamp: message.timestamp
            });

        } catch (error) {
            logger.error('Room message failed:', error);
            throw error;
        }
    }

    /**
     * Handle status update
     */
    handleStatusUpdate(socket, data) {
        try {
            const { status } = data;
            const userData = this.activeUsers.get(socket.user.id);
            
            if (userData) {
                userData.status = status;
                userData.lastSeen = Date.now();
                this.broadcastUserStatus(socket.user.id, status);
            }

        } catch (error) {
            logger.error('Status update failed:', error);
            throw error;
        }
    }

    /**
     * Handle disconnect
     */
    handleDisconnect(socket) {
        try {
            // Update user status
            const userData = this.activeUsers.get(socket.user.id);
            if (userData) {
                userData.status = 'offline';
                userData.lastSeen = Date.now();
                this.broadcastUserStatus(socket.user.id, 'offline');
            }

            // Remove from active users
            this.activeUsers.delete(socket.user.id);

            // Leave all rooms
            for (const [roomId, room] of this.rooms) {
                if (room.members.has(socket.user.id)) {
                    room.members.delete(socket.user.id);
                    this.io.to(roomId).emit('room:member_left', {
                        roomId,
                        userId: socket.user.id,
                        timestamp: Date.now()
                    });

                    // Delete room if empty
                    if (room.members.size === 0) {
                        this.rooms.delete(roomId);
                    }
                }
            }

            logger.info(`User disconnected: ${socket.user.id}`);

        } catch (error) {
            logger.error('Disconnect handling failed:', error);
        }
    }

    /**
     * Broadcast user status
     */
    broadcastUserStatus(userId, status) {
        this.io.emit('user:status', {
            userId,
            status,
            timestamp: Date.now()
        });
    }

    /**
     * Send error to client
     */
    sendError(socket, event, error) {
        socket.emit(event, {
            error: error.message
        });
        logger.error(error);
    }

    /**
     * Clean up resources
     */
    cleanup() {
        this.activeUsers.clear();
        this.rooms.clear();
    }
}

module.exports = MessageHandler;