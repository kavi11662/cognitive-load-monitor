// Popup Script - Extension popup UI

class PopupManager {
  constructor() {
    this.setupEventListeners();
    this.updatePopup();
    this.refreshInterval = setInterval(() => this.updatePopup(), 2000);
  }

  setupEventListeners() {
    document.getElementById('popup-dashboard-btn').addEventListener('click', () => {
      this.openDashboard();
    });

    document.getElementById('popup-reset-btn').addEventListener('click', () => {
      this.resetName();
    });
  }

  updatePopup() {
    const studentName = localStorage.getItem('studentName') || 'Not set';
    const monitoringActive = localStorage.getItem('monitoringActive') === 'true';
    const cognitiveScore = localStorage.getItem('cognitiveScore') || null;
    const connectionStatus = localStorage.getItem('connectionStatus') || 'disconnected';

    // Update student name
    document.getElementById('popup-student-name').textContent = studentName;

    // Update connection status
    const statusDot = document.getElementById('popup-status-dot');
    const statusText = document.getElementById('popup-status-text');
    
    statusDot.className = 'status-dot ' + connectionStatus;
    
    if (connectionStatus === 'connected') {
      statusText.textContent = 'Connected';
    } else if (connectionStatus === 'connecting') {
      statusText.textContent = 'Connecting...';
    } else {
      statusText.textContent = 'Disconnected';
    }

    // Update score display
    if (cognitiveScore !== null && monitoringActive) {
      const score = parseInt(cognitiveScore);
      const label = this.getScoreLabel(score);
      const emoji = this.getScoreEmoji(score);
      const color = this.getScoreColor(score);

      document.getElementById('popup-score-emoji').textContent = emoji;
      document.getElementById('popup-score-label').textContent = label;
      document.getElementById('popup-score-value').textContent = score;
      document.querySelector('.score-display').style.borderLeftColor = color;
    } else {
      document.getElementById('popup-score-emoji').textContent = '😐';
      document.getElementById('popup-score-label').textContent = 'Not monitoring';
      document.getElementById('popup-score-value').textContent = '—';
      document.querySelector('.score-display').style.borderLeftColor = '#888';
    }
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

  openDashboard() {
    const dashboardUrl = 'https://cognitive-load-monitor-production.up.railway.app/docs';
    chrome.tabs.create({ url: dashboardUrl });
  }

  resetName() {
    localStorage.removeItem('studentName');
    localStorage.removeItem('cognitiveScore');
    localStorage.removeItem('connectionStatus');
    localStorage.removeItem('monitoringActive');
    document.getElementById('popup-student-name').textContent = 'Not set';
    document.getElementById('popup-score-label').textContent = 'Not monitoring';
    document.getElementById('popup-score-value').textContent = '—';
    this.showMessage('Name reset successfully', false);
  }

  showMessage(text, isError = false) {
    const messageEl = document.getElementById('popup-message');
    messageEl.textContent = text;
    messageEl.classList.toggle('error', isError);
    messageEl.style.display = 'block';
    setTimeout(() => {
      messageEl.style.display = 'none';
    }, 3000);
  }
}

// Initialize popup manager
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});
