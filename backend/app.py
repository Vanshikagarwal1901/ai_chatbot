# app.py — Complete AI Voice+Text Chatbot Backend (Groq API)

import os
import sqlite3
import time
import requests
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS

# ----------------------
# 1) Config
# ----------------------
GROQ_API_KEY = os.getenv("GROQ_API_KEY")  # set this in your environment
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama3-8b-8192"  # common Groq chat model

if not GROQ_API_KEY:
    # Fail fast with a clear message if the key isn't set
    raise RuntimeError(
        "GROQ_API_KEY is not set. Set it in your environment, e.g.:\n"
        "  Windows PowerShell:  $env:GROQ_API_KEY = 'your_key_here'\n"
        "  Bash:                export GROQ_API_KEY='your_key_here'\n"
    )

# ----------------------
# 2) Flask
# ----------------------
app = Flask(__name__, static_folder="static")
CORS(app)

# ----------------------
# 3) Database (SQLite)
# ----------------------
conn = sqlite3.connect("chat.db", check_same_thread=False)
cursor = conn.cursor()
cursor.execute("""
CREATE TABLE IF NOT EXISTS chat_history (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    user TEXT,
    bot  TEXT
)
""")
conn.commit()

# ----------------------
# 4) Groq helper
# ----------------------
def call_groq(user_msg: str, retries: int = 2, backoff_sec: float = 1.5) -> str:
    """
    Call Groq Chat Completions API with simple retry on 429/5xx.
    Returns the assistant message string.
    Raises Exception on hard failures.
    """
    payload = {
        "model": GROQ_MODEL,
        "messages": [
            {"role": "system", "content": "You are a helpful, concise assistant."},
            {"role": "user", "content": user_msg},
        ],
        "temperature": 0.7,
    }
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }

    attempt = 0
    while True:
        attempt += 1
        try:
            resp = requests.post(GROQ_API_URL, headers=headers, json=payload, timeout=45)
        except requests.RequestException as e:
            # Network/timeout error
            if attempt <= retries:
                time.sleep(backoff_sec * attempt)
                continue
            raise RuntimeError(f"Network error calling Groq: {e}")

        if resp.status_code == 200:
            data = resp.json()
            try:
                return data["choices"][0]["message"]["content"]
            except (KeyError, IndexError):
                raise RuntimeError(f"Unexpected Groq response format: {data}")

        # Handle rate limits and transient errors with retry
        if resp.status_code in (429, 500, 502, 503, 504) and attempt <= retries:
            time.sleep(backoff_sec * attempt)
            continue

        # Non-retriable error → surface message
        try:
            err = resp.json()
        except Exception:
            err = {"error": {"message": resp.text}}
        raise RuntimeError(
            f"Groq API error {resp.status_code}: {err.get('error', {}).get('message', err)}"
        )

# ----------------------
# 5) Chat Endpoint
# ----------------------
@app.route("/chat", methods=["POST"])
def chat():
    try:
        data = request.get_json(silent=True) or {}
        user_msg = data.get("message", "").strip()

        if not user_msg:
            return jsonify({"reply": "Please send a message"}), 400

        reply = call_groq(user_msg)

        # Save to DB
        cursor.execute(
            "INSERT INTO chat_history (user, bot) VALUES (?, ?)",
            (user_msg, reply),
        )
        conn.commit()

        return jsonify({"reply": reply})

    except Exception as e:
        # Keep the same 500 shape your frontend already expects
        return jsonify({"reply": f"Error: {str(e)}"}), 500

# ----------------------
# 6) History
# ----------------------
@app.route("/history", methods=["GET"])
def history():
    cursor.execute("SELECT user, bot FROM chat_history ORDER BY id ASC")
    chats = cursor.fetchall()
    return jsonify(chats)

# ----------------------
# 7) Frontend
# ----------------------
@app.route("/")
def home():
    return render_template("index.html")

# ----------------------
# 8) Run
# ----------------------
if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5000, debug=True)

