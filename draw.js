// COMPLETE FIXED DRAW.JS
let canvas, ctx;
let drawing = false;
let lastX = 0, lastY = 0;
let hue = 0;
let token = "";
let socket = null;
let pairedWith = null;
let lineWidth = 5;
let isMobile = false;

// Initialize everything when page loads
window.addEventListener('DOMContentLoaded', function() {
    console.log("Page loaded, initializing...");
    initApp();
});

function initApp() {
    // Check if mobile
    isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) lineWidth = 8;
    
    // Setup canvas
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');
    
    // Set canvas size to full screen
    resizeCanvas();
    
    // Generate token IMMEDIATELY
    token = generateToken();
    document.getElementById('token').textContent = token;
    console.log("Token generated:", token);
    
    // Setup drawing events
    setupDrawingEvents();
    
    // Setup WebSocket connection
    setupWebSocket();
    
    // Setup timezone selector
    document.getElementById('timezone').addEventListener('change', function() {
        console.log("Timezone selected:", this.value);
        // Just hide it after selection
        this.parentElement.style.opacity = '0.5';
    });
    
    // Setup window resize handler
    window.addEventListener('resize', resizeCanvas);
    
    console.log("App initialized successfully!");
}

// Generate 6-character token
function generateToken() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Resize canvas to full window
function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    ctx.scale(dpr, dpr);
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    
    // Redraw everything if needed
    redrawCanvas();
}

// Setup mouse/touch events for drawing
function setupDrawingEvents() {
    // Mouse events
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    
    // Touch events for mobile
    canvas.addEventListener('touchstart', function(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousedown', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        canvas.dispatchEvent(mouseEvent);
    });
    
    canvas.addEventListener('touchmove', function(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousemove', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        canvas.dispatchEvent(mouseEvent);
    });
    
    canvas.addEventListener('touchend', function(e) {
        e.preventDefault();
        const mouseEvent = new MouseEvent('mouseup');
        canvas.dispatchEvent(mouseEvent);
    });
}

// Start drawing
function startDrawing(e) {
    drawing = true;
    [lastX, lastY] = getCanvasCoordinates(e);
    
    // Start local drawing
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    
    // Send start point to friend
    sendDrawingPoint(lastX, lastY, 'start');
    
    // Change cursor
    canvas.style.cursor = 'crosshair';
}

// Draw continuously
function draw(e) {
    if (!drawing) return;
    
    e.preventDefault();
    const [x, y] = getCanvasCoordinates(e);
    
    // Draw locally
    ctx.lineTo(x, y);
    ctx.strokeStyle = `hsl(${hue}, 100%, 50%)`;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    
    // Send point to friend
    sendDrawingPoint(x, y, 'draw');
    
    [lastX, lastY] = [x, y];
    hue = (hue + 1) % 360;
}

// Stop drawing
function stopDrawing() {
    if (!drawing) return;
    
    drawing = false;
    ctx.closePath();
    
    // Send stop signal
    sendDrawingPoint(lastX, lastY, 'stop');
    
    // Reset cursor
    canvas.style.cursor = 'default';
}

// Get coordinates relative to canvas
function getCanvasCoordinates(e) {
    const rect = canvas.getBoundingClientRect();
    let x, y;
    
    if (e.type.includes('touch')) {
        x = e.touches[0].clientX - rect.left;
        y = e.touches[0].clientY - rect.top;
    } else {
        x = e.clientX - rect.left;
        y = e.clientY - rect.top;
    }
    
    // Normalize for different screen sizes
    const normalizedX = x / rect.width;
    const normalizedY = y / rect.height;
    
    return [normalizedX, normalizedY];
}

// Send drawing data to friend
function sendDrawingPoint(x, y, type) {
    if (!socket || !socket.connected || !pairedWith) return;
    
    const data = {
        type: 'draw',
        from: token,
        to: pairedWith,
        x: x,
        y: y,
        action: type,
        color: hue,
        width: lineWidth
    };
    
    socket.emit('drawing', data);
}

// Setup WebSocket connection
function setupWebSocket() {
    // Using a PUBLIC test WebSocket server (for testing)
    // Replace with your own server later
    const serverUrl = 'wss://websocket-echo.onrender.com';
    // Alternative: 'wss://ws.postman-echo.com/raw'
    
    console.log("Connecting to WebSocket:", serverUrl);
    
    try {
        socket = io(serverUrl, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });
        
        socket.on('connect', function() {
            console.log("✅ WebSocket connected!");
            updateStatus('connected');
            
            // Register with server
            socket.emit('register', {
                type: 'register',
                token: token
            });
        });
        
        socket.on('connect_error', function(error) {
            console.log("❌ Connection error:", error);
            updateStatus('error');
            
            // Try alternative server
            setTimeout(setupWebSocket, 2000);
        });
        
        socket.on('disconnect', function() {
            console.log("⚠️ Disconnected from server");
            updateStatus('disconnected');
        });
        
        // Listen for drawing data from friend
        socket.on('drawing', function(data) {
            if (data.from === pairedWith) {
                drawRemote(data);
            }
        });
        
        // Listen for pairing confirmation
        socket.on('paired', function(data) {
            console.log("🤝 Paired with:", data.with);
            pairedWith = data.with;
            updateStatus('paired');
            alert(`Connected with ${data.with}! Start drawing!`);
        });
        
        // Echo test (for public test servers)
        socket.on('message', function(data) {
            console.log("Echo:", data);
        });
        
    } catch (error) {
        console.error("Failed to setup WebSocket:", error);
        updateStatus('error');
    }
}

// Draw remote strokes
function drawRemote(data) {
    const rect = canvas.getBoundingClientRect();
    const x = data.x * rect.width;
    const y = data.y * rect.height;
    
    ctx.strokeStyle = `hsl(${data.color || 0}, 100%, 50%)`;
    ctx.lineWidth = data.width || lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    if (data.action === 'start') {
        ctx.beginPath();
        ctx.moveTo(x, y);
    } else if (data.action === 'draw') {
        ctx.lineTo(x, y);
        ctx.stroke();
    } else if (data.action === 'stop') {
        ctx.closePath();
    }
}

// Connect to friend using token
function connectToFriend() {
    const friendToken = document.getElementById('friendToken').value.trim().toUpperCase();
    
    if (friendToken.length !== 6) {
        alert("Please enter a 6-digit token!");
        return;
    }
    
    if (friendToken === token) {
        alert("You can't connect to yourself!");
        return;
    }
    
    if (!socket || !socket.connected) {
        alert("Not connected to server. Please wait...");
        return;
    }
    
    console.log("Attempting to connect to:", friendToken);
    
    // Send pairing request
    socket.emit('pair', {
        type: 'pair',
        from: token,
        to: friendToken
    });
    
    // Store friend token
    pairedWith = friendToken;
    updateStatus('connecting');
}

// Change background theme
function setTheme(theme) {
    console.log("Setting theme:", theme);
    
    switch(theme) {
        case 'pink':
            canvas.style.backgroundColor = '#FFC0CB';
            break;
        case 'blue':
            canvas.style.backgroundColor = '#ADD8E6';
            break;
        case 'green':
            canvas.style.backgroundColor = '#90EE90';
            break;
        default:
            canvas.style.backgroundColor = '#FFC0CB';
    }
    
    // Visual feedback
    const buttons = document.querySelectorAll('.theme-btn');
    buttons.forEach(btn => btn.style.transform = 'scale(1)');
    event.target.style.transform = 'scale(1.1)';
}

// Clear canvas
function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Also tell friend to clear
    if (socket && socket.connected && pairedWith) {
        socket.emit('clear', {
            type: 'clear',
            from: token,
            to: pairedWith
        });
    }
}

// Toggle menu visibility
function toggleMenu() {
    const menu = document.getElementById('menu');
    if (menu.style.display === 'none') {
        menu.style.display = 'block';
    } else {
        menu.style.display = 'none';
    }
}

// Update connection status
function updateStatus(status) {
    const statusDiv = document.getElementById('status');
    
    switch(status) {
        case 'connected':
            statusDiv.textContent = '✅ Connected to Server';
            statusDiv.className = 'connected';
            break;
        case 'disconnected':
            statusDiv.textContent = '❌ Disconnected';
            statusDiv.className = 'disconnected';
            break;
        case 'connecting':
            statusDiv.textContent = '🔄 Connecting to friend...';
            statusDiv.className = 'disconnected';
            break;
        case 'paired':
            statusDiv.textContent = `✅ Connected with ${pairedWith}`;
            statusDiv.className = 'connected';
            break;
        case 'error':
            statusDiv.textContent = '⚠️ Connection Error';
            statusDiv.className = 'disconnected';
            break;
    }
}

// Redraw canvas (for resize)
function redrawCanvas() {
    // Could save and restore drawing data here
    // For now, just clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// Listen for remote clear
if (socket) {
    socket.on('clear', function() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    });
}

// Export functions for HTML onclick
window.setTheme = setTheme;
window.connectToFriend = connectToFriend;
window.clearCanvas = clearCanvas;
window.toggleMenu = toggleMenu;
