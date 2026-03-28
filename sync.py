"""
TimeRec Sync — Parse timerec.db.gz → JSON files
No external dependencies needed. Reads the backup file from the repo
and writes structured JSON files to data/.
"""

import gzip
import json
import os
import sqlite3
import tempfile
from datetime import datetime

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
BACKUP_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backup", "timerec.db.gz")


def load_db(path: str) -> bytes:
    with open(path, "rb") as f:
        raw = f.read()
    if raw[:2] == b"\x1f\x8b":
        return gzip.decompress(raw)
    return raw


def parse_database(db_bytes: bytes) -> dict:
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        f.write(db_bytes)
        db_path = f.name

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    # ── Tasks ──
    tasks = {}
    tasks_list = []
    for row in conn.execute(
        "SELECT ID, NAME, CUSTOMER, SORTNR, INACTIVE_FG, HOURLY_RATE "
        "FROM T_CATEGORY_1 ORDER BY SORTNR"
    ):
        t = {
            "id": row["ID"],
            "name": row["NAME"],
            "customer": row["CUSTOMER"] or "",
            "sortNr": row["SORTNR"],
            "inactive": bool(row["INACTIVE_FG"]),
            "hourlyRate": row["HOURLY_RATE"] or 0,
        }
        tasks[row["ID"]] = t
        tasks_list.append(t)

    # ── Notes ──
    notes = {}
    for row in conn.execute("SELECT NOTE_DATE_STR, NOTE_TEXT FROM T_NOTE_1"):
        notes[row["NOTE_DATE_STR"][:10]] = row["NOTE_TEXT"] or ""

    # ── Stamps → grouped by day ──
    stamps = []
    days = {}

    for row in conn.execute(
        "SELECT MDT, ASOFDATE, STAMP_DATE_STR, CHECK_ACTION, SEQNR, "
        "CATEGORY_ID, COMMENT FROM T_STAMP_3 ORDER BY ASOFDATE, STAMP_DATE_STR"
    ):
        date = row["ASOFDATE"][:10]
        time = row["STAMP_DATE_STR"][11:16]
        action = "in" if row["CHECK_ACTION"] == 10 else "out"
        task_id = row["CATEGORY_ID"]
        task_name = tasks[task_id]["name"] if task_id in tasks else "(Standard)"

        stamp = {
            "seqNr": row["SEQNR"],
            "date": date,
            "time": time,
            "action": action,
            "taskId": task_id,
            "taskName": task_name,
            "comment": row["COMMENT"] or "",
        }
        stamps.append(stamp)

        if date not in days:
            days[date] = {"date": date, "_raw_stamps": [], "note": ""}
        days[date]["_raw_stamps"].append(stamp)

    # ── Compute daily events (kommt/geht pairs) and totals ──
    days_list = []
    for date in sorted(days.keys()):
        day = days[date]
        day["note"] = notes.get(date, "")

        sorted_stamps = sorted(day.pop("_raw_stamps"), key=lambda s: s["time"])
        events = []
        i = 0
        while i < len(sorted_stamps):
            s = sorted_stamps[i]
            if s["action"] == "in":
                if i + 1 < len(sorted_stamps) and sorted_stamps[i + 1]["action"] == "out":
                    out = sorted_stamps[i + 1]
                    duration = _time_to_min(out["time"]) - _time_to_min(s["time"])
                    events.append({
                        "kommt": s["time"],
                        "geht": out["time"],
                        "taskId": s["taskId"],
                        "taskName": s["taskName"],
                        "comment": s["comment"],
                        "durationMinutes": duration,
                    })
                    i += 2
                else:
                    events.append({
                        "kommt": s["time"],
                        "geht": None,
                        "taskId": s["taskId"],
                        "taskName": s["taskName"],
                        "comment": s["comment"],
                        "durationMinutes": None,
                    })
                    i += 1
            else:
                i += 1  # orphan out-stamp, skip

        total_min = sum(e["durationMinutes"] for e in events if e["durationMinutes"] is not None)
        used_tasks = {e["taskName"] for e in events if e["taskId"] != 0}

        day["events"] = events
        day["totalMinutes"] = total_min
        day["totalFormatted"] = f"{total_min // 60}h {total_min % 60:02d}m"
        day["tasks"] = sorted(used_tasks) if used_tasks else ["(Standard)"]
        days_list.append(day)

    conn.close()
    os.unlink(db_path)

    return {
        "tasks": tasks_list,
        "stamps": stamps,
        "days": days_list,
        "notes": notes,
    }


def _time_to_min(t: str) -> int:
    h, m = t.split(":")
    return int(h) * 60 + int(m)


def write_json(data: dict):
    os.makedirs(DATA_DIR, exist_ok=True)

    meta = {
        "lastSync": datetime.now().isoformat(),
        "totalStamps": len(data["stamps"]),
        "totalDays": len(data["days"]),
        "totalTasks": len(data["tasks"]),
        "totalNotes": len(data["notes"]),
        "dateRange": {
            "from": data["days"][0]["date"] if data["days"] else None,
            "to": data["days"][-1]["date"] if data["days"] else None,
        },
    }

    files = {
        "meta.json": meta,
        "tasks.json": data["tasks"],
        "stamps.json": data["stamps"],
        "days.json": data["days"],
    }

    for filename, content in files.items():
        path = os.path.join(DATA_DIR, filename)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(content, f, ensure_ascii=False, indent=2)
        print(f"  {filename}: {os.path.getsize(path):,} bytes")


def main():
    print(f"[{datetime.now().isoformat()}] TimeRec Sync")

    if not os.path.exists(BACKUP_PATH):
        print(f"ERROR: {BACKUP_PATH} not found!")
        return

    file_size = os.path.getsize(BACKUP_PATH)
    print(f"Reading {BACKUP_PATH} ({file_size:,} bytes)...")

    db_bytes = load_db(BACKUP_PATH)
    print(f"  SQLite DB: {len(db_bytes):,} bytes")

    data = parse_database(db_bytes)
    print(f"  {len(data['stamps'])} stamps, {len(data['tasks'])} tasks, "
          f"{len(data['days'])} days, {len(data['notes'])} notes")

    print("Writing JSON:")
    write_json(data)
    print("Done!")


if __name__ == "__main__":
    main()
