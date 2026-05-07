// Cognitive Load Monitor - Content Script
// This script runs on Google Meet pages and monitors student cognitive load

class CognitiveLoadMonitor {
  constructor() {
    this.ws = null;
    this.isMonitoring = false;
    this.studentName = localStorage.getItem('studentName') || '';
    this.videoStream = null;
    this.canvas = null;
    this.canvasContext = null;
    this.lastFrameData = null;
    this.lastBlinkTime = 0;
    this.blinkCount = 0;
    this.blink_rate = 0;
    this.face_present = false;
    this.hesitationStartTime = null;
    this.lastKeydownTime = 0;
    this.hesitation_ms = 0;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.mouseDistances = [];
    this.mouse_erratic = 0;
    this.currentScore = null;
    this.currentLabel = null;
    this.isMinimized = false;
    this.monitoringInterval = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 3000;
  }

  async init() {
    await this.waitForMeetToLoad();
    this.createFloatingPanel();
    this.setupEventListeners();
    this.loadSavedName();
  }

  waitForMeetToLoad() {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, 3000);
    });
  }

  createFloatingPanel() {
    const panel = document.createElement('div');
    panel.id = 'cognitive-load-monitor-panel';
    panel.innerHTML = `
      <div id="clm-header">
        <span id="clm-title">Cognitive Load Monitor</span>
        <span id="clm-minimize">−</span>
      </div>
      <div id="clm-content">
        <div id="clm-name-section">
          <input type="text" id="clm-student-name" placeholder="Enter your name" />
        </div>
        <div id="clm-status-section">
          <div id="clm-status-dot" class="status-dot disconnected"></div>
          <span id="clm-status-text">Disconnected</span>
        </div>
        <div id="clm-score-section" class="hidden">
          <div id="clm-score-display">
            <span id="clm-score-emoji">😊</span>
            <div id="clm-score-info">
              <span id="clm-score-label">Focused</span>
              <span id="clm-score-value">0</span>
            </div>
          </div>
          <div id="clm-metrics">
            <div class="metric">
              <span class="metric-label">Blinks:</span>
              <span id="clm-blink-rate" class="metric-value">0</span>
            </div>
            <div class="metric">
              <span class="metric-label">Face:</span>
              <span id="clm-face-present" class="metric-value">No</span>
            </div>
          </div>
        </div>
        <div id="clm-button-section">
          <button id="clm-start-btn" class="btn btn-start">Start Monitoring</button>
          <button id="clm-stop-btn" class="btn btn-stop hidden">Stop</button>
        </div>
      </div>
    `;
    document.body.appendChild(panel);
    this.panel = panel;
  }

  setupEventListeners() {
    const startBtn = document.getElementById('clm-start-btn');
    const stopBtn = document.getElementById('clm-stop-btn');
    const nameInput = document.getElementById('clm-student-name');
    const header = document.getElementById('clm-header');
    const minimizeBtn = document.getElementById('clm-minimize');

    startBtn.addEventListener('click', () => this.startMonitoring());
    stopBtn.addEventListener('click', () => this.stopMonitoring());
    nameInput.addEventListener('change', (e) => this.saveName(e.target.value));
    header.addEventListener('mousedown', (e) => this.setupDrag(e));
    minimizeBtn.addEventListener('click', () => this.toggleMinimize());

    document.addEventListener('keydown', (e) => this.trackKeyPress(e));
    document.addEventListener('mousemove', (e) => this.trackMouseMove(e));
  }

  loadSavedName() {
    const savedName = localStorage.getItem('studentName');
    if (savedName) {
      document.getElementById('clm-student-name').value = savedName;
      this.studentName = savedName;
    }
  }

  saveName(name) {
    this.studentName = name;
    localStorage.setItem('studentName', name);
  }

  setupDrag(e) {
    if (e.target.id === 'clm-minimize' || e.target.id === 'clm-title') {
      return;
    }
    const rect = this.panel.getBoundingClientRect();
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;

    const onMouseMove = (moveEvent) => {
      const x = moveEvent.clientX - startX;
      const y = moveEvent.clientY - startY;
      this.panel.style.left = x + 'px';
      this.panel.style.top = y + 'px';
      this.panel.style.right = 'auto';
      this.panel.style.bottom = 'auto';
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  toggleMinimize() {
    const content = document.getElementById('clm-content');
    this.isMinimized = !this.isMinimized;
    if (this.isMinimized) {
      content.style.display = 'none';
      document.getElementById('clm-minimize').textContent = '+';
      this.panel.style.height = 'auto';
    } else {
      content.style.display = 'block';
      document.getElementById('clm-minimize').textContent = '−';
    }
  }

  async startMonitoring() {
    if (!this.studentName) {
      alert('Please enter your name first');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });
      this.videoStream = stream;
      this.setupCanvas();
      this.isMonitoring = true;
      this.reconnectAttempts = 0;
      this.connectWebSocket();
      this.startCaptureLoop();
      this.updateUI();

      document.getElementById('clm-start-btn').classList.add('hidden');
      document.getElementById('clm-stop-btn').classList.remove('hidden');
      document.getElementById('clm-score-section').classList.remove('hidden');
      document.getElementById('clm-student-name').disabled = true;
    } catch (err) {
      console.error('Camera access denied:', err);
      alert('Please allow camera access to use Cognitive Load Monitor');
    }
  }

  stopMonitoring() {
    this.isMonitoring = false;
    if (this.videoStream) {
      this.videoStream.getTracks().forEach(track => track.stop());
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    this.updateStatusUI('disconnected', 'Disconnected');
    document.getElementById('clm-start-btn').classList.remove('hidden');
    document.getElementById('clm-stop-btn').classList.add('hidden');
    document.getElementById('clm-score-section').classList.add('hidden');
    document.getElementById('clm-student-name').disabled = false;
  }

  setupCanvas() {
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.width = 320;
      this.canvas.height = 240;
      this.canvasContext = this.canvas.getContext('2d');
    }
  }

  startCaptureLoop() {
    const video = document.createElement('video');
    video.srcObject = this.videoStream;
    video.play();

    this.monitoringInterval = setInterval(() => {
      if (!this.isMonitoring) return;

      try {
        this.canvasContext.drawImage(video, 0, 0, this.canvas.width, this.canvas.height);
        const frameData = this.canvasContext.getImageData(0, 0, this.canvas.width, this.canvas.height);
        this.analyzeFrame(frameData);
        this.sendMetrics();
      } catch (err) {
        console.error('Error capturing frame:', err);
      }
    }, 1000);
  }

  analyzeFrame(frameData) {
    const data = frameData.data;
    let brightness = 0;
    let pixelCount = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      brightness += (0.299 * r + 0.587 * g + 0.114 * b);
      pixelCount++;
    }

    brightness = brightness / pixelCount;
    this.face_present = brightness > 50;

    if (this.lastFrameData !== null) {
      const brightnessDiff = Math.abs(brightness - this.lastFrameData);
      if (brightnessDiff > 30) {
        const now = Date.now();
        if (now - this.lastBlinkTime > 100) {
          this.blinkCount++;
          this.lastBlinkTime = now;
        }
      }
    }
    this.lastFrameData = brightness;

    const now = Date.now();
    const timeDiff = now - (this.lastBlinkTime - 1000);
    this.blink_rate = Math.max(0, this.blinkCount);
  }

  trackKeyPress(e) {
    if (!this.isMonitoring) return;
    this.lastKeydownTime = Date.now();
    if (this.hesitationStartTime === null) {
      this.hesitationStartTime = Date.now();
    }
  }

  trackMouseMove(e) {
    if (!this.isMonitoring) return;
    const distance = Math.sqrt(
      Math.pow(e.clientX - this.lastMouseX, 2) +
      Math.pow(e.clientY - this.lastMouseY, 2)
    );
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;

    this.mouseDistances.push(distance);
    if (this.mouseDistances.length > 30) {
      this.mouseDistances.shift();
    }

    if (this.mouseDistances.length > 5) {
      const avg = this.mouseDistances.reduce((a, b) => a + b, 0) / this.mouseDistances.length;
      const variance = this.mouseDistances.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / this.mouseDistances.length;
      this.mouse_erratic = Math.sqrt(variance);
    }
  }

  connectWebSocket() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    const wsUrl = `wss://cognitive-load-monitor-production.up.railway.app/ws/student/${encodeURIComponent(this.studentName)}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.updateStatusUI('connected', 'Connected');
        console.log('Connected to monitoring server');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.cognitive_load_score !== undefined) {
            this.currentScore = Math.round(data.cognitive_load_score);
            this.updateScoreDisplay(this.currentScore);
          }
        } catch (err) {
          console.error('Error parsing message:', err);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.updateStatusUI('disconnected', 'Error');
      };

      this.ws.onclose = () => {
        this.updateStatusUI('disconnected', 'Disconnected');
        if (this.isMonitoring && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          this.updateStatusUI('connecting', 'Reconnecting...');
          setTimeout(() => this.connectWebSocket(), this.reconnectDelay);
        }
      };
    } catch (err) {
      console.error('WebSocket connection error:', err);
      this.updateStatusUI('disconnected', 'Connection Failed');
    }
  }

  sendMetrics() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const metrics = {
        student_name: this.studentName,
        blink_rate: this.blink_rate,
        face_present: this.face_present,
        hesitation_ms: this.hesitation_ms,
        mouse_erratic: Math.round(this.mouse_erratic),
        timestamp: new Date().toISOString()
      };

      try {
        this.ws.send(JSON.stringify(metrics));
      } catch (err) {
        console.error('Error sending metrics:', err);
      }
    }
  }

  updateScoreDisplay(score) {
    const label = this.getScoreLabel(score);
    const emoji = this.getScoreEmoji(score);
    const color = this.getScoreColor(score);

    this.currentLabel = label;
    document.getElementById('clm-score-emoji').textContent = emoji;
    document.getElementById('clm-score-label').textContent = label;
    document.getElementById('clm-score-value').textContent = score;
    document.getElementById('clm-score-display').style.borderLeftColor = color;
    document.getElementById('clm-blink-rate').textContent = this.blink_rate;
    document.getElementById('clm-face-present').textContent = this.face_present ? 'Yes' : 'No';
  }

  getScoreLabel(score) {
    if (score < 30) return 'Disengaged';
    if (score < 50) return 'Relaxed';
    if (score < 70) return 'Focused';
    return 'Overloaded';
  }

  getScoreEmoji(score) {
    if (score < 30) return '😐';
    if (score < 50) return '😊';
    if (score < 70) return '🧠';
    return '😰';
  }

  getScoreColor(score) {
    if (score < 30) return '#FF9800';
    if (score < 50) return '#4CAF50';
    if (score < 70) return '#2196F3';
    return '#F44336';
  }

  updateStatusUI(status, text) {
    const dot = document.getElementById('clm-status-dot');
    dot.className = 'status-dot ' + status;
    document.getElementById('clm-status-text').textContent = text;
  }

  updateUI() {
    // UI updated by event listeners
  }
}

// Initialize the monitor when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const monitor = new CognitiveLoadMonitor();
    monitor.init();
  });
} else {
  const monitor = new CognitiveLoadMonitor();
  monitor.init();
}
