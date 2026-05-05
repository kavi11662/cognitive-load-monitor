# Real-Time Cognitive Load Monitor

This project is a complete local system to monitor student cognitive load during online classes using only free local tools.

## What it does

- Student opens the browser and allows webcam access
- Student page analyzes live face data, typing, and mouse motion
- Signals are sent to a Python backend every second via WebSocket
- Backend calculates a cognitive load score and saves results in SQLite
- Teacher dashboard displays all students live and shows an alert if 30%+ are overloaded

## Run the project

1. Open a terminal and run:

```bash
cd backend
pip install -r requirements.txt
python main.py
```

2. Open `frontend/student/index.html` in a browser for the student view.
3. Open `frontend/teacher/index.html` in another browser tab for the teacher dashboard.

No AWS, Docker, cloud services, or extra setup is required.
