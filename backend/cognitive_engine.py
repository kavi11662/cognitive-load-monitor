import os
import pickle
from pathlib import Path
import numpy as np
from sklearn.ensemble import RandomForestClassifier

MODEL_PATH = Path(__file__).resolve().parent / "models" / "cognitive_model.pkl"

LABEL_COLORS = {
    "Focused": "green",
    "Overloaded": "red",
    "Disengaged": "orange",
    "Relaxed": "blue",
}

LABEL_SCORES = {
    "Focused": 88,
    "Overloaded": 35,
    "Disengaged": 22,
    "Relaxed": 68,
}


def build_training_data():
    data = []
    labels = []

    def add_samples(label, blink_range, expr_range, hesitation_range, erratic_range, response_range, count=120):
        for _ in range(count):
            blink = np.random.uniform(*blink_range)
            expr = np.random.uniform(*expr_range)
            hesitation = np.random.uniform(*hesitation_range)
            erratic = np.random.uniform(*erratic_range)
            response = np.random.uniform(*response_range)
            data.append([blink, expr, hesitation, erratic, response])
            labels.append(label)

    add_samples("Focused", (10, 20), (70, 100), (120, 500), (0.0, 0.3), (100, 800))
    add_samples("Overloaded", (25, 40), (10, 60), (600, 1800), (0.6, 1.0), (800, 2500))
    add_samples("Disengaged", (4, 14), (20, 55), (1200, 2600), (0.1, 0.7), (1200, 3200))
    add_samples("Relaxed", (12, 24), (55, 90), (300, 900), (0.0, 0.35), (500, 1600))

    return np.array(data), np.array(labels)


def train_model(save_path=MODEL_PATH):
    X, y = build_training_data()
    model = RandomForestClassifier(n_estimators=40, random_state=42)
    model.fit(X, y)
    if not save_path.parent.exists():
        save_path.parent.mkdir(parents=True, exist_ok=True)
    with open(save_path, "wb") as f:
        pickle.dump(model, f)
    return model


def load_model():
    if MODEL_PATH.exists():
        try:
            with open(MODEL_PATH, "rb") as f:
                return pickle.load(f)
        except Exception:
            return train_model()
    return train_model()


MODEL = load_model()


def calculate_cognitive_score(
    blink_rate=0, 
    face_present=False,
    hesitation_ms=0, 
    mouse_erratic=0,
    ear=0.3,
    head_pose_offset=0.0,
    mouth_open=False,
    is_drowsy=False,
    looking_away=False
):
    if not face_present or looking_away:
        return 10, "Disengaged"
    
    if is_drowsy:
        return 20, "Disengaged"
        
    score = 50
    
    # Head pose - most important signal
    if head_pose_offset < 0.05:
        score += 20
    elif head_pose_offset < 0.1:
        score += 5
    else:
        score -= 25
    
    # Eye openness
    if ear > 0.25:
        score += 10
    elif ear < 0.15:
        score -= 20
    
    # Blink rate
    if 10 <= blink_rate <= 20:
        score += 15
    elif blink_rate < 5:
        score -= 10
    elif blink_rate > 30:
        score -= 15
    
    # Yawning
    if mouth_open:
        score -= 10
    
    # Typing
    if 0 < hesitation_ms < 500:
        score += 10
    elif hesitation_ms > 3000:
        score -= 10
    
    # Mouse
    if 0 < mouse_erratic < 5:
        score += 5
    
    score = max(0, min(100, score))
    
    if score < 25:
        return score, "Disengaged"
    elif score < 45:
        return score, "Relaxed"
    elif score < 70:
        return score, "Focused"
    else:
        return score, "Overloaded"


def label_color(label):
    return LABEL_COLORS.get(label, "gray")
