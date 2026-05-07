// Cognitive Load Monitor - Content Script
// This script runs on Google Meet pages and monitors student/teacher cognitive load

class CognitiveLoadMonitor {
  constructor() {
    this.ws = null;
    this.isMonitoring = false;
    this.userRole = localStorage.getItem('userRole') || null;
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
    this.wsTimeout = null;
    this.lastUpdateTime = null;
    this.pingInterval = null;
    this.students = {}; // For teacher role
    this.panelWidth = 220; // Default for student
  }

  async init() {
    await this.waitForMeetToLoad();
    
    // Check if role is already selected
    if (this.userRole) {
      // Role already selected, show appropriate panel
      this.createFloatingPanel();
      this.setupEventListeners();
      if (this.userRole === 'student') {
        this.loadSavedName();
      } else {
        this.setupTeacherMode();
      }
    } else {
      // Show role selection screen
      this.showRoleSelection();
    }
  }

  waitForMeetToLoad() {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, 3000);
    });
  }

  showRoleSelection() {
    const panel = document.createElement('div');
    panel.id = 'cognitive-load-monitor-panel';
    panel.classList.add('role-selection-panel');
    panel.innerHTML = `
      <div id="clm-header">
        <span id="clm-title">Cognitive Load Monitor</span>
        <span id="clm-minimize">−</span>
      </div>
      <div id="clm-content" class="role-selection-content">
        <div class="role-selection-title">Who are you?</div>
        <div class="role-buttons">
          <button id="role-teacher-btn" class="role-btn">
            <span class="role-emoji">👨‍🏫</span>
            <span>I am a Teacher</span>
          </button>
          <button id="role-student-btn" class="role-btn">
            <span class="role-emoji">👨‍🎓</span>
            <span>I am a Student</span>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(panel);
    this.panel = panel;

    document.getElementById('role-teacher-btn').addEventListener('click', () => {
      this.selectRole('teacher');
    });

    document.getElementById('role-student-btn').addEventListener('click', () => {
      this.selectRole('student');
    });

    document.getElementById('clm-minimize').addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleMinimize();
    });

    // Make draggable
    document.getElementById('clm-header').addEventListener('mousedown', (e) => {
      if (e.target.id === 'clm-minimize') return;
      this.setupDrag(e);
    });
  }

  selectRole(role) {
    localStorage.setItem('userRole', role);
    this.userRole = role;
    
    // Remove the role selection panel
    if (this.panel) {
      this.panel.remove();
    }

    // Create the actual monitoring panel
    this.createFloatingPanel();
    this.setupEventListeners();
    
    if (role === 'student') {
      this.loadSavedName();
    } else {
      this.setupTeacherMode();
    }
  }

  setupTeacherMode() {
    // Teacher mode setup
    this.panelWidth = 280;
    this.updatePanelWidthForTeacher();
  }

  createFloatingPanel() {
    const panel = document.createElement('div');
    panel.id = 'cognitive-load-monitor-panel';
    
    if (this.userRole === 'teacher') {
      panel.classList.add('teacher-panel');
      panel.innerHTML = `
        <div id="clm-header">
          <span id="clm-title">👨‍🏫 Teacher Dashboard</span>
          <span id="clm-minimize">−</span>
        </div>
        <div id="clm-content">
          <div id="teacher-stats">
            <div class="stat-item">
              <span class="stat-label">Students:</span>
              <span class="stat-value" id="students-count">0</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Avg:</span>
              <span class="stat-value" id="avg-score">0</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Overloaded:</span>
              <span class="stat-value" id="overloaded-count">0</span>
            </div>
          </div>
          <div id="teacher-alert" class="alert-banner hidden">
            ⚠️ Slow Down! 30%+ students overloaded
          </div>
          <div id="students-list" class="students-list"></div>
          <div id="teacher-buttons">
            <button id="open-dashboard-btn" class="btn btn-primary">Open Full Dashboard</button>
            <button id="change-role-btn" class="btn btn-secondary">Change Role</button>
          </div>
          <div id="teacher-status">
            <div id="clm-status-section">
              <div id="clm-status-dot" class="status-dot disconnected"></div>
              <span id="clm-status-text">Disconnected</span>
            </div>
            <div id="updated-time">Updated: --:--:--</div>
          </div>
        </div>
      `;
    } else {
      panel.classList.add('student-panel');
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
            <button id="change-role-btn" class="btn btn-secondary">Change Role</button>
          </div>
          <div id="updated-time">Updated: --:--:--</div>
        </div>
      `;
    }
    
    document.body.appendChild(panel);
    this.panel = panel;
  }

  updatePanelWidthForTeacher() {
    if (this.panel) {
      this.panel.style.width = '280px';
    }
  }

  setupEventListeners() {
    const header = document.getElementById('clm-header');
    const minimizeBtn = document.getElementById('clm-minimize');
    const changeRoleBtn = document.getElementById('change-role-btn');

    header.addEventListener('mousedown', (e) => this.setupDrag(e));
    minimizeBtn.addEventListener('click', () => this.toggleMinimize());
    changeRoleBtn.addEventListener('click', () => this.resetRole());

    if (this.userRole === 'student') {
      const startBtn = document.getElementById('clm-start-btn');
      const stopBtn = document.getElementById('clm-stop-btn');
      const nameInput = document.getElementById('clm-student-name');

      startBtn.addEventListener('click', () => this.startMonitoring());
      stopBtn.addEventListener('click', () => this.stopMonitoring());
      nameInput.addEventListener('change', (e) => this.saveName(e.target.value));

      document.addEventListener('keydown', (e) => this.trackKeyPress(e));
      document.addEventListener('mousemove', (e) => this.trackMouseMove(e));
    } else {
      const dashboardBtn = document.getElementById('open-dashboard-btn');
      dashboardBtn.addEventListener('click', () => this.openFullDashboard());
      
      // For teacher mode, automatically start monitoring
      this.startTeacherMonitoring();
    }
  }

  resetRole() {
    if (confirm('Change your role? You will need to restart.')) {
      localStorage.removeItem('userRole');
      localStorage.removeItem('studentName');
      if (this.ws) this.ws.close();
      if (this.videoStream) {
        this.videoStream.getTracks().forEach(track => track.stop());
      }
      if (this.monitoringInterval) clearInterval(this.monitoringInterval);
      if (this.pingInterval) clearInterval(this.pingInterval);
      if (this.wsTimeout) clearTimeout(this.wsTimeout);
      if (this.panel) this.panel.remove();
      
      const monitor = new CognitiveLoadMonitor();
      monitor.init();
    }
  }

  openFullDashboard() {
    chrome.tabs.create({ 
      url: 'https://cognitive-load-monitor-production.up.railway.app/docs' 
    });
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
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    if (this.wsTimeout) {
      clearTimeout(this.wsTimeout);
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

    let wsUrl;
    if (this.userRole === 'teacher') {
      wsUrl = 'wss://cognitive-load-monitor-production.up.railway.app/ws/teacher';
    } else {
      wsUrl = `wss://cognitive-load-monitor-production.up.railway.app/ws/student/${encodeURIComponent(this.studentName)}`;
    }

    try {
      this.ws = new WebSocket(wsUrl);

      // Set 10-second timeout for connection
      this.wsTimeout = setTimeout(() => {
        if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
          this.updateStatusUI('offline', 'Server offline');
          setTimeout(() => {
            if (this.isMonitoring && this.ws && this.ws.readyState !== WebSocket.OPEN) {
              this.connectWebSocket();
            }
          }, 3000);
        }
      }, 10000);

      this.ws.onopen = () => {
        if (this.wsTimeout) clearTimeout(this.wsTimeout);
        this.reconnectAttempts = 0;
        this.updateStatusUI('connected', 'Connected');
        console.log('Connected to monitoring server');

        // Start ping interval
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 25000);
      };

      this.ws.onmessage = (event) => {
        try {
          this.lastUpdateTime = new Date();
          this.updateUpdatedTime();
          
          const data = JSON.parse(event.data);
          
          if (this.userRole === 'teacher') {
            this.handleTeacherMessage(data);
          } else {
            if (data.cognitive_load_score !== undefined) {
              this.currentScore = Math.round(data.cognitive_load_score);
              this.updateScoreDisplay(this.currentScore);
            }
          }
        } catch (err) {
          console.error('Error parsing message:', err);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        if (this.wsTimeout) clearTimeout(this.wsTimeout);
        this.updateStatusUI('offline', 'Server offline');
      };

      this.ws.onclose = () => {
        if (this.wsTimeout) clearTimeout(this.wsTimeout);
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.updateStatusUI('disconnected', 'Disconnected');
        
        if (this.isMonitoring && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          this.updateStatusUI('connecting', 'Reconnecting...');
          setTimeout(() => this.connectWebSocket(), this.reconnectDelay);
        }
      };
    } catch (err) {
      console.error('WebSocket connection error:', err);
      this.updateStatusUI('offline', 'Server offline');
    }
  }

  sendMetrics() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

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
      this.lastUpdateTime = new Date();
      this.updateUpdatedTime();
    } catch (err) {
      console.error('Error sending metrics:', err);
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
    if (dot) {
      dot.className = 'status-dot ' + status;
    }
    const statusText = document.getElementById('clm-status-text');
    if (statusText) {
      statusText.textContent = text;
    }
  }

  updateUpdatedTime() {
    const timeEl = document.getElementById('updated-time');
    if (timeEl && this.lastUpdateTime) {
      const hours = String(this.lastUpdateTime.getHours()).padStart(2, '0');
      const minutes = String(this.lastUpdateTime.getMinutes()).padStart(2, '0');
      const seconds = String(this.lastUpdateTime.getSeconds()).padStart(2, '0');
      timeEl.textContent = `Updated: ${hours}:${minutes}:${seconds}`;
    }
  }

  handleTeacherMessage(data) {
    // Handle teacher-specific messages
    if (data.type === 'student_update') {
      if (data.student_name) {
        this.students[data.student_name] = {
          name: data.student_name,
          score: Math.round(data.cognitive_load_score || 0),
          label: this.getScoreLabel(data.cognitive_load_score),
          emoji: this.getScoreEmoji(data.cognitive_load_score),
          color: this.getScoreColor(data.cognitive_load_score)
        };
        this.updateTeacherDashboard();
      }
    } else if (Array.isArray(data)) {
      // If backend sends array of students
      this.students = {};
      data.forEach(student => {
        const score = Math.round(student.cognitive_load_score || 0);
        this.students[student.student_name] = {
          name: student.student_name,
          score: score,
          label: this.getScoreLabel(score),
          emoji: this.getScoreEmoji(score),
          color: this.getScoreColor(score)
        };
      });
      this.updateTeacherDashboard();
    }
  }

  updateTeacherDashboard() {
    const studentsList = Object.values(this.students);
    const count = studentsList.length;
    
    let totalScore = 0;
    let overloadedCount = 0;
    
    studentsList.forEach(student => {
      totalScore += student.score;
      if (student.score >= 70) {
        overloadedCount++;
      }
    });

    const avgScore = count > 0 ? Math.round(totalScore / count) : 0;
    const overloadedPercent = count > 0 ? (overloadedCount / count) * 100 : 0;

    // Update stats
    document.getElementById('students-count').textContent = count;
    document.getElementById('avg-score').textContent = avgScore;
    document.getElementById('overloaded-count').textContent = overloadedCount;

    // Show/hide alert banner
    const alertBanner = document.getElementById('teacher-alert');
    if (overloadedPercent >= 30) {
      alertBanner.classList.remove('hidden');
    } else {
      alertBanner.classList.add('hidden');
    }

    // Update students list
    const listEl = document.getElementById('students-list');
    if (listEl) {
      listEl.innerHTML = studentsList.map(student => `
        <div class="student-card" style="border-left-color: ${student.color}">
          <div class="student-emoji">${student.emoji}</div>
          <div class="student-info">
            <div class="student-name">${student.name}</div>
            <div class="student-score">${student.score} - ${student.label}</div>
          </div>
        </div>
      `).join('');
    }
  }

  startTeacherMonitoring() {
    this.isMonitoring = true;
    this.reconnectAttempts = 0;
    this.connectWebSocket();
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
