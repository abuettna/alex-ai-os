# Garmin Workout Bridge

Private bridge for sending AI-generated strength workouts to Garmin Connect.

## Flow

1. ChatGPT writes a `pending` request to the private Airtable table `Garmin Workout Queue`.
2. ChatGPT changes `garmin-bridge/trigger.txt` in this repository.
3. GitHub Actions runs `bridge.py`.
4. The worker reads the private Airtable payload and either creates a native Garmin strength workout or updates an existing Garmin template in place.
5. It can optionally schedule the workout and push it to Garmin's last-used device.
6. Airtable is updated to `done` with the Garmin workout ID, or `error` with a sanitized error message.

The public GitHub repository never contains the workout payload or Garmin credentials.

## Required GitHub Actions secrets

- `AIRTABLE_TOKEN`: Airtable personal access token with read/write access to the `Alex Data Lake` base.
- `GARMIN_TOKENS_B64`: base64 of the Garmin token file `~/.garminconnect/garmin_tokens.json`.

Do **not** store a Garmin password, Garmin token JSON, or Airtable token in this repository.

## One-time Garmin token bootstrap

Requires Python 3.12+ on a trusted computer:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade "garminconnect[workout]>=0.3.5,<1" curl_cffi
python garmin-bridge/bootstrap_garmin_tokens.py
```

The bootstrap script logs into Garmin interactively, handles MFA if required, saves the token store with owner-only permissions, and prints the base64 value to paste into the `GARMIN_TOKENS_B64` GitHub Actions secret. Treat that value like a password.

## Create vs update

The Airtable queue has `Operation = create | update`.

### Create

Set `Operation` to `create`. The worker creates a new native Garmin strength template and writes its Garmin ID back to Airtable.

### Update an existing template

Set `Operation` to `update`.

Matching order:

1. If `Garmin Workout ID` is supplied, that exact template is updated.
2. Otherwise the worker looks for an exact Garmin template name using `Target Workout Name`.
3. If `Target Workout Name` is empty, `Workout Name` is used as the target name. This makes simple edits easy when the template name is not changing.
4. If more than one Garmin template has that exact name, the update fails safely and requires the Garmin Workout ID.

The update is performed in place and keeps the existing Garmin workout ID. Existing Garmin calendar references to that template therefore remain attached. `Target Workout Name` is only necessary when renaming an existing template.

The worker refuses to replace a non-strength Garmin workout through this bridge.

## Queue payload schema

`Workout JSON` uses version 1:

```json
{
  "version": 1,
  "estimated_duration_seconds": 1500,
  "exercises": [
    {
      "name": "Pull-up",
      "garmin_name": "Pull-up",
      "sets": 3,
      "reps": 8,
      "rest_seconds": 90,
      "weight_kg": null
    }
  ]
}
```

`garmin_name` should be an exact Garmin exercise display name when possible. The worker also accepts explicit `garmin_category` and `garmin_exercise` fields and has conservative normalized-name matching. Ambiguous mappings fail safely rather than guessing.

If `Schedule Date` is filled, the workout is also placed on the Garmin Connect calendar for that date. If `Push to Device` is checked, the worker also requests a Garmin device push.

## Security notes

- Garmin access uses a persistent refresh-token file rather than a password in CI.
- Token directory/file permissions are forced to `0700`/`0600`.
- The bridge requires `garminconnect >= 0.3.5`, which includes the token-permission security fix.
- GitHub Actions logs deliberately avoid workout names, exercise names, payloads, and secrets.
- The Garmin library is an unofficial client of Garmin Connect web services.
