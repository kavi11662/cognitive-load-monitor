const studentCards = document.getElementById('studentCards');
const alertBanner = document.getElementById('alertBanner');
const studentCount = document.getElementById('studentCount');
const avgScore = document.getElementById('avgScore');
const overloadedCount = document.getElementById('overloadedCount');
const bars = document.getElementById('bars');

let history = [];

function labelEmoji(label) {
    if (label === 'Focused') return '😊';
    if (label === 'Relaxed') return '😌';
    if (label === 'Overloaded') return '😵';
    return '😴';
}

function buildCard(student) {
    const colors = {
        Focused: '#10b981',
        Relaxed: '#3b82f6',
        Overloaded: '#ef4444',
        Disengaged: '#f97316',
    };
    const bg = colors[student.label] || '#6b7280';
    return `
        <div class="card" style="background:${bg};">
            <h3>${student.student_name}</h3>
            <p style="font-size: 2rem; margin: 8px 0;">${labelEmoji(student.label)} ${student.score_value}</p>
            <p>${student.label}</p>
            <p style="font-size: 0.9rem; margin-top: 12px;">Updated ${new Date(student.timestamp).toLocaleTimeString()}</p>
        </div>
    `;
}

function renderBarChart() {
    bars.innerHTML = '';
    const maxPoints = 12;
    const display = history.slice(-maxPoints);
    const maxValue = 100;
    display.forEach(point => {
        const height = Math.max(8, (point.value / maxValue) * 150);
        const bar = document.createElement('div');
        bar.className = 'bar';
        bar.style.height = `${height}px`;
        bar.title = `${point.time} → ${point.value}`;
        bars.appendChild(bar);
    });
}

function refreshDashboard(scores) {
    studentCards.innerHTML = scores.map(buildCard).join('');
    const count = scores.length;
    const avg = count ? Math.round(scores.reduce((sum, item) => sum + item.score_value, 0) / count) : 0;
    const overloaded = scores.filter(item => item.label === 'Overloaded').length;
    studentCount.textContent = `Students: ${count}`;
    avgScore.textContent = `Average: ${avg}`;
    overloadedCount.textContent = `Overloaded: ${overloaded}`;

    const overloadRatio = count ? overloaded / count : 0;
    alertBanner.style.display = overloadRatio >= 0.3 ? 'block' : 'none';

    history.push({ time: new Date().toLocaleTimeString(), value: avg });
    if (history.length > 24) history.shift();
    renderBarChart();
}

function connectTeacherSocket() {
    const ws = new WebSocket('ws://127.0.0.1:8000/ws/teacher');
    ws.onopen = () => console.log('Teacher socket connected');
    ws.onmessage = event => {
        const message = JSON.parse(event.data);
        if (message.scores) {
            refreshDashboard(message.scores);
        }
    };
    ws.onclose = () => {
        alertBanner.textContent = 'Connection lost. Reload to reconnect.';
        alertBanner.style.display = 'block';
    };
    ws.onerror = () => {
        alertBanner.textContent = 'Unable to connect to backend. Is backend running?';
        alertBanner.style.display = 'block';
    };
}

connectTeacherSocket();
