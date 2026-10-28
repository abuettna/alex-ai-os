"""One-time interactive Garmin token bootstrap.

Run on a trusted computer from the repository root. Garmin credentials and MFA
are sent only to Garmin during login and are never written to the repository.
The resulting OAuth token state is encrypted before it is written to the repo.
"""

from __future__ import annotations

from getpass import getpass
from pathlib import Path

from cryptography.fernet import Fernet
from garminconnect import Garmin

repo_root = Path(__file__).resolve().parent.parent
token_dir = Path.home() / ".garminconnect"
encrypted_file = repo_root / "garmin-bridge" / "garmin_tokens.enc"

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

key = Fernet.generate_key()
encrypted = Fernet(key).encrypt(token_file.read_bytes())
encrypted_file.write_bytes(encrypted)

print("\nGarmin login successful.")
print(f"Encrypted token state written to: {encrypted_file}")
print("\nCreate GitHub Actions secret GARMIN_TOKEN_KEY with this value:")
print(key.decode("ascii"))
print("\nIMPORTANT:")
print("- Treat GARMIN_TOKEN_KEY like a password; do not commit, paste into chat, or share it.")
print("- garmin_tokens.enc contains encrypted token state and is intended to be committed.")
print("- Your Garmin password is not stored in the repository or GitHub Actions.")
