// draw.js
let canvas, ctx, drawing = false;
let token = generateToken();
let socket = io('https://your-backend.herokuapp.com'); // Replace with your server

function init() {
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');
    resizeCanvas();
    
    document.getElementById('token').textContent = token;
    
    // Connect to server
    socket.emit('register', token);
    
    socket.on('connect', () => {
        document.getElementById('status').textContent = 'Connected';
    });
    
    socket.on('draw', (data) => {
        drawRemote(data.x, data.y, data.type);
    });
    
    socket.on('paired', (msg) => {
        alert('Connected with friend!');
        document.getElementById('status').textContent = 'Paired';
    });
    
    // Drawing events
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('touchstart', handleTouch);
    canvas.addEventListener('touchmove', handleTouch);
    canvas.addEventListener('touchend', stopDrawing);
    
    // Hide timezone after selection
    document.getElementById('timezone').addEventListener('change', function() {
        this.parentElement.classList.add('hidden');
    });
}

function generateToken() {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function startDrawing(e) {
    drawing = true;
    drawPoint(e, 'down');
}

function draw(e) {
    if (!drawing) return;
    drawPoint(e, 'move');
}

function stopDrawing() {
    drawing = false;
    ctx.beginPath();
}

function drawPoint(e, type) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;
    
    // Draw locally
    if (type === 'down') {
        ctx.beginPath();
        ctx.moveTo(x, y);
    } else {
        ctx.lineTo(x, y);
        ctx.stroke();
    }
    
    // Send to friend
    socket.emit('draw', {
        to: window.pairedWith,
        x: x / canvas.width, // Normalize
        y: y / canvas.height,
        type: type
    });
}

function drawRemote(x, y, type) {
    const realX = x * canvas.width;
    const realY = y * canvas.height;
    
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 3;
    
    if (type === 'down') {
        ctx.beginPath();
        ctx.moveTo(realX, realY);
    } else {
        ctx.lineTo(realX, realY);
        ctx.stroke();
    }
}

function setBg(color) {
    canvas.style.background = color === 'pink' ? '#FFC0CB' : '#ADD8E6';
}

function connect() {
    const friendToken = document.getElementById('friendToken').value;
    socket.emit('pair', { from: token, to: friendToken });
    window.pairedWith = friendToken;
}

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function handleTouch(e) {
    e.preventDefault();
    if (e.type === 'touchstart') startDrawing(e);
    if (e.type === 'touchmove') draw(e);
}

window.addEventListener('resize', resizeCanvas);
window.onload = init;