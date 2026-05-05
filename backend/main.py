import asyncio
import json
import os
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from database import save_score, get_all_latest_scores, get_history
from cognitive_engine import calculate_cognitive_score, label_color

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.websocket("/ws/student/{student_name}")
async def student_socket(websocket: WebSocket, student_name: str):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)

            blink_rate = float(payload.get("blink_rate", 15))
            face_present = bool(payload.get("face_present", True))
            expression_score = float(payload.get("expression_score", 60))
            hesitation_ms = float(payload.get("hesitation_ms", 500))
            mouse_erratic = float(payload.get("mouse_erratic", 0.2))
            response_delay = float(payload.get("response_delay", 600))
            timestamp = payload.get("timestamp")

            score_value, label, color = calculate_cognitive_score(
                blink_rate,
                expression_score,
                hesitation_ms,
                mouse_erratic,
                response_delay,
                face_present=face_present,
            )

            save_score(student_name, student_name, score_value, label, timestamp)

            await websocket.send_text(json.dumps({
                "score": score_value,
                "label": label,
                "color": color,
                "timestamp": timestamp,
            }))
    except WebSocketDisconnect:
        return
    except Exception:
        await websocket.close()


@app.websocket("/ws/teacher")
async def teacher_socket(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            latest_scores = get_all_latest_scores()
            await websocket.send_text(json.dumps({
                "scores": latest_scores,
            }))
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        return
    except Exception:
        await websocket.close()


@app.get("/history/{student_name}")
async def student_history(student_name: str):
    return get_history(student_name)


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
