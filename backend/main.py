from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import json, os
from datetime import datetime

app = FastAPI(title="Rural Entrepreneur Scheme API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def find_data_file():
    """Walk up from this file's directory until we find data/schemes.json."""
    current = os.path.dirname(os.path.abspath(__file__))
    for _ in range(5):  # check up to 5 levels up
        candidate = os.path.join(current, "data", "schemes.json")
        if os.path.exists(candidate):
            return candidate
        current = os.path.dirname(current)
    raise FileNotFoundError(
        "Could not find data/schemes.json. Searched upward from: " +
        os.path.dirname(os.path.abspath(__file__))
    )

DATA_FILE = find_data_file()
def find_tools_file():
    """Walk up from this file's location until we find data/tools.json."""
    current = Path(__file__).resolve().parent
    for _ in range(5):
        candidate = current / "data" / "tools.json"
        if candidate.exists():
            return str(candidate)
        current = current.parent
    raise FileNotFoundError(
        f"data/tools.json not found. Searched upward from {Path(__file__).resolve()}"
    )

TOOLS_FILE = find_tools_file()
def load_schemes():
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

@app.get("/api/schemes")
def get_all_schemes():
    """Returns all schemes with a version timestamp for delta sync."""
    data = load_schemes()
    return {
        "version": datetime.now().isoformat(),
        "schemes": data["schemes"]
    }

@app.get("/api/schemes/{scheme_id}")
def get_scheme(scheme_id: str):
    data = load_schemes()
    for s in data["schemes"]:
        if s["id"] == scheme_id:
            return s
    raise HTTPException(status_code=404, detail="Scheme not found")

@app.get("/api/tools")
def get_all_tools():
    """Returns all digital tool guides with a version timestamp."""
    with open(TOOLS_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    return {
        "version": datetime.now().isoformat(),
        "tools": data["tools"]
    }
@app.get("/api/locales/{locale}")
def get_locale(locale: str):
    """Serves translation files. Adding a new locale = adding a new JSON file."""
    path = os.path.join(os.path.dirname(__file__), "..", "public", "locales", f"{locale}.json")
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"Locale {locale} not found")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

@app.get("/api/health")
def health():
    return {"status": "ok"}