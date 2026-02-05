// iOS HomeDraw App - Complete Fixed Version
let canvas, ctx;
let drawing = false;
let lastX = 0, lastY = 0;
let socket = null;
let token = "";
let pairedWith = null;
let connectionStatus = "disconnected";
let menuVisible = true;
let menuAutoHideTimer = null;
let currentTheme = "purple";

// Initialize when page loads
window.addEventListener('DOMContentLoaded', function() {
    console.log("🚀 HomeDraw iOS Starting...");
    initApp();
});

function initApp() {
    // Setup canvas
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');
    resizeCanvas();
    
    // Generate token
    token = generateToken();
    document.getElementById('token').textContent = token;
    console.log("Token:", token);
    
    // Setup real-time clock
    updateClock();
    setInterval(updateClock, 1000);
    
    // Setup drawing
    setupDrawing();
    
    // Setup socket connection
    setupSocket();
    
    // Setup theme
    setTheme('purple');
    
    // Setup timezone
    setupTimezone();
    
    // Setup menu auto-hide
    setupMenuAutoHide();
    
    // Setup swipe gestures
    setupSwipeGestures();
    
    console.log("✅ App Initialized");
}

// Generate 6-char token
function generateToken() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Resize canvas
function resizeCanvas() {
    canvas.width = window.innerWidth * window.devicePixelRatio;
    canvas.height = window.innerHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
}

// Setup drawing events
function setupDrawing() {
    // Mouse events
    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', endDraw);
    canvas.addEventListener('mouseleave', endDraw);
    
    // Touch events
    canvas.addEventListener('touchstart', function(e) {
        e.preventDefault();
        if (e.touches.length === 1) {
            startDraw(e.touches[0]);
        }
    });
    
    canvas.addEventListener('touchmove', function(e) {
        e.preventDefault();
        if (e.touches.length === 1) {
            draw(e.touches[0]);
        }
    });
    
    canvas.addEventListener('touchend', endDraw);
}

// Start drawing
function startDraw(e) {
    drawing = true;
    const rect = canvas.getBoundingClientRect();
    lastX = e.clientX - rect.left;
    lastY = e.clientY - rect.top;
    
    // Show menu briefly when drawing starts
    showMenuTemporary();
    
    // Draw starting point
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    
    // Send to server
    sendDrawingPoint(lastX, lastY, 'start');
}

// Continue drawing
function draw(e) {
    if (!drawing) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Draw locally
    ctx.lineTo(x, y);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 6;
    ctx.stroke();
    
    // Send to server
    sendDrawingPoint(x, y, 'draw');
    
    lastX = x;
    lastY = y;
}

// Stop drawing
function endDraw() {
    if (!drawing) return;
    drawing = false;
    ctx.closePath();
    sendDrawingPoint(lastX, lastY, 'end');
}

// Send drawing data
function sendDrawingPoint(x, y, action) {
    if (!socket || !socket.connected || !pairedWith) return;
    
    // Normalize coordinates
    const rect = canvas.getBoundingClientRect();
    const normalizedX = x / rect.width;
    const normalizedY = y / rect.height;
    
    const data = {
        type: 'draw',
        from: token,
        to: pairedWith,
        x: normalizedX,
        y: normalizedY,
        action: action,
        color: 'white',
        width: 6
    };
    
    socket.emit('drawing', data);
}

// Setup WebSocket connection
function setupSocket() {
    // Using a public WebSocket server for testing
    const serverUrl = 'wss://ws.postman-echo.com/raw';
    // Alternative: 'wss://websocket-echo.onrender.com'
    
    console.log("Connecting to:", serverUrl);
    
    socket = io(serverUrl, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
    });
    
    socket.on('connect', () => {
        console.log("✅ Connected to server");
        updateConnectionStatus('connected');
        socket.emit('register', { token: token });
    });
    
    socket.on('connect_error', (error) => {
        console.log("❌ Connection error:", error);
        updateConnectionStatus('disconnected');
    });
    
    socket.on('disconnect', () => {
        console.log("⚠️ Disconnected");
        updateConnectionStatus('disconnected');
    });
    
    // Handle drawing from friend
    socket.on('drawing', (data) => {
        if (data.from === pairedWith) {
            drawRemote(data);
        }
    });
    
    // Handle pairing
    socket.on('paired', (data) => {
        console.log("🤝 Paired with:", data.with);
        pairedWith = data.with;
        updateConnectionStatus('paired');
        showNotification(`Connected with ${data.with}!`);
    });
    
    // Handle echo (for test servers)
    socket.on('message', (data) => {
        console.log("Echo:", data);
    });
}

// Draw remote strokes
function drawRemote(data) {
    const rect = canvas.getBoundingClientRect();
    const x = data.x * rect.width;
    const y = data.y * rect.height;
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = data.width || 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    if (data.action === 'start') {
        ctx.beginPath();
        ctx.moveTo(x, y);
    } else if (data.action === 'draw') {
        ctx.lineTo(x, y);
        ctx.stroke();
    } else if (data.action === 'end') {
        ctx.closePath();
    }
}

// Connect to friend
function connectToFriend() {
    const friendToken = document.getElementById('friend-token').value.trim().toUpperCase();
    
    if (friendToken.length !== 6) {
        showNotification("Please enter a 6-digit token!");
        return;
    }
    
    if (friendToken === token) {
        showNotification("You can't connect to yourself!");
        return;
    }
    
    if (!socket || !socket.connected) {
        showNotification("Connecting to server...");
        return;
    }
    
    console.log("Connecting to:", friendToken);
    socket.emit('pair', {
        from: token,
        to: friendToken
    });
    
    updateConnectionStatus('connecting');
    showNotification("Connecting...");
}

// Update connection status UI
function updateConnectionStatus(status) {
    connectionStatus = status;
    const statusEl = document.getElementById('connection-status');
    
    switch(status) {
        case 'connected':
            statusEl.innerHTML = "🟢 Connected to Server";
            statusEl.className = "status-connected";
            break;
        case 'disconnected':
            statusEl.innerHTML = "🔴 Disconnected";
            statusEl.className = "status-disconnected";
            break;
        case 'connecting':
            statusEl.innerHTML = "🟡 Connecting...";
            statusEl.className = "status-disconnected";
            break;
        case 'paired':
            statusEl.innerHTML = `🔵 Connected with ${pairedWith}`;
            statusEl.className = "status-paired";
            break;
    }
}

// Set theme
function setTheme(theme) {
    currentTheme = theme;
    
    // Update active button
    document.querySelectorAll('.theme-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`theme-${theme}`).classList.add('active');
    
    // Set background
    const gradients = {
        purple: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        pink: 'linear-gradient(135deg, #FFC0CB 0%, #FF69B4 100%)',
        blue: 'linear-gradient(135deg, #ADD8E6 0%, #4169E1 100%)',
        green: 'linear-gradient(135deg, #90EE90 0%, #32CD32 100%)',
        sunset: 'linear-gradient(135deg, #FFD700 0%, #FF8C00 100%)',
        dark: 'linear-gradient(135deg, #000000 0%, #434343 100%)'
    };
    
    canvas.style.background = gradients[theme] || gradients.purple;
}

// Clear canvas
function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (socket && socket.connected && pairedWith) {
        socket.emit('clear', {
            from: token,
            to: pairedWith
        });
    }
    
    showNotification("Canvas cleared");
}

// Toggle menu visibility
function toggleMenu() {
    const menu = document.getElementById('main-menu');
    const hideBtn = document.getElementById('hide-menu-btn');
    const showBtn = document.getElementById('show-menu-btn');
    const swipeIndicator = document.getElementById('swipe-indicator');
    
    if (menuVisible) {
        // Hide menu
        menu.classList.remove('menu-visible');
        menu.classList.add('menu-hidden');
        hideBtn.style.display = 'none';
        showBtn.style.display = 'flex';
        swipeIndicator.style.display = 'block';
        menuVisible = false;
    } else {
        // Show menu
        menu.classList.remove('menu-hidden');
        menu.classList.add('menu-visible');
        hideBtn.style.display = 'flex';
        showBtn.style.display = 'none';
        swipeIndicator.style.display = 'none';
        menuVisible = true;
        
        // Reset auto-hide timer
        setupMenuAutoHide();
    }
}

// Show menu temporarily
function showMenuTemporary() {
    if (!menuVisible) {
        toggleMenu();
        setupMenuAutoHide();
    }
}

// Auto-hide menu after 5 seconds
function setupMenuAutoHide() {
    if (menuAutoHideTimer) clearTimeout(menuAutoHideTimer);
    
    if (menuVisible) {
        menuAutoHideTimer = setTimeout(() => {
            if (menuVisible) {
                toggleMenu();
            }
        }, 5000);
    }
}

// Update clock
function updateClock() {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
    });
    document.getElementById('time').textContent = timeString;
}

// Setup timezone
function setupTimezone() {
    const timezoneSelect = document.getElementById('timezone');
    
    // Auto-detect timezone
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    timezoneSelect.value = 'auto';
    
    timezoneSelect.addEventListener('change', function() {
        if (this.value === 'auto') {
            updateClock();
        }
        // Just hide after selection
        setTimeout(() => {
            this.parentElement.style.opacity = '0.5';
        }, 300);
    });
}

// Setup swipe gestures
function setupSwipeGestures() {
    let startY = 0;
    
    document.addEventListener('touchstart', (e) => {
        startY = e.touches[0].clientY;
    });
    
    document.addEventListener('touchmove', (e) => {
        if (!menuVisible && e.touches[0].clientY - startY < -50) {
            toggleMenu();
        }
    });
}

// Show notification
function showNotification(message) {
    // Create notification element
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 12px 24px;
        border-radius: 20px;
        z-index: 2000;
        font-size: 14px;
        backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        animation: fadeInOut 2s ease-in-out;
    `;
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeInOut {
            0% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
            15% { opacity: 1; transform: translateX(-50%) translateY(0); }
            85% { opacity: 1; transform: translateX(-50%) translateY(0); }
            100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 2000);
}

// Export functions for HTML
window.connectToFriend = connectToFriend;
window.clearCanvas = clearCanvas;
window.setTheme = setTheme;
window.toggleMenu = toggleMenu;
