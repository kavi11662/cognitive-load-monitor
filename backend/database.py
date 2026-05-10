import os
import sqlite3

# Use absolute path that works on both local and cloud
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "cognitive.db")

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    return conn

def get_all_latest_scores():
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT student_name, score_value, label, timestamp
            FROM cognitive_scores
            GROUP BY student_name
            HAVING timestamp = MAX(timestamp)
        """)
        rows = cursor.fetchall()
        conn.close()
        if not rows:
            return []
        return [
            {
                "student_name": row[0],
                "score_value": row[1],
                "label": row[2],
                "timestamp": str(row[3])
            }
            for row in rows
        ]
    except Exception as e:
        print(f"DB error in get_all_latest_scores: {e}")
        return []

def save_score(student_id, student_name, score_value, label, timestamp=None):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        if timestamp is None:
            cursor.execute("""
                INSERT INTO cognitive_scores (student_id, student_name, score_value, label)
                VALUES (?, ?, ?, ?)
            """, (student_id, student_name, score_value, label))
        else:
            cursor.execute("""
                INSERT INTO cognitive_scores (student_id, student_name, score_value, label, timestamp)
                VALUES (?, ?, ?, ?, ?)
            """, (student_id, student_name, score_value, label, timestamp))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"DB error in save_score: {e}")

def get_history(student_name):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, student_id, student_name, score_value, label, timestamp
            FROM cognitive_scores
            WHERE student_name = ?
            ORDER BY timestamp DESC
        """, (student_name,))
        rows = cursor.fetchall()
        conn.close()
        return [
            {
                "id": row[0],
                "student_id": row[1],
                "student_name": row[2],
                "score_value": row[3],
                "label": row[4],
                "timestamp": str(row[5])
            }
            for row in rows
        ]
    except Exception as e:
        print(f"DB error in get_history: {e}")
        return []

def init_db():
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS cognitive_scores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id TEXT,
                student_name TEXT,
                score_value REAL,
                label TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()
        conn.close()
        print(f"Database initialized at {DB_PATH}")
    except Exception as e:
        print(f"DB init error: {e}")

# Initialize database on import
init_db()
