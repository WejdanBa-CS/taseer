#!/usr/bin/env python3
"""متوسط أسعار الورش: كل جهاز يحدّث رقمه لنفس القطعة بدل ما يكرر التصويت."""

import json
import os
import sqlite3
import time
import traceback
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = Path(os.environ.get("TASEER_CROWD_DB", Path(__file__).with_name("crowd.sqlite3")))
PORT = int(os.environ.get("PORT", "8765"))
NEEDED = 3
MAX_BODY = 4096
RATE_LIMIT = 120
RATE_WINDOW = 600
recent_hits = {}

STATICS = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
    ".woff2": "font/woff2",
    ".txt": "text/plain; charset=utf-8",
}


def connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=5)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS quotes (
            device TEXT NOT NULL,
            brand TEXT NOT NULL,
            model TEXT NOT NULL,
            year_label TEXT NOT NULL,
            part TEXT NOT NULL,
            city TEXT NOT NULL,
            quote REAL NOT NULL,
            updated_at INTEGER NOT NULL,
            PRIMARY KEY (device, brand, model, year_label, part)
        )
        """
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS quotes_part ON quotes (brand, model, year_label, part)"
    )
    return conn


def clean_token(value, pattern_ok, limit):
    text = str(value or "").strip()
    if not text or len(text) > limit or not pattern_ok(text):
        return None
    return text


def valid_key(text):
    return all(char.isalnum() or char == "-" for char in text)


def valid_year(text):
    chunks = text.replace("–", "-").split("-")
    return 1 <= len(chunks) <= 2 and all(chunk.isdigit() and len(chunk) == 4 for chunk in chunks)


def valid_city(text):
    return all(ord(char) >= 32 and char not in "<>" for char in text)


def valid_device(text):
    return all(char.isalnum() or char == "-" for char in text)


def number(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    if value != value or value in (float("inf"), float("-inf")):
        return None
    return float(value)


def round_money(value):
    return round(float(value) + 1e-9, 2)


def allow(ip):
    now = time.time()
    hits = [stamp for stamp in recent_hits.get(ip, []) if now - stamp < RATE_WINDOW]
    if len(hits) >= RATE_LIMIT:
        recent_hits[ip] = hits
        return False
    hits.append(now)
    recent_hits[ip] = hits
    return True


def summary(conn, brand, model, year_label, part, city):
    average, count = conn.execute(
        """
        SELECT AVG(quote), COUNT(*)
        FROM quotes
        WHERE brand = ? AND model = ? AND year_label = ? AND part = ?
        """,
        (brand, model, year_label, part),
    ).fetchone()
    city_average, city_count = conn.execute(
        """
        SELECT AVG(quote), COUNT(*)
        FROM quotes
        WHERE brand = ? AND model = ? AND year_label = ? AND part = ? AND city = ?
        """,
        (brand, model, year_label, part, city),
    ).fetchone()
    count = int(count or 0)
    city_count = int(city_count or 0)
    return {
        "ok": True,
        "count": count,
        "average": round_money(average) if count else None,
        "ready": count >= NEEDED,
        "needed": NEEDED,
        "city": city,
        "cityCount": city_count,
        "cityAverage": round_money(city_average) if city_count else None,
        "cityReady": city_count >= NEEDED,
    }


def static_file(url_path):
    if url_path in ("/", "/index.html"):
        return ROOT / "index.html"
    if url_path == "/favicon.svg":
        return ROOT / "favicon.svg"
    relative = url_path.lstrip("/")
    if not relative.startswith(("css/", "js/", "fonts/")) or ".." in relative:
        return None
    candidate = (ROOT / relative).resolve()
    if ROOT.resolve() not in candidate.parents or not candidate.is_file():
        return None
    return candidate


class CrowdHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        return

    def end_headers(self):
        if self.path.startswith("/api/") or self.path.startswith("/health"):
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        try:
            parsed = urllib.parse.urlparse(self.path)
            if parsed.path == "/health":
                self.send_json(200, {"ok": True})
                return
            if parsed.path == "/api/crowd":
                if not allow(self.client_address[0]):
                    self.send_json(429, {"ok": False})
                    return
                self.send_json(200, self.read_summary(urllib.parse.parse_qs(parsed.query)))
                return
            self.serve_static(parsed.path)
        except ValueError:
            self.send_json(400, {"ok": False})
        except Exception:
            traceback.print_exc()
            self.send_json(500, {"ok": False})

    def do_POST(self):
        try:
            parsed = urllib.parse.urlparse(self.path)
            if parsed.path != "/api/crowd":
                self.send_json(404, {"ok": False})
                return
            if not allow(self.client_address[0]):
                self.send_json(429, {"ok": False})
                return
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_BODY:
                self.send_json(400, {"ok": False})
                return
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            self.send_json(200, self.save_quote(payload))
        except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
            self.send_json(400, {"ok": False})
        except Exception:
            traceback.print_exc()
            self.send_json(500, {"ok": False})

    def fields(self, source, quote_required):
        def first(key):
            value = source.get(key, "")
            if isinstance(value, list):
                return value[0] if value else ""
            return value

        brand = clean_token(first("brand"), valid_key, 40)
        model = clean_token(first("model"), valid_key, 40)
        year_label = clean_token(first("yearLabel"), valid_year, 12)
        part = clean_token(first("part"), valid_key, 40)
        city = clean_token(first("city"), valid_city, 40)
        if not all((brand, model, year_label, part, city)):
            raise ValueError("fields")
        quote = None
        if quote_required or "quote" in source:
            raw_quote = first("quote")
            quote = number(raw_quote)
            if quote is None or quote < 1 or quote > 20000:
                return brand, model, year_label, part, city, None
        return brand, model, year_label, part, city, quote

    def read_summary(self, query):
        brand, model, year_label, part, city, _quote = self.fields(query, False)
        conn = connect()
        try:
            return summary(conn, brand, model, year_label, part, city)
        finally:
            conn.close()

    def save_quote(self, payload):
        if not isinstance(payload, dict):
            raise ValueError("payload")
        device = clean_token(payload.get("device", ""), valid_device, 64)
        if not device or len(device) < 16:
            raise ValueError("device")
        brand, model, year_label, part, city, quote = self.fields(payload, True)
        conn = connect()
        try:
            accepted = quote is not None
            if accepted:
                conn.execute(
                    """
                    INSERT INTO quotes (device, brand, model, year_label, part, city, quote, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(device, brand, model, year_label, part)
                    DO UPDATE SET city = excluded.city, quote = excluded.quote, updated_at = excluded.updated_at
                    """,
                    (device, brand, model, year_label, part, city, quote, int(time.time())),
                )
                conn.commit()
            result = summary(conn, brand, model, year_label, part, city)
        finally:
            conn.close()
        result["accepted"] = accepted
        return result

    def serve_static(self, url_path):
        candidate = static_file(url_path)
        if candidate is None:
            self.send_json(404, {"ok": False})
            return
        body = candidate.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", STATICS.get(candidate.suffix, "application/octet-stream"))
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main():
    connect().close()
    server = ThreadingHTTPServer(("0.0.0.0", PORT), CrowdHandler)
    print(f"تسعير يستمع على http://0.0.0.0:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
