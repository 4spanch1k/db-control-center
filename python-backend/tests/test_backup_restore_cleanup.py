import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import BackgroundTasks, HTTPException

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import main as backend_main


class _FakeProcess:
    def __init__(self, returncode: int, stdout: bytes = b"", stderr: bytes = b""):
        self.returncode = returncode
        self._stdout = stdout
        self._stderr = stderr

    async def communicate(self):
        return self._stdout, self._stderr


class BackupRestoreCleanupIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self._original_db = backend_main.db_manager
        self._original_s3 = backend_main.s3_manager
        self._original_tg = backend_main.telegram_alerter

        self.db_manager = SimpleNamespace(
            log_backup_action=AsyncMock(),
            restore_database=AsyncMock(return_value=True),
            log_backup_deletion=AsyncMock(),
        )
        self.s3_manager = SimpleNamespace(
            upload_file=AsyncMock(return_value=True),
            download_file=AsyncMock(return_value=True),
            cleanup_old_backups=AsyncMock(return_value=(2, 0, 2048)),
        )
        self.telegram_alerter = SimpleNamespace(
            send_error_alert=AsyncMock(),
            send_cleanup_report=AsyncMock(),
        )

        backend_main.db_manager = self.db_manager
        backend_main.s3_manager = self.s3_manager
        backend_main.telegram_alerter = self.telegram_alerter

    async def asyncTearDown(self):
        backend_main.db_manager = self._original_db
        backend_main.s3_manager = self._original_s3
        backend_main.telegram_alerter = self._original_tg

    async def test_trigger_backup_create_schedules_background_job(self):
        tasks = BackgroundTasks()
        response = await backend_main.trigger_backup_create(tasks, _={"email": "admin@example.com"})

        self.assertTrue(response.success)
        self.assertEqual(response.message, "Backup process started in background")
        self.assertEqual(len(tasks.tasks), 1)
        self.assertIs(tasks.tasks[0].func, backend_main.create_backup_job)

    async def test_trigger_backup_restore_schedules_background_job(self):
        tasks = BackgroundTasks()
        payload = backend_main.RestoreRequest(filename="backup.sql")
        response = await backend_main.trigger_backup_restore(payload, tasks, _={"email": "admin@example.com"})

        self.assertTrue(response.success)
        self.assertIn("Restore process for backup.sql started in background", response.message)
        self.assertEqual(len(tasks.tasks), 1)
        self.assertIs(tasks.tasks[0].func, backend_main.restore_backup_job)
        self.assertEqual(tasks.tasks[0].args, ("backup.sql",))

    async def test_create_backup_job_success_logs_success(self):
        process = _FakeProcess(returncode=0)

        with (
            patch.object(
                backend_main.asyncio,
                "create_subprocess_shell",
                new=AsyncMock(return_value=process),
            ),
            patch.object(backend_main.os.path, "getsize", return_value=512),
            patch.object(backend_main.os.path, "exists", return_value=False),
        ):
            await backend_main.create_backup_job()

        self.s3_manager.upload_file.assert_awaited_once()
        self.db_manager.log_backup_action.assert_awaited_once()
        kwargs = self.db_manager.log_backup_action.await_args.kwargs
        self.assertEqual(kwargs["action"], "create")
        self.assertEqual(kwargs["status"], "success")
        self.assertEqual(kwargs["size_bytes"], 512)
        self.telegram_alerter.send_error_alert.assert_not_awaited()

    async def test_create_backup_job_pg_dump_failure_sends_alert(self):
        process = _FakeProcess(returncode=1, stderr=b"pg_dump error")

        with (
            patch.object(
                backend_main.asyncio,
                "create_subprocess_shell",
                new=AsyncMock(return_value=process),
            ),
            patch.object(backend_main.os.path, "exists", return_value=False),
        ):
            result = await backend_main.create_backup_job()

        self.assertFalse(result)
        self.s3_manager.upload_file.assert_not_awaited()
        self.db_manager.log_backup_action.assert_not_awaited()
        self.telegram_alerter.send_error_alert.assert_awaited_once()

    async def test_create_backup_job_upload_failure_logs_error(self):
        process = _FakeProcess(returncode=0)
        self.s3_manager.upload_file = AsyncMock(return_value=False)

        with (
            patch.object(
                backend_main.asyncio,
                "create_subprocess_shell",
                new=AsyncMock(return_value=process),
            ),
            patch.object(backend_main.os.path, "getsize", return_value=256),
            patch.object(backend_main.os.path, "exists", return_value=False),
        ):
            await backend_main.create_backup_job()

        kwargs = self.db_manager.log_backup_action.await_args.kwargs
        self.assertEqual(kwargs["status"], "error")
        self.assertEqual(kwargs["error_message"], "Upload to MinIO failed")

    async def test_restore_backup_job_success_logs_restore(self):
        with (
            patch.object(backend_main.os.path, "getsize", return_value=1024),
            patch.object(backend_main.os.path, "exists", return_value=False),
        ):
            await backend_main.restore_backup_job("backup.sql")

        self.s3_manager.download_file.assert_awaited_once_with("backup.sql", "/tmp/backup.sql")
        self.db_manager.restore_database.assert_awaited_once_with("/tmp/backup.sql")
        kwargs = self.db_manager.log_backup_action.await_args.kwargs
        self.assertEqual(kwargs["action"], "restore")
        self.assertEqual(kwargs["status"], "success")
        self.assertEqual(kwargs["size_bytes"], 1024)
        self.telegram_alerter.send_error_alert.assert_not_awaited()

    async def test_restore_backup_job_download_failure_sends_alert(self):
        self.s3_manager.download_file = AsyncMock(return_value=False)

        with patch.object(backend_main.os.path, "exists", return_value=False):
            result = await backend_main.restore_backup_job("backup.sql")

        self.assertFalse(result)
        self.db_manager.restore_database.assert_not_awaited()
        self.db_manager.log_backup_action.assert_not_awaited()
        self.telegram_alerter.send_error_alert.assert_awaited_once()

    async def test_restore_backup_job_restore_failure_sends_alert(self):
        self.db_manager.restore_database = AsyncMock(return_value=False)

        with patch.object(backend_main.os.path, "exists", return_value=False):
            result = await backend_main.restore_backup_job("backup.sql")

        self.assertFalse(result)
        self.db_manager.log_backup_action.assert_not_awaited()
        self.telegram_alerter.send_error_alert.assert_awaited_once()

    async def test_trigger_cleanup_success(self):
        response = await backend_main.trigger_cleanup(_={"email": "admin@example.com"})

        self.assertTrue(response.success)
        self.assertEqual(response.deleted_files, 2)
        self.assertEqual(response.errors, 0)
        self.db_manager.log_backup_deletion.assert_awaited_once()
        self.telegram_alerter.send_cleanup_report.assert_awaited_once()
        cleanup_report_kwargs = self.telegram_alerter.send_cleanup_report.await_args.kwargs
        self.assertEqual(cleanup_report_kwargs["alert_type"], backend_main.AlertType.SUCCESS)

    async def test_trigger_cleanup_failure_raises_http_500(self):
        self.s3_manager.cleanup_old_backups = AsyncMock(side_effect=RuntimeError("cleanup broken"))

        with self.assertRaises(HTTPException) as context:
            await backend_main.trigger_cleanup(_={"email": "admin@example.com"})

        self.assertEqual(context.exception.status_code, 500)
        self.telegram_alerter.send_error_alert.assert_awaited_once()


if __name__ == "__main__":
    unittest.main()
