import sys
import unittest
from datetime import datetime, timedelta, timezone
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
        self._original_restore_approvals = backend_main.restore_approvals

        self.db_manager = SimpleNamespace(
            log_backup_action=AsyncMock(),
            restore_database=AsyncMock(return_value=True),
            log_backup_deletion=AsyncMock(),
            log_audit_action=AsyncMock(),
            count_user_action_usage=AsyncMock(return_value=0),
            get_database_stats=AsyncMock(return_value={"active_connections": 0}),
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
        backend_main.restore_approvals = {}

    async def asyncTearDown(self):
        backend_main.db_manager = self._original_db
        backend_main.s3_manager = self._original_s3
        backend_main.telegram_alerter = self._original_tg
        backend_main.restore_approvals = self._original_restore_approvals

    async def test_trigger_backup_create_schedules_background_job(self):
        tasks = BackgroundTasks()
        response = await backend_main.trigger_backup_create(
            tasks,
            current_user={"email": "admin@example.com", "role": "admin"},
        )

        self.assertTrue(response.success)
        self.assertEqual(response.message, "Backup process started in background")
        self.assertEqual(len(tasks.tasks), 1)
        self.assertIs(tasks.tasks[0].func, backend_main.create_backup_job)

    async def test_prepare_backup_restore_generates_request(self):
        process = _FakeProcess(
            returncode=0,
            stdout=b"; comments\n10 TABLE users\n11 TABLE roles",
        )
        payload = backend_main.RestorePrepareRequest(filename="backup.sql")

        with (
            patch.object(
                backend_main.asyncio,
                "create_subprocess_exec",
                new=AsyncMock(return_value=process),
            ),
            patch.object(backend_main.os.path, "getsize", return_value=2048),
            patch.object(backend_main.os.path, "exists", return_value=False),
        ):
            response = await backend_main.prepare_backup_restore(
                payload,
                current_user={"email": "admin@example.com", "role": "admin"},
            )

        self.assertTrue(response.success)
        self.assertEqual(response.filename, "backup.sql")
        self.assertEqual(response.backup_size_bytes, 2048)
        self.assertEqual(response.objects_count, 2)
        self.assertIn(response.request_id, backend_main.restore_approvals)

    async def test_trigger_backup_restore_schedules_background_job(self):
        tasks = BackgroundTasks()
        request_id = "restore-request-1"
        backend_main.restore_approvals[request_id] = {
            "filename": "backup.sql",
            "user_email": "admin@example.com",
            "expires_at": datetime.now(timezone.utc) + timedelta(minutes=5),
        }
        payload = backend_main.RestoreConfirmRequest(
            request_id=request_id,
            filename_confirmation="backup.sql",
        )
        response = await backend_main.trigger_backup_restore(
            payload,
            tasks,
            current_user={"email": "admin@example.com", "role": "admin"},
        )

        self.assertTrue(response.success)
        self.assertIn("Restore process for backup.sql started in background", response.message)
        self.assertEqual(len(tasks.tasks), 1)
        self.assertIs(tasks.tasks[0].func, backend_main.restore_backup_job)
        self.assertEqual(tasks.tasks[0].args, ("backup.sql",))
        self.assertNotIn(request_id, backend_main.restore_approvals)

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
        response = await backend_main.trigger_cleanup(
            current_user={"email": "admin@example.com", "role": "admin"}
        )

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
            await backend_main.trigger_cleanup(
                current_user={"email": "admin@example.com", "role": "admin"}
            )

        self.assertEqual(context.exception.status_code, 500)
        self.telegram_alerter.send_error_alert.assert_awaited_once()

    async def test_operator_limit_exceeded_returns_429(self):
        self.db_manager.count_user_action_usage = AsyncMock(return_value=20)
        tasks = BackgroundTasks()

        with self.assertRaises(HTTPException) as context:
            await backend_main.trigger_backup_create(
                tasks,
                current_user={"email": "operator@example.com", "role": "operator"},
            )

        self.assertEqual(context.exception.status_code, 429)
        self.assertEqual(len(tasks.tasks), 0)


if __name__ == "__main__":
    unittest.main()
