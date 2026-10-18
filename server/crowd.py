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
# على Render لازم 0.0.0.0. محلياً الأفضل 127.0.0.1.
HOST = os.environ.get("TASEER_BIND", os.environ.get("HOST", "0.0.0.0"))
# قائمة origins مفصولة بفواصل. فارغ = لا نرسل * (أأمن للإنتاج).
CORS_ORIGINS = {
    item.strip()
    for item in os.environ.get("TASEER_CORS_ORIGINS", "").split(",")
    if item.strip()
}
API_ONLY = os.environ.get("TASEER_API_ONLY", "").strip() in {"1", "true", "yes"}
NEEDED = 3
MAX_BODY = 4096
CAR_BODY = 8192
CAR_BRANDS = {"kia", "victory"}
RATE_LIMIT = 120
RATE_LIMIT_WRITE = 40
RATE_WINDOW = 600
recent_hits = {}
recent_writes = {}

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
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS car_notes (
            device TEXT NOT NULL,
            brand TEXT NOT NULL,
            model TEXT NOT NULL,
            city TEXT NOT NULL,
            price REAL,
            includes_fuel INTEGER NOT NULL,
            body TEXT NOT NULL,
            updated_at INTEGER NOT NULL,
            PRIMARY KEY (device, brand, model)
        )
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS car_notes_brand ON car_notes (brand, updated_at)")
    return conn


def clean_token(value, pattern_ok, limit):
    text = str(value or "").strip()
    if not text or len(text) > limit or not pattern_ok(text):
        return None
    return text


def valid_key(text):
    return all(char.isalnum() or char == "-" for char in text)


def valid_model(text):
    return "  " not in text and all(char.isalnum() or char in "- " for char in text)


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


def allow(ip, *, write=False):
    now = time.time()
    bucket = recent_writes if write else recent_hits
    limit = RATE_LIMIT_WRITE if write else RATE_LIMIT
    hits = [stamp for stamp in bucket.get(ip, []) if now - stamp < RATE_WINDOW]
    if len(hits) >= limit:
        bucket[ip] = hits
        return False
    hits.append(now)
    bucket[ip] = hits
    return True


def cors_origin(handler):
    origin = handler.headers.get("Origin", "").strip()
    if not CORS_ORIGINS:
        return None
    if "*" in CORS_ORIGINS:
        return "*"
    if origin and origin in CORS_ORIGINS:
        return origin
    return None


def first_value(source, key):
    value = source.get(key, "")
    if isinstance(value, list):
        return value[0] if value else ""
    return value


def parse_comment(value):
    text = " ".join(str(value or "").split())
    if len(text) < 2 or len(text) > 240 or any(char in "<>" for char in text):
        return None
    return text


def parse_car_price(payload):
    if "price" not in payload or payload["price"] is None or payload["price"] == "":
        return None
    value = number(payload["price"])
    if value is None or value < 1000 or value > 5000000:
        return "bad"
    return round_money(value)


def car_notes(conn, brand, device):
    rows = conn.execute(
        """
        SELECT device, model, city, price, includes_fuel, body, updated_at
        FROM car_notes
        WHERE brand = ?
        ORDER BY updated_at DESC, model
        LIMIT 400
        """,
        (brand,),
    ).fetchall()
    notes = []
    for row_device, model, city, price, includes_fuel, body, updated_at in rows:
        notes.append(
            {
                "model": model,
                "city": city,
                "price": None if price is None else round_money(price),
                "includesFuel": bool(includes_fuel),
                "text": body,
                "at": int(updated_at),
                "mine": bool(device) and row_device == device,
            }
        )
    return notes


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
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Frame-Options", "DENY")
        if self.path.startswith("/api/") or self.path.startswith("/health"):
            origin = cors_origin(self)
            if origin:
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Vary", "Origin")
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
        if not (self.path.startswith("/api/") or self.path.startswith("/health")):
            self.send_json(404, {"ok": False})
            return
        if cors_origin(self) is None and CORS_ORIGINS:
            self.send_json(403, {"ok": False})
            return
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
            if parsed.path == "/api/cars":
                if not allow(self.client_address[0]):
                    self.send_json(429, {"ok": False})
                    return
                self.send_json(200, self.read_cars(urllib.parse.parse_qs(parsed.query)))
                return
            if API_ONLY:
                self.send_json(404, {"ok": False})
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
            if parsed.path not in ("/api/crowd", "/api/cars"):
                self.send_json(404, {"ok": False})
                return
            if not allow(self.client_address[0], write=True):
                self.send_json(429, {"ok": False})
                return
            length = int(self.headers.get("Content-Length", "0"))
            limit = CAR_BODY if parsed.path == "/api/cars" else MAX_BODY
            if length <= 0 or length > limit:
                self.send_json(400, {"ok": False})
                return
            raw = self.rfile.read(length)
            if len(raw) != length:
                self.send_json(400, {"ok": False})
                return
            payload = json.loads(raw.decode("utf-8"))
            if parsed.path == "/api/cars":
                self.send_json(200, self.save_car(payload))
                return
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

    def car_brand(self, source):
        brand = clean_token(first_value(source, "brand"), valid_key, 40)
        if brand not in CAR_BRANDS:
            raise ValueError("brand")
        return brand

    def read_cars(self, query):
        brand = self.car_brand(query)
        device = clean_token(first_value(query, "device"), valid_device, 64)
        if not device or len(device) < 16:
            device = None
        conn = connect()
        try:
            return {"ok": True, "brand": brand, "notes": car_notes(conn, brand, device)}
        finally:
            conn.close()

    def save_car(self, payload):
        if not isinstance(payload, dict):
            raise ValueError("payload")
        device = clean_token(payload.get("device", ""), valid_device, 64)
        if not device or len(device) < 16:
            raise ValueError("device")
        brand = self.car_brand(payload)
        model = clean_token(payload.get("model", ""), valid_model, 40)
        city = clean_token(payload.get("city", ""), valid_city, 40)
        if not model or not city:
            raise ValueError("fields")
        includes = payload.get("includesFuel", False)
        if not isinstance(includes, bool):
            raise ValueError("fuel")
        price = parse_car_price(payload)
        text = parse_comment(payload.get("text"))
        message = ""
        if price == "bad":
            message = "اكتب سعر السيارة بين 1,000 و 5,000,000 ريال، أو اتركه فاضي."
        elif includes and price is None:
            message = "اكتب السعر إذا كان يشمل البنزين."
        elif text is None:
            message = "اكتب تعليقاً من حرفين إلى 240 حرف، بدون رموز HTML."
        stored_price = None if price in (None, "bad") else price
        conn = connect()
        try:
            if not message:
                conn.execute(
                    """
                    INSERT INTO car_notes (
                        device, brand, model, city, price, includes_fuel, body, updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(device, brand, model)
                    DO UPDATE SET
                        city = excluded.city,
                        price = excluded.price,
                        includes_fuel = excluded.includes_fuel,
                        body = excluded.body,
                        updated_at = excluded.updated_at
                    """,
                    (
                        device,
                        brand,
                        model,
                        city,
                        stored_price,
                        1 if includes else 0,
                        text,
                        int(time.time()),
                    ),
                )
                conn.commit()
            notes = car_notes(conn, brand, device)
        finally:
            conn.close()
        return {"ok": True, "accepted": not message, "message": message, "notes": notes}

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
    server = ThreadingHTTPServer((HOST, PORT), CrowdHandler)
    mode = "api-only" if API_ONLY else "api+static"
    print(f"تسعير يستمع على http://{HOST}:{PORT} ({mode})")
    server.serve_forever()


if __name__ == "__main__":
    main()
