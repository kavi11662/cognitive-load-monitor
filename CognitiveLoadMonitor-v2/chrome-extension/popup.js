// Popup Script - Extension popup UI

class PopupManager {
  constructor() {
    this.setupEventListeners();
    this.updatePopup();
    this.refreshInterval = setInterval(() => this.updatePopup(), 2000);
  }

  setupEventListeners() {
    // Student mode buttons
    const dashboardBtn = document.getElementById('popup-dashboard-btn');
    const resetBtn = document.getElementById('popup-reset-btn');
    
    if (dashboardBtn) {
      dashboardBtn.addEventListener('click', () => this.openDashboard());
    }
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetName());
    }

    // Teacher mode buttons
    const openDashboardBtn = document.getElementById('popup-open-dashboard-btn');
    const changeRoleBtn = document.getElementById('popup-change-role-btn');
    
    if (openDashboardBtn) {
      openDashboardBtn.addEventListener('click', () => this.openDashboard());
    }
    if (changeRoleBtn) {
      changeRoleBtn.addEventListener('click', () => this.changeRole());
    }
  }

  updatePopup() {
    const userRole = localStorage.getItem('userRole');
    const studentName = localStorage.getItem('studentName') || 'Not set';
    const connectionStatus = localStorage.getItem('connectionStatus') || 'disconnected';
    const cognitiveScore = localStorage.getItem('cognitiveScore') || null;

    // Update role badge and content visibility
    const roleBadge = document.getElementById('popup-role-badge');
    const roleText = document.getElementById('popup-role-text');
    const studentContent = document.getElementById('student-content');
    const teacherContent = document.getElementById('teacher-content');

    if (userRole === 'teacher') {
      roleBadge.textContent = '👨‍🏫 Teacher Mode';
      roleText.textContent = 'Teacher Dashboard';
      studentContent.style.display = 'none';
      teacherContent.style.display = 'block';
      this.updateTeacherStats();
    } else if (userRole === 'student') {
      roleBadge.textContent = '👨‍🎓 Student Mode';
      roleText.textContent = 'Student Monitoring';
      studentContent.style.display = 'block';
      teacherContent.style.display = 'none';
      
      // Update student name
      document.getElementById('popup-student-name').textContent = studentName;
    } else {
      roleBadge.textContent = 'No Role Selected';
      roleText.textContent = 'Open extension in Google Meet to select role';
      studentContent.style.display = 'none';
      teacherContent.style.display = 'none';
    }

    // Update connection status
    const statusDot = document.getElementById('popup-status-dot');
    const statusText = document.getElementById('popup-status-text');
    
    statusDot.className = 'status-dot ' + connectionStatus;
    
    if (connectionStatus === 'connected') {
      statusText.textContent = 'Connected';
    } else if (connectionStatus === 'connecting') {
      statusText.textContent = 'Connecting...';
    } else if (connectionStatus === 'offline') {
      statusText.textContent = 'Server offline';
    } else {
      statusText.textContent = 'Disconnected';
    }

    // Update score display (student mode)
    if (userRole === 'student' && cognitiveScore !== null && userRole) {
      const score = parseInt(cognitiveScore);
      const label = this.getScoreLabel(score);
      const emoji = this.getScoreEmoji(score);
      const color = this.getScoreColor(score);

      document.getElementById('popup-score-emoji').textContent = emoji;
      document.getElementById('popup-score-label').textContent = label;
      document.getElementById('popup-score-value').textContent = score;
      document.querySelector('.score-display').style.borderLeftColor = color;
    } else if (userRole === 'student') {
      document.getElementById('popup-score-emoji').textContent = '😐';
      document.getElementById('popup-score-label').textContent = 'Not monitoring';
      document.getElementById('popup-score-value').textContent = '—';
      document.querySelector('.score-display').style.borderLeftColor = '#888';
    }
  }

  updateTeacherStats() {
    try {
      const studentsData = localStorage.getItem('teacherStudents');
      const students = studentsData ? JSON.parse(studentsData) : {};
      const studentList = Object.values(students);
      const count = studentList.length;

      let totalScore = 0;
      let overloadedCount = 0;

      studentList.forEach(student => {
        totalScore += (student.score || 0);
        if ((student.score || 0) >= 70) {
          overloadedCount++;
        }
      });

      const avgScore = count > 0 ? Math.round(totalScore / count) : 0;
      const overloadedPercent = count > 0 ? (overloadedCount / count) * 100 : 0;

      document.getElementById('popup-students-count').textContent = count;
      document.getElementById('popup-avg-score').textContent = avgScore;
      document.getElementById('popup-overloaded-count').textContent = overloadedCount;

      const alertBanner = document.getElementById('popup-alert-banner');
      if (overloadedPercent >= 30) {
        alertBanner.classList.add('show');
      } else {
        alertBanner.classList.remove('show');
      }
    } catch (err) {
      console.error('Error updating teacher stats:', err);
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
    const userRole = localStorage.getItem('userRole');
    if (userRole === 'student') {
      localStorage.removeItem('studentName');
      localStorage.removeItem('cognitiveScore');
      localStorage.removeItem('connectionStatus');
      localStorage.removeItem('monitoringActive');
      document.getElementById('popup-student-name').textContent = 'Not set';
      document.getElementById('popup-score-label').textContent = 'Not monitoring';
      document.getElementById('popup-score-value').textContent = '—';
      this.showMessage('Student name reset successfully', false);
    }
  }

  changeRole() {
    localStorage.removeItem('userRole');
    localStorage.removeItem('studentName');
    localStorage.removeItem('teacherStudents');
    this.showMessage('Role cleared. Reload extension in Meet.', false);
    setTimeout(() => {
      this.updatePopup();
    }, 1500);
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

