"""One-time interactive Garmin token bootstrap.

Run on a trusted computer. The printed base64 string is a credential and must
only be pasted into the GARMIN_TOKENS_B64 GitHub Actions secret.
"""

from __future__ import annotations

import base64
from getpass import getpass
from pathlib import Path

from garminconnect import Garmin

token_dir = Path.home() / ".garminconnect"

email = input("Garmin email: ").strip()
password = getpass("Garmin password: ")

client = Garmin(
    email,
    password,
    prompt_mfa=lambda: input("Garmin MFA code: ").strip(),
)
client.login(str(token_dir))

token_file = token_dir / "garmin_tokens.json"
if not token_file.exists():
    raise SystemExit("Garmin login succeeded but token file was not found.")

encoded = base64.b64encode(token_file.read_bytes()).decode("ascii")
print("\nCreate GitHub Actions secret GARMIN_TOKENS_B64 with this value:")
print(encoded)
print("\nTreat this value like a password. Do not commit or share it.")
