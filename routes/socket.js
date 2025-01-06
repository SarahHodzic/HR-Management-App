let io;
const connectedUsers = new Map();
const {saveMessage} = require('./db');

function initSocket(server) {
    io = require('socket.io')(server);

    io.on('connection', (client) => {
        console.log('USER CONNECTED', client.id);
        client.emit('test', {message: 'Hello from /applications/'});

        client.on('register', (userId) => {
            if (userId) {
                connectedUsers.set(userId, client);
                console.log(`User registered with ID ${userId} and socket ID ${client.id}`);
            }
        });

        client.on('chat message', async (data) => {
            const {sender_id, receiver_id, message} = data;
            console.log("SENDER ID, RECEIVER ID, MESSAGE", sender_id, receiver_id, message);
            try {
                await saveMessage({sender_id, receiver_id, message});

                const receiverSocket = connectedUsers.get(receiver_id);
                if (receiverSocket) {
                    receiverSocket.emit('newMessage', {sender_id, message});
                }
            } catch (error) {
                console.error('Error handling chat message:', error);
            }

        });

        client.on("status change", (data) => {
            console.log("Data", data.newStatus, data.user_id, data.applicationId);
            const receiverSocket = connectedUsers.get(data.user_id);
            if (receiverSocket) {
                receiverSocket.emit("New status", {applicationId: data.applicationId, status: data.newStatus});
            }

        })

        client.on('disconnect', () => {
            console.log('USER DISCONNECTED', client.id);
            for (const [userId, userSocket] of connectedUsers.entries()) {
                if (userSocket.id === client.id) {
                    connectedUsers.delete(userId);
                    console.log(`User with ID ${userId} disconnected`);
                    break;
                }
            }
        });
    });
}

function getSocketIO() {
    if (!io) {
        throw new Error('Socket.IO not initialized!');
    }
    return io;
}

function getConnectedUsers() {
    return connectedUsers;
}

module.exports = {initSocket, getSocketIO, getConnectedUsers};
