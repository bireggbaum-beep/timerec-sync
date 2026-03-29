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


def _min_to_time(minutes: int) -> str:
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def _parse_settings(conn) -> dict:
    """Read raw key/value pairs from T_SETTINGS_TMP (format: 'TYPE|KEY=VALUE')."""
    raw = {}
    for row in conn.execute("SELECT KEY, ITEM FROM T_SETTINGS_TMP"):
        item = row["ITEM"] or ""
        # Strip 'I|KEY=' or 'S|KEY=' prefix
        if "=" in item:
            raw[row["KEY"]] = item.split("=", 1)[1]
        else:
            raw[row["KEY"]] = item
    return raw


def parse_config(conn) -> dict:
    s = _parse_settings(conn)

    # ── Daily / per-weekday target times ──
    default_target = s.get("DailyTargetTime", "08:00")
    weekday_names = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
    weekday_targets = {}
    for i, name in enumerate(weekday_names):
        key = f"WeekdayTargetTime.{i}"
        weekday_targets[name] = s[key] if key in s else default_target

    # ── Auto punch-out (StopRunningWorkday = minutes from midnight) ──
    stop_min = int(s.get("StopRunningWorkday", "0"))
    auto_punch_out = {"enabled": stop_min > 0, "time": _min_to_time(stop_min) if stop_min else None}

    # ── Auto-breaks ──
    # Rules stored as "afterWorkTime|breakDuration|defaultBreakStart|flag[|flag2]"
    num_active = int(s.get("AutoBreak..num", "0"))
    break_rules = []
    for i in range(3):
        val = s.get(f"AutoBreak.{i}")
        if val:
            parts = val.split("|")
            break_rules.append({
                "afterWorkTime": parts[0],
                "breakDuration": parts[1],
                "defaultBreakStart": parts[2],
                "enabled": i < num_active,
            })

    auto_breaks = {
        "enabled": num_active > 0,
        "validateActual": bool(int(s.get("AutoBreakActualValidation", "0"))),
        "evalOrder": "highestThreshold" if int(s.get("AutoBreakEvalOrder", "0")) == 1 else "firstMatch",
        "rules": break_rules,
    }

    # ── Standard break presets ──
    standard_breaks = []
    for i in range(10):
        val = s.get(f"StandardStampEntry.{i}")
        if val:
            parts = val.split("|")
            if len(parts) >= 2:
                standard_breaks.append({"start": parts[0], "end": parts[1]})

    # ── Display / theme ──
    # ThemeV2 = "mode|...|...|...|...|workDayStart|workDayEnd"
    theme_parts = s.get("ThemeV2", "").split("|")
    work_day_start = theme_parts[5] if len(theme_parts) > 5 else "07:00"
    work_day_end   = theme_parts[6] if len(theme_parts) > 6 else "20:00"

    # ── Overtime display ──
    delta_parts = s.get("DeltaHighlightMain", "|0").split("|")
    highlight_h = int(delta_parts[1]) if len(delta_parts) > 1 and delta_parts[1].isdigit() else 0

    # ── Day templates (Urlaub, Feiertag, etc.) ──
    day_templates = []
    for row in conn.execute(
        "SELECT KEY, VALUE, VALUE3 FROM T_DOMAIN_VALUE_1 WHERE DOMAIN = 'TemplateTexts' ORDER BY KEY"
    ):
        day_templates.append({"id": int(row["VALUE3"]) if row["VALUE3"] else None, "name": row["VALUE"]})

    return {
        "workSchedule": {
            "dailyTargetTime": default_target,
            "weekdayTargets": weekday_targets,
            "firstDayOfWeek": "monday" if int(s.get("FirstDayOfWeek", "0")) == 0 else "sunday",
            "flextimeYear": int(s["yc.flextime"]) if "yc.flextime" in s else None,
        },
        "autoPunchOut": auto_punch_out,
        "autoBreaks": auto_breaks,
        "standardBreaks": standard_breaks,
        "overtime": {
            "trackingEnabled": True,
            "showDailyDelta": bool(int(s.get("MainDeltaDMTD", "0"))),
            "showWeeklyDelta": bool(int(s.get("MainDeltaDWTD", "0"))),
            "highlightThresholdHours": highlight_h,
        },
        "display": {
            "workDayStart": work_day_start,
            "workDayEnd": work_day_end,
            "showIsoWeek": bool(int(s.get("ShowIsoWeek", "0"))),
            "currency": "€",
            "currencyFormat": s.get("AmountCurrencyString", ""),
            "breakDetails": bool(int(s.get("BreakDetails", "0"))),
        },
        "dayTemplates": day_templates,
    }


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
        "SELECT ID, NAME, SORTNR, INACTIVE_FG, "
        "TARGET_OFF, TIME_SUM_OFF, "
        "COLOR_CODES, EXTRA1, EXTRA2, EXTRA3, EXTRA4, TIME_ACCUMULATION "
        "FROM T_CATEGORY_1 ORDER BY SORTNR"
    ):
        t = {
            "id": row["ID"],
            "name": row["NAME"],
            "sortNr": row["SORTNR"],
            "inactive": bool(row["INACTIVE_FG"]),
            "targetOff": bool(row["TARGET_OFF"]),
            "timeSumOff": bool(row["TIME_SUM_OFF"]),
            "colorCode": row["COLOR_CODES"] or "",
            "extra1": row["EXTRA1"] or "",
            "extra2": row["EXTRA2"] or "",
            "extra3": row["EXTRA3"] or "",
            "extra4": row["EXTRA4"] or "",
            "timeAccumulation": row["TIME_ACCUMULATION"] or "",
        }
        tasks[row["ID"]] = t
        tasks_list.append(t)

    # ── Notes ──
    notes = {}
    for row in conn.execute("SELECT NOTE_DATE_STR, NOTE_TEXT FROM T_NOTE_1"):
        notes[row["NOTE_DATE_STR"][:10]] = row["NOTE_TEXT"] or ""

    # ── Missing checkouts ──
    missing_checkouts = set()
    for row in conn.execute(
        "SELECT KEY FROM T_DOMAIN_VALUE_1 WHERE DOMAIN = 'MISSING_CHECKOUT'"
    ):
        missing_checkouts.add(row["KEY"])

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

        day["missingCheckout"] = date in missing_checkouts
        day["events"] = events
        day["totalMinutes"] = total_min
        day["totalFormatted"] = f"{total_min // 60}h {total_min % 60:02d}m"
        day["tasks"] = sorted(used_tasks) if used_tasks else ["(Standard)"]
        days_list.append(day)

    config = parse_config(conn)

    conn.close()
    os.unlink(db_path)

    return {
        "config": config,
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
        "config.json": data["config"],
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
          f"{len(data['days'])} days, {len(data['notes'])} notes, 1 config")

    print("Writing JSON:")
    write_json(data)
    print("Done!")


if __name__ == "__main__":
    main()
