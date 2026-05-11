from __future__ import annotations

import argparse
import json
import logging
import sys
import traceback
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

logger = logging.getLogger("cs2-analyser")

TICKRATE = 64


def emit(obj: dict[str, Any]) -> None:
    print(json.dumps(obj), flush=True)


def emit_progress(stage: str, percent: int, message: str | None = None) -> None:
    payload: dict[str, Any] = {"event": "progress", "stage": stage, "percent": percent}
    if message is not None:
        payload["message"] = message
    emit(payload)


def emit_error(kind: str, message: str) -> None:
    emit({"event": "error", "kind": kind, "message": message})


def _get_col(row: Any, *names: str) -> Any:
    for name in names:
        if name in row and row[name] is not None:
            return row[name]
    return None


def _round_for_tick(tick: int, round_starts: list[int]) -> int:
    round_num = 0
    for i, start_tick in enumerate(round_starts, start=1):
        if tick >= start_tick:
            round_num = i
        else:
            break
    return max(round_num, 1)


def _build_kill_event(row: Any, round_num: int) -> dict[str, Any]:
    attacker_name = _get_col(row, "attacker_name") or ""
    attacker_steamid = str(_get_col(row, "attacker_steamid") or "")
    victim_name = _get_col(row, "user_name", "victim_name") or ""
    victim_steamid = str(_get_col(row, "user_steamid", "victim_steamid") or "")
    weapon = _get_col(row, "weapon") or ""
    # Newer demoparser2 versions expose hitgroup (1 == head) instead of a
    # boolean headshot column; accept either.
    headshot_raw = _get_col(row, "headshot", "hitgroup")
    if isinstance(headshot_raw, bool):
        headshot = headshot_raw
    else:
        headshot = headshot_raw == 1
    tick = int(_get_col(row, "tick") or 0)

    suicide = (
        not attacker_steamid
        or attacker_steamid == victim_steamid
        or attacker_steamid in {"0", "BOT"}
    )

    if suicide:
        death: dict[str, Any] = {
            "type": "death",
            "round": round_num,
            "tick": tick,
            "victim": {"name": victim_name, "steam_id": victim_steamid},
        }
        if weapon:
            death["weapon"] = weapon
        return death

    return {
        "type": "kill",
        "round": round_num,
        "tick": tick,
        "attacker": {"name": attacker_name, "steam_id": attacker_steamid},
        "victim": {"name": victim_name, "steam_id": victim_steamid},
        "weapon": weapon,
        "headshot": headshot,
    }


def run_quick(demo_path: Path) -> dict[str, Any]:
    from demoparser2 import DemoParser  # imported lazily so --mode full path doesn't need it

    emit_progress("parsing", 5, "opening demo")
    parser = DemoParser(str(demo_path))

    emit_progress("parsing", 20, "reading header")
    header = parser.parse_header()
    map_name = header.get("map_name") or header.get("map") or "unknown"

    emit_progress("extracting", 45, "extracting deaths")
    try:
        deaths_df = parser.parse_event("player_death")
    except KeyError as exc:
        raise RuntimeError(f"demoparser2 missing expected event column: {exc}") from exc

    emit_progress("extracting", 65, "extracting round starts")
    round_starts: list[int] = []
    try:
        rounds_df = parser.parse_event("round_start")
        if rounds_df is not None and len(rounds_df) > 0:
            round_starts = sorted(int(t) for t in rounds_df["tick"].tolist())
    except Exception as exc:  # round_start is best-effort; absence is non-fatal
        logger.warning("could not parse round_start events: %s", exc)

    emit_progress("finalizing", 80, "assembling events")
    events: list[dict[str, Any]] = []
    max_tick = 0
    if deaths_df is not None and len(deaths_df) > 0:
        records = deaths_df.to_dict(orient="records")
        for row in records:
            tick = int(row.get("tick") or 0)
            max_tick = max(max_tick, tick)
            if "round" in row and row["round"] is not None:
                round_num = int(row["round"])
            elif round_starts:
                round_num = _round_for_tick(tick, round_starts)
            else:
                round_num = 1
            events.append(_build_kill_event(row, round_num))

    rounds_total = len(round_starts) if round_starts else (max(e["round"] for e in events) if events else 0)
    duration_seconds = int(max_tick / TICKRATE) if max_tick else 0

    match_started_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

    return {
        "event": "result",
        "mode": "quick",
        "map": map_name,
        "match_started_at": match_started_at,
        "duration_seconds": duration_seconds,
        "rounds": rounds_total,
        "events": events,
    }


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="cs2-analyser", add_help=True)
    parser.add_argument("--job-id", required=True)
    parser.add_argument("--mode", required=True, choices=["quick", "full"])
    parser.add_argument("--demo", required=True, type=Path)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, stream=sys.stderr, format="%(levelname)s %(name)s: %(message)s")
    args = parse_args(argv)

    if args.mode == "full":
        emit_error("unsupported_mode", "full analysis is not implemented in v0.1")
        return 1

    if not args.demo.exists():
        emit_error("parse_failed", f"demo file not found: {args.demo}")
        return 1

    try:
        result = run_quick(args.demo)
        emit_progress("finalizing", 100, "done")
        emit(result)
        return 0
    except Exception as exc:
        logger.error("analysis failed: %s\n%s", exc, traceback.format_exc())
        emit_error("parse_failed", str(exc))
        return 1


if __name__ == "__main__":
    sys.exit(main())
