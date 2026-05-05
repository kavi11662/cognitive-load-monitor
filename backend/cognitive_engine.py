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


def calculate_cognitive_score(blink_rate, expression_score, hesitation_ms, mouse_erratic, response_delay, face_present=True):
    if not face_present:
        return 18, "Disengaged", LABEL_COLORS["Disengaged"]

    feature_vector = [
        float(blink_rate),
        float(expression_score),
        float(hesitation_ms),
        float(mouse_erratic),
        float(response_delay),
    ]

    prediction = MODEL.predict([feature_vector])[0]
    base = LABEL_SCORES.get(prediction, 50)

    adjustment = 0
    adjustment -= max(0, (hesitation_ms - 500) * 0.012)
    adjustment -= max(0, (response_delay - 500) * 0.008)
    adjustment -= mouse_erratic * 12
    adjustment += (expression_score - 60) * 0.18
    adjustment += max(0, 20 - abs(blink_rate - 18)) * 0.8

    score_value = int(max(0, min(100, base + adjustment)))

    if score_value >= 75:
        label = "Focused"
    elif score_value >= 55:
        label = "Relaxed"
    elif score_value >= 35:
        label = "Overloaded"
    else:
        label = "Disengaged"

    return score_value, label, LABEL_COLORS[label]


def label_color(label):
    return LABEL_COLORS.get(label, "gray")
