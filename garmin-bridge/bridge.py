"""Private Airtable -> Garmin Connect workout bridge.

Reads pending strength-workout requests from Airtable, creates native Garmin
strength workouts, and optionally schedules them. Secrets are supplied only
through environment variables and are never printed.
"""

from __future__ import annotations

import base64
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests
from garminconnect import Garmin, exercises
from garminconnect.workout import StrengthWorkout, WorkoutSegment, create_strength_set

AIRTABLE_BASE_ID = "app6xAdVA6xYBLwde"
AIRTABLE_TABLE_ID = "tblRMkfb0jURaID91"
AIRTABLE_API = f"https://api.airtable.com/v0/{AIRTABLE_BASE_ID}/{AIRTABLE_TABLE_ID}"
MAX_REQUESTS_PER_RUN = 5

FIELD_STATUS = "Status"
FIELD_CREATED_AT = "Created At"
FIELD_WORKOUT_NAME = "Workout Name"
FIELD_SCHEDULE_DATE = "Schedule Date"
FIELD_PUSH_TO_DEVICE = "Push to Device"
FIELD_WORKOUT_JSON = "Workout JSON"
FIELD_GARMIN_ID = "Garmin Workout ID"
FIELD_PROCESSED_AT = "Processed At"
FIELD_ERROR = "Error"


class BridgeError(RuntimeError):
    pass


def require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise BridgeError(f"Missing required secret: {name}")
    return value


def airtable_headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {require_env('AIRTABLE_TOKEN')}",
        "Content-Type": "application/json",
    }


def airtable_request(
    method: str,
    *,
    record_id: str | None = None,
    params: dict[str, Any] | None = None,
    body: dict[str, Any] | None = None,
) -> dict[str, Any]:
    url = AIRTABLE_API if record_id is None else f"{AIRTABLE_API}/{record_id}"
    response = requests.request(
        method,
        url,
        headers=airtable_headers(),
        params=params,
        json=body,
        timeout=30,
    )
    if not response.ok:
        raise BridgeError(f"Airtable API error {response.status_code}")
    return response.json()


def get_oldest_pending() -> dict[str, Any] | None:
    data = airtable_request(
        "GET",
        params={
            "maxRecords": 1,
            "filterByFormula": "{Status}='pending'",
            "sort[0][field]": FIELD_CREATED_AT,
            "sort[0][direction]": "asc",
        },
    )
    records = data.get("records") or []
    return records[0] if records else None


def update_record(record_id: str, fields: dict[str, Any]) -> None:
    airtable_request("PATCH", record_id=record_id, body={"fields": fields, "typecast": False})


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def bounded_int(value: Any, name: str, low: int, high: int) -> int:
    if isinstance(value, bool):
        raise BridgeError(f"{name} must be an integer")
    try:
        parsed = int(value)
    except (TypeError, ValueError) as exc:
        raise BridgeError(f"{name} must be an integer") from exc
    if not low <= parsed <= high:
        raise BridgeError(f"{name} must be between {low} and {high}")
    return parsed


def bounded_float(value: Any, name: str, low: float, high: float) -> float:
    if isinstance(value, bool):
        raise BridgeError(f"{name} must be numeric")
    try:
        parsed = float(value)
    except (TypeError, ValueError) as exc:
        raise BridgeError(f"{name} must be numeric") from exc
    if not low <= parsed <= high:
        raise BridgeError(f"{name} must be between {low} and {high}")
    return parsed


def normalize_name(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.casefold())


def resolve_exercise(item: dict[str, Any]) -> tuple[str, str]:
    explicit_category = str(item.get("garmin_category") or "").strip()
    explicit_exercise = str(item.get("garmin_exercise") or "").strip()
    if explicit_category:
        return explicit_category, explicit_exercise

    query = str(item.get("garmin_name") or item.get("name") or "").strip()
    if not query:
        raise BridgeError("Exercise is missing name/garmin_name")

    exact = exercises.resolve(query)
    if exact:
        return exact["category"], exact["exercise"]

    target = normalize_name(query)
    normalized = [e for e in exercises.EXERCISES if normalize_name(e["name"]) == target]
    if len(normalized) == 1:
        return normalized[0]["category"], normalized[0]["exercise"]

    contains = exercises.find(query)
    if len(contains) == 1:
        return contains[0]["category"], contains[0]["exercise"]

    if contains:
        choices = ", ".join(e["name"] for e in contains[:6])
        raise BridgeError(f"Ambiguous Garmin exercise '{query}'. Candidates: {choices}")
    raise BridgeError(f"Garmin exercise not found: '{query}'")


def parse_spec(raw: str) -> dict[str, Any]:
    try:
        spec = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise BridgeError("Workout JSON is invalid") from exc
    if not isinstance(spec, dict):
        raise BridgeError("Workout JSON must be an object")
    version = spec.get("version", 1)
    if version != 1:
        raise BridgeError(f"Unsupported workout spec version: {version}")
    items = spec.get("exercises")
    if not isinstance(items, list) or not items:
        raise BridgeError("Workout must contain at least one exercise")
    if len(items) > 30:
        raise BridgeError("Workout contains too many exercises")
    return spec


def build_strength_workout(workout_name: str, spec: dict[str, Any]) -> StrengthWorkout:
    blocks = []
    step_order = 1

    for index, raw_item in enumerate(spec["exercises"], start=1):
        if not isinstance(raw_item, dict):
            raise BridgeError(f"Exercise {index} must be an object")

        category, exercise_name = resolve_exercise(raw_item)
        sets = bounded_int(raw_item.get("sets"), f"exercise {index} sets", 1, 20)
        reps = bounded_int(raw_item.get("reps"), f"exercise {index} reps", 1, 300)
        rest_seconds = bounded_float(
            raw_item.get("rest_seconds", 90),
            f"exercise {index} rest_seconds",
            0,
            900,
        )

        weight_kg: float | None = None
        if raw_item.get("weight_kg") is not None:
            weight_kg = bounded_float(
                raw_item["weight_kg"], f"exercise {index} weight_kg", 0, 500
            )

        blocks.append(
            create_strength_set(
                category,
                step_order=step_order,
                sets=sets,
                reps=reps,
                rest_seconds=rest_seconds,
                exercise_name=exercise_name,
                weight_kg=weight_kg,
            )
        )
        # create_strength_set consumes step_order, +1 and +2.
        step_order += 3

    duration = bounded_int(
        spec.get("estimated_duration_seconds", 0),
        "estimated_duration_seconds",
        0,
        6 * 60 * 60,
    )

    return StrengthWorkout(
        workoutName=workout_name[:100],
        estimatedDurationInSecs=duration,
        workoutSegments=[
            WorkoutSegment(
                segmentOrder=1,
                sportType={"sportTypeId": 5, "sportTypeKey": "strength_training"},
                workoutSteps=blocks,
            )
        ],
        description="Created by Personal AI OS Garmin bridge",
    )


def garmin_client() -> Garmin:
    encoded = require_env("GARMIN_TOKENS_B64")
    try:
        raw = base64.b64decode(encoded, validate=True)
        json.loads(raw.decode("utf-8"))
    except Exception as exc:
        raise BridgeError("GARMIN_TOKENS_B64 is not valid token JSON") from exc

    token_dir = Path.home() / ".garminconnect"
    token_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(token_dir, 0o700)
    token_file = token_dir / "garmin_tokens.json"
    token_file.write_bytes(raw)
    os.chmod(token_file, 0o600)

    client = Garmin()
    client.login(str(token_dir))
    return client


def sanitized_error(exc: Exception) -> str:
    text = str(exc)
    text = re.sub(r"(?i)bearer\s+[A-Za-z0-9._~+/=-]+", "Bearer [redacted]", text)
    text = re.sub(r"\b[A-Za-z0-9_-]{80,}\b", "[redacted]", text)
    return text[:1800] or exc.__class__.__name__


def process_record(client: Garmin, record: dict[str, Any]) -> None:
    record_id = record["id"]
    fields = record.get("fields") or {}
    workout_name = str(fields.get(FIELD_WORKOUT_NAME) or "").strip()
    if not workout_name:
        raise BridgeError("Workout Name is missing")

    raw_spec = str(fields.get(FIELD_WORKOUT_JSON) or "")
    schedule_date = str(fields.get(FIELD_SCHEDULE_DATE) or "").strip()
    existing_garmin_id = str(fields.get(FIELD_GARMIN_ID) or "").strip()
    push_to_device = bool(fields.get(FIELD_PUSH_TO_DEVICE, False))

    update_record(record_id, {FIELD_STATUS: "processing", FIELD_ERROR: ""})

    garmin_id = existing_garmin_id
    if not garmin_id:
        spec = parse_spec(raw_spec)
        workout = build_strength_workout(workout_name, spec)
        result = client.upload_strength_workout(workout)
        garmin_id = str(result.get("workoutId") or "").strip()
        if not garmin_id:
            raise BridgeError("Garmin upload returned no workoutId")
        # Persist immediately: if scheduling fails, a retry won't create a duplicate.
        update_record(record_id, {FIELD_GARMIN_ID: garmin_id})

    if schedule_date:
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", schedule_date):
            raise BridgeError("Schedule Date must be YYYY-MM-DD")
        client.schedule_workout(garmin_id, schedule_date)

    if push_to_device:
        client.push_workout_to_device(garmin_id)

    update_record(
        record_id,
        {
            FIELD_STATUS: "done",
            FIELD_GARMIN_ID: garmin_id,
            FIELD_PROCESSED_AT: utc_now_iso(),
            FIELD_ERROR: "",
        },
    )


def main() -> int:
    # Fail before touching the queue if secrets/auth are unavailable.
    require_env("AIRTABLE_TOKEN")
    client = garmin_client()

    processed = 0
    failed = 0

    for _ in range(MAX_REQUESTS_PER_RUN):
        record = get_oldest_pending()
        if not record:
            break
        record_id = record["id"]
        try:
            process_record(client, record)
            processed += 1
        except Exception as exc:
            failed += 1
            try:
                update_record(
                    record_id,
                    {
                        FIELD_STATUS: "error",
                        FIELD_ERROR: sanitized_error(exc),
                        FIELD_PROCESSED_AT: utc_now_iso(),
                    },
                )
            except Exception:
                pass

    # Keep public Actions logs intentionally content-free.
    print(f"Garmin bridge finished: processed={processed}, failed={failed}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
