import sqlite3
from pathlib import Path
from datetime import datetime

DB_PATH = Path(__file__).resolve().parent / "cognitive.db"

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS cognitive_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT,
    student_name TEXT,
    score_value INTEGER,
    label TEXT,
    timestamp TEXT
)
"""


def get_connection():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def initialize_database():
    conn = get_connection()
    conn.execute(CREATE_TABLE_SQL)
    conn.commit()
    conn.close()


initialize_database()


def save_score(student_id, student_name, score_value, label, timestamp=None):
    if timestamp is None:
        timestamp = datetime.utcnow().isoformat()
    conn = get_connection()
    conn.execute(
        "INSERT INTO cognitive_scores (student_id, student_name, score_value, label, timestamp) VALUES (?, ?, ?, ?, ?)",
        (student_id, student_name, int(score_value), label, timestamp),
    )
    conn.commit()
    conn.close()


def get_all_latest_scores():
    conn = get_connection()
    query = """
    SELECT student_id, student_name, score_value, label, timestamp
    FROM cognitive_scores
    WHERE id IN (
        SELECT MAX(id) FROM cognitive_scores GROUP BY student_id
    )
    ORDER BY student_name
    """
    rows = conn.execute(query).fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_history(student_name):
    conn = get_connection()
    rows = conn.execute(
        "SELECT id, student_id, student_name, score_value, label, timestamp FROM cognitive_scores WHERE student_name = ? ORDER BY timestamp DESC",
        (student_name,),
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]
