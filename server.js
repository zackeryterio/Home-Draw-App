// server.js (Node.js - Deploy on free Heroku/Railway)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let users = {};

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    socket.on('register', (token) => {
        users[token] = socket.id;
        socket.token = token;
        console.log('Registered:', token);
    });
    
    socket.on('pair', (data) => {
        const { from, to } = data;
        if (users[to]) {
            io.to(users[to]).emit('paired', `Connected with ${from}`);
            socket.pairedWith = to;
        }
    });
    
    socket.on('draw', (data) => {
        if (users[data.to]) {
            io.to(users[data.to]).emit('draw', data);
        }
    });
    
    socket.on('disconnect', () => {
        if (socket.token) delete users[socket.token];
        console.log('User disconnected');
    });
});

server.listen(process.env.PORT || 3000, () => {
    console.log('Server running on port', process.env.PORT || 3000);
});