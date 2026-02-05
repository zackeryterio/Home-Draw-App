// Save this as server.js for when you set up your own server
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Store connected users
const users = new Map(); // token -> socket.id
const pairs = new Map(); // token -> paired token

io.on('connection', (socket) => {
    console.log('New connection:', socket.id);
    
    // Register user with token
    socket.on('register', (data) => {
        const token = data.token;
        users.set(token, socket.id);
        socket.token = token;
        console.log(`User registered: ${token}`);
        
        socket.emit('registered', { success: true, token });
    });
    
    // Pair with another user
    socket.on('pair', (data) => {
        const fromToken = data.from;
        const toToken = data.to;
        
        if (users.has(toToken)) {
            pairs.set(fromToken, toToken);
            pairs.set(toToken, fromToken);
            
            // Notify both users
            socket.emit('paired', { with: toToken });
            io.to(users.get(toToken)).emit('paired', { with: fromToken });
            
            console.log(`Paired: ${fromToken} <-> ${toToken}`);
        } else {
            socket.emit('error', { message: 'User not found' });
        }
    });
    
    // Handle drawing data
    socket.on('drawing', (data) => {
        const toToken = data.to;
        if (users.has(toToken)) {
            io.to(users.get(toToken)).emit('drawing', data);
        }
    });
    
    // Handle clear request
    socket.on('clear', (data) => {
        const toToken = data.to;
        if (users.has(toToken)) {
            io.to(users.get(toToken)).emit('clear', { from: data.from });
        }
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
        if (socket.token) {
            const pairedWith = pairs.get(socket.token);
            
            if (pairedWith) {
                // Notify paired user
                if (users.has(pairedWith)) {
                    io.to(users.get(pairedWith)).emit('disconnected', {
                        from: socket.token
                    });
                }
                pairs.delete(socket.token);
                pairs.delete(pairedWith);
            }
            
            users.delete(socket.token);
            console.log(`User disconnected: ${socket.token}`);
        }
    });
});

// Serve static files for web app
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
