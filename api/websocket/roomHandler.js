const { v4: uuidv4 } = require('uuid');
const logger = require('../../utils/logger');
const { verifyJWT } = require('../../security/tokenManager');
const MessageProofGenerator = require('../../zksnark/proofs/messageProof');

class RoomHandler {
    constructor(io, messageService, proofService) {
        this.io = io;
        this.messageService = messageService;
        this.proofService = proofService;
        this.proofGenerator = new MessageProofGenerator();
        this.rooms = new Map();
        this.userSockets = new Map();
    }

    initialize() {
        this.io.on('connection', async (socket) => {
            try {
                // Verify JWT token
                const token = socket.handshake.auth.token;
                const user = await verifyJWT(token);
                socket.user = user;

                // Setup user's socket mapping
                this.userSockets.set(user.address, socket);

                // Setup event listeners
                this.setupSocketListeners(socket);

                logger.info(`User ${user.address} connected`);
            } catch (error) {
                logger.error('Socket connection failed:', error);
                socket.disconnect();
            }
        });
    }

    setupSocketListeners(socket) {
        socket.on('create_room', async (data) => {
            try {
                const roomId = await this.createRoom(socket.user, data);
                socket.join(roomId);
                socket.emit('room_created', { roomId });
            } catch (error) {
                logger.error('Room creation failed:', error);
                socket.emit('error', { message: 'Room creation failed' });
            }
        });

        socket.on('join_room', async (data) => {
            try {
                await this.joinRoom(socket, data.roomId);
            } catch (error) {
                logger.error('Room join failed:', error);
                socket.emit('error', { message: 'Failed to join room' });
            }
        });

        socket.on('private_message', async (data) => {
            try {
                await this.handlePrivateMessage(socket, data);
            } catch (error) {
                logger.error('Private message failed:', error);
                socket.emit('error', { message: 'Message sending failed' });
            }
        });

        socket.on('leave_room', async (data) => {
            try {
                await this.leaveRoom(socket, data.roomId);
            } catch (error) {
                logger.error('Room leave failed:', error);
            }
        });

        socket.on('disconnect', () => {
            this.handleDisconnect(socket);
        });
    }

    async createRoom(user, data) {
        const roomId = uuidv4();
        this.rooms.set(roomId, {
            id: roomId,
            owner: user.address,
            members: new Set([user.address]),
            messages: [],
            created: Date.now()
        });
        return roomId;
    }

    async joinRoom(socket, roomId) {
        const room = this.rooms.get(roomId);
        if (!room) throw new Error('Room not found');

        room.members.add(socket.user.address);
        socket.join(roomId);
        
        this.io.to(roomId).emit('user_joined', {
            user: socket.user.address,
            timestamp: Date.now()
        });
    }

    async handlePrivateMessage(socket, data) {
        const { message, roomId, recipient } = data;

        // Generate ZK proof for private message
        const proof = await this.proofGenerator.generateMessageProof({
            message,
            sender: socket.user.address,
            recipient,
            recipientPubKey: this.userSockets.get(recipient)?.publicKey
        });

        // Store message with proof
        await this.messageService.storeMessage({
            roomId,
            message: proof.encryptedMessage,
            proof: proof.proof,
            sender: socket.user.address,
            recipient
        });

        // Emit to recipient
        const recipientSocket = this.userSockets.get(recipient);
        if (recipientSocket) {
            recipientSocket.emit('private_message', {
                sender: socket.user.address,
                message: proof.encryptedMessage,
                proof: proof.proof,
                timestamp: Date.now()
            });
        }
    }

    async leaveRoom(socket, roomId) {
        const room = this.rooms.get(roomId);
        if (!room) return;

        room.members.delete(socket.user.address);
        socket.leave(roomId);

        if (room.members.size === 0) {
            this.rooms.delete(roomId);
        }

        this.io.to(roomId).emit('user_left', {
            user: socket.user.address,
            timestamp: Date.now()
        });
    }

    handleDisconnect(socket) {
        this.userSockets.delete(socket.user.address);
        logger.info(`User ${socket.user.address} disconnected`);
    }
}
