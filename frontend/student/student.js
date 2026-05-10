const nameInput = document.getElementById('nameInput');
const startBtn = document.getElementById('startBtn');
const studentArea = document.getElementById('studentArea');
const status = document.getElementById('status');
const infoText = document.getElementById('infoText');
const video = document.getElementById('video');

let websocket;
let canvas, ctx;
let lastBrightness = 0;
let blinkTimer = Date.now();
let recentBlinkTimes = [];
let lastKeyTime = null;
let typingIntervals = [];
let lastActivity = Date.now();
let mouseSpeeds = [];
let lastMouse = null;
let lastStatus = null;

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function updateInfo(text) {
    infoText.textContent = text;
}

function updateStatus(score, label) {
    const emoji = label === 'Focused' ? '😊' : label === 'Overloaded' ? '😵' : label === 'Disengaged' ? '😴' : '😌';
    status.innerHTML = `<strong>${emoji} ${label}</strong> — Live score ${score}`;
}

function calculateMetrics() {
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let sum = 0;
    for (let i = 0; i < image.data.length; i += 4) {
        sum += image.data[i] * 0.3 + image.data[i + 1] * 0.59 + image.data[i + 2] * 0.11;
    }
    const brightness = sum / (canvas.width * canvas.height);
    const facePresent = brightness > 20;

    const now = Date.now();
    if (brightness < 45 && lastBrightness >= 45 && now - blinkTimer > 250) {
        recentBlinkTimes.push(now);
        blinkTimer = now;
    }
    lastBrightness = brightness;

    recentBlinkTimes = recentBlinkTimes.filter(ts => now - ts <= 60000);
    const blinkRate = clamp(Math.round(recentBlinkTimes.length * 6 + 2), 2, 45);

    const movementScore = mouseSpeeds.length > 0 ? 50 + Math.min(40, mouseSpeeds.reduce((a, b) => a + b, 0) / mouseSpeeds.length) : 40;
    const expressionScore = clamp(Math.round((100 - Math.abs(130 - brightness) * 0.6) + (movementScore * 0.3)), 20, 100);

    const hesitationMs = typingIntervals.length > 0 ? Math.round(typingIntervals.reduce((a, b) => a + b, 0) / typingIntervals.length) : 900;
    const averageSpeed = mouseSpeeds.length > 0 ? mouseSpeeds.reduce((a, b) => a + b, 0) / mouseSpeeds.length : 0;
    const variance = mouseSpeeds.length > 1 ? mouseSpeeds.reduce((a, b) => a + Math.pow(b - averageSpeed, 2), 0) / mouseSpeeds.length : 0;
    const mouseErratic = clamp(variance / 400, 0, 1);

    const responseDelay = clamp(Date.now() - lastActivity, 100, 2200);

    return {
        blink_rate: blinkRate,
        face_present: facePresent,
        expression_score: expressionScore,
        hesitation_ms: hesitationMs,
        mouse_erratic: Number(mouseErratic.toFixed(2)),
        response_delay: responseDelay,
        timestamp: new Date().toISOString(),
    };
}

function sendMetrics() {
    if (!websocket || websocket.readyState !== WebSocket.OPEN) return;
    const metrics = calculateMetrics();
    if (!metrics) return;
    websocket.send(JSON.stringify({
        student_name: nameInput.value.trim(),
        ...metrics,
    }));

    updateInfo(`Blink rate: ${metrics.blink_rate} bpm · Face present: ${metrics.face_present} · Hesitation: ${metrics.hesitation_ms} ms · Mouse erratic: ${metrics.mouse_erratic}`);
}

function startWebcam() {
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then(stream => {
            video.srcObject = stream;
            video.onloadedmetadata = () => {
                canvas = document.createElement('canvas');
                canvas.width = 320;
                canvas.height = 180;
                ctx = canvas.getContext('2d');
                studentArea.style.display = 'block';
                setInterval(sendMetrics, 1000);
            };
        })
        .catch(() => {
            updateInfo('Unable to start webcam. Please allow camera access.');
        });
}

function connectWebSocket(name) {
    websocket = new WebSocket(`wss://cognitive-load-monitor-k490.onrender.com/ws/student/${encodeURIComponent(name)}`);
    websocket.onopen = () => updateInfo('Connected to backend and sending live signals.');
    websocket.onmessage = event => {
        const payload = JSON.parse(event.data);
        updateStatus(payload.score, payload.label);
    };
    websocket.onclose = () => updateInfo('Connection closed. Refresh to reconnect.');
    websocket.onerror = () => updateInfo('WebSocket error. Is backend running on localhost:8000?');
}

window.addEventListener('mousemove', event => {
    lastActivity = Date.now();
    const now = Date.now();
    if (lastMouse) {
        const dx = event.clientX - lastMouse.x;
        const dy = event.clientY - lastMouse.y;
        const dt = Math.max(16, now - lastMouse.time);
        const speed = Math.sqrt(dx * dx + dy * dy) / dt * 100;
        mouseSpeeds.push(speed);
        if (mouseSpeeds.length > 40) mouseSpeeds.shift();
    }
    lastMouse = { x: event.clientX, y: event.clientY, time: now };
});

window.addEventListener('keydown', () => {
    const now = Date.now();
    if (lastKeyTime) {
        const interval = clamp(now - lastKeyTime, 80, 3000);
        typingIntervals.push(interval);
        if (typingIntervals.length > 40) typingIntervals.shift();
    }
    lastKeyTime = now;
    lastActivity = now;
});

startBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (!name) {
        alert('Please enter your name to start monitoring.');
        return;
    }
    startBtn.disabled = true;
    nameInput.disabled = true;
    connectWebSocket(name);
    startWebcam();
});
