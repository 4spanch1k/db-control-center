import asyncio
import os
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.core.auth_utils import hash_password
from db_manager import DatabaseManager


async def seed_admin() -> int:
    email = os.getenv("ADMIN_EMAIL", "admin@example.com")
    password = os.getenv("ADMIN_PASSWORD", "")

    if not password:
        print("ERROR: ADMIN_PASSWORD is required.")
        return 1

    db_manager = DatabaseManager(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "5432")),
        database=os.getenv("DB_NAME", "control_center"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "postgres"),
    )

    await db_manager.connect()
    try:
        existing_user = await db_manager.get_user_by_email(email)
        if existing_user:
            print(f"User {email} already exists. Updating password...")
            await db_manager.update_user_password(email, hash_password(password))
            await db_manager.update_user_role(email, "admin")

            print("Admin password and role updated successfully.")
            return 0

        user_id = await db_manager.create_user(email, hash_password(password), role="admin")
        print(f"Admin user created successfully: {email} (id={user_id})")
        return 0
    finally:
        await db_manager.close()


def main() -> None:
    code = asyncio.run(seed_admin())
    sys.exit(code)


if __name__ == "__main__":
    main()
