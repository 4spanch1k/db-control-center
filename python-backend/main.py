"""
DB Control Center Python Backend
FastAPI приложение для автоматизации бэкапов и аналитики
"""

import logging
import os
import asyncio
import subprocess
import sys
from datetime import datetime, timezone
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends, Query
from fastapi.responses import JSONResponse
from app.core.auth_utils import ROLE_ADMIN, ROLE_OPERATOR, get_current_user, require_roles
from pydantic import BaseModel
from app.api.endpoints.billing import get_default_billing_plans

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from db_manager import DatabaseManager
from s3_manager import S3Manager
from telegram_alerts import TelegramAlerter, AlertType

# ============================================================================
# LOGGING CONFIGURATION
# ============================================================================

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# ============================================================================
# ENVIRONMENT CONFIGURATION
# ============================================================================

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", 5432))
DB_NAME = os.getenv("DB_NAME", "control_center")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")

MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "localhost:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "backups")
MINIO_USE_SSL = os.getenv("MINIO_USE_SSL", "false").lower() == "true"

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")

BACKUP_RETENTION_DAYS = int(os.getenv("BACKUP_RETENTION_DAYS", 7))
AUTO_APPLY_MIGRATIONS = os.getenv("AUTO_APPLY_MIGRATIONS", "true").lower() == "true"
MIGRATION_TIMEOUT_SEC = int(os.getenv("MIGRATION_TIMEOUT_SEC", 120))

# ============================================================================
# GLOBAL MANAGERS
# ============================================================================

db_manager: DatabaseManager = None
s3_manager: S3Manager = None
telegram_alerter: TelegramAlerter = None
scheduler: AsyncIOScheduler = None

# daily limits per role for monetization baseline
ACTION_BACKUP_CREATE = "backup.create"
ACTION_BACKUP_RESTORE = "backup.restore"
ACTION_BACKUP_CLEANUP = "backup.cleanup"
ACTION_ANALYTICS_MANUAL = "analytics.collect_manual"
METERED_ACTIONS = (
    ACTION_BACKUP_CREATE,
    ACTION_BACKUP_RESTORE,
    ACTION_BACKUP_CLEANUP,
    ACTION_ANALYTICS_MANUAL,
)
ROLE_DAILY_LIMITS: dict[str, dict[str, int | None]] = {
    ROLE_ADMIN: {
        ACTION_BACKUP_CREATE: None,
        ACTION_BACKUP_RESTORE: None,
        ACTION_BACKUP_CLEANUP: None,
        ACTION_ANALYTICS_MANUAL: None,
    },
    ROLE_OPERATOR: {
        ACTION_BACKUP_CREATE: 20,
        ACTION_BACKUP_RESTORE: 5,
        ACTION_BACKUP_CLEANUP: 10,
        ACTION_ANALYTICS_MANUAL: 60,
    },
}

# ============================================================================
# MODELS
# ============================================================================


class CleanupResponse(BaseModel):
    """Ответ на запрос очистки"""

    success: bool
    deleted_files: int
    total_size_freed: int
    errors: int
    message: str


class HealthResponse(BaseModel):
    """Ответ на запрос здоровья"""

    status: str
    database: bool
    s3: bool
    scheduler: bool


class AnalyticsResponse(BaseModel):
    """Ответ с аналитикой"""

    success: bool
    record_id: int = None
    message: str


class AuditLogEntry(BaseModel):
    id: int
    user_email: str
    user_role: str
    action: str
    resource: str
    status: str
    details: str | None = None
    created_at: datetime


class AuditLogsResponse(BaseModel):
    success: bool
    count: int
    data: list[AuditLogEntry]


class UsageLimitEntry(BaseModel):
    action: str
    limit: int | None
    used: int
    remaining: int | None
    blocked: bool


class UsageLimitsResponse(BaseModel):
    success: bool
    role: str
    window: str
    data: list[UsageLimitEntry]


# ============================================================================
# INITIALIZATION
# ============================================================================


async def initialize_managers() -> None:
    """Инициализировать все менеджеры"""
    global db_manager, s3_manager, telegram_alerter

    logger.info("🚀 Initializing managers...")

    # Инициализация DB Manager
    db_manager = DatabaseManager(
        host=DB_HOST,
        port=DB_PORT,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
    )
    await db_manager.connect()
    await db_manager.upsert_billing_plans(get_default_billing_plans())

    # Инициализация S3 Manager
    s3_manager = S3Manager(
        endpoint_url=MINIO_ENDPOINT,
        access_key=MINIO_ACCESS_KEY,
        secret_key=MINIO_SECRET_KEY,
        bucket_name=MINIO_BUCKET,
        use_ssl=MINIO_USE_SSL,
    )

    # Инициализация Telegram Alerter
    telegram_alerter = TelegramAlerter(
        bot_token=TELEGRAM_BOT_TOKEN,
        chat_id=TELEGRAM_CHAT_ID,
    )

    logger.info("✅ All managers initialized successfully")


async def run_startup_migrations() -> None:
    """Apply Alembic migrations before service startup."""
    if not AUTO_APPLY_MIGRATIONS:
        logger.info("Skipping automatic migrations (AUTO_APPLY_MIGRATIONS=false).")
        return

    logger.info("🧱 Applying Alembic migrations...")

    backend_dir = os.path.dirname(os.path.abspath(__file__))
    try:
        alembic_cmd = os.path.join(os.path.dirname(sys.executable), "alembic")
        if not os.path.exists(alembic_cmd):
            alembic_cmd = "alembic"

        process = await asyncio.create_subprocess_exec(
            alembic_cmd,
            "-c",
            "alembic.ini",
            "upgrade",
            "head",
            cwd=backend_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
    except FileNotFoundError as exc:
        raise RuntimeError(
            "Alembic CLI is not installed in runtime environment. "
            "Install backend dependencies first."
        ) from exc

    try:
        stdout, stderr = await asyncio.wait_for(
            process.communicate(), timeout=MIGRATION_TIMEOUT_SEC
        )
    except asyncio.TimeoutError:
        process.kill()
        await process.wait()
        raise RuntimeError(
            f"Alembic migration timed out after {MIGRATION_TIMEOUT_SEC}s"
        )

    if process.returncode != 0:
        raise RuntimeError(
            "Alembic migration failed. "
            f"stdout: {stdout.decode()[:600]} "
            f"stderr: {stderr.decode()[:600]}"
        )

    logger.info("✅ Alembic migrations applied")


async def initialize_scheduler() -> None:
    """Инициализировать планировщик задач"""
    global scheduler

    logger.info("📅 Initializing scheduler...")

    scheduler = AsyncIOScheduler()

    # Добавить задачу сбора аналитики каждый час
    scheduler.add_job(
        collect_analytics_job,
        CronTrigger(minute=0),  # Запускать в начале каждого часа
        id="collect_analytics",
        name="Collect analytics",
        misfire_grace_time=60,
    )

    # Добавить задачу очистки бэкапов каждый день в 2 ночи
    scheduler.add_job(
        cleanup_backups_job,
        CronTrigger(hour=2, minute=0),  # Запускать в 02:00
        id="cleanup_backups",
        name="Cleanup old backups",
        misfire_grace_time=300,
    )

    scheduler.start()
    logger.info("✅ Scheduler started with 2 jobs")


async def write_audit_log(
    user: dict,
    action: str,
    resource: str,
    status: str,
    details: str | None = None,
) -> None:
    """Best-effort audit log writer."""
    try:
        if not db_manager:
            return
        await db_manager.log_audit_action(
            user_email=user.get("email", "unknown"),
            user_role=user.get("role", "viewer"),
            action=action,
            resource=resource,
            status=status,
            details=details,
        )
    except Exception as exc:
        logger.error(f"Failed to write audit log ({action}): {exc}")


def get_limits_for_role(role: str) -> dict[str, int | None]:
    role_key = str(role).lower()
    if role_key in ROLE_DAILY_LIMITS:
        return ROLE_DAILY_LIMITS[role_key]

    # unknown/lowest role: all metered actions blocked by default
    return {action: 0 for action in METERED_ACTIONS}


def utc_day_start() -> datetime:
    now = datetime.now(timezone.utc)
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


async def get_action_usage(user_email: str, action: str) -> int:
    try:
        return await db_manager.count_user_action_usage(
            user_email=user_email,
            action=action,
            since=utc_day_start(),
        )
    except Exception as exc:
        # fail-open on metering issues to avoid service outage
        logger.error(f"Usage counter failed for {user_email}/{action}: {exc}")
        return 0


async def enforce_daily_limit(user: dict, action: str) -> None:
    role = str(user.get("role", "")).lower()
    limits = get_limits_for_role(role)
    action_limit = limits.get(action)
    if action_limit is None:
        return

    used = await get_action_usage(user.get("email", "unknown"), action)
    if used < action_limit:
        return

    await write_audit_log(
        user=user,
        action=action,
        resource="quota",
        status="denied_limit",
        details=f"limit={action_limit}, used={used}",
    )
    raise HTTPException(
        status_code=429,
        detail=(
            "Дневной лимит исчерпан для операции "
            f"`{action}`: {used}/{action_limit}"
        ),
    )


async def build_usage_limits(user: dict) -> list[UsageLimitEntry]:
    role = str(user.get("role", "")).lower()
    email = user.get("email", "unknown")
    limits = get_limits_for_role(role)
    rows: list[UsageLimitEntry] = []
    for action in METERED_ACTIONS:
        action_limit = limits.get(action)
        used = await get_action_usage(email, action)
        remaining = None if action_limit is None else max(action_limit - used, 0)
        rows.append(
            UsageLimitEntry(
                action=action,
                limit=action_limit,
                used=used,
                remaining=remaining,
                blocked=(action_limit is not None and used >= action_limit),
            )
        )
    return rows


# ============================================================================
# SCHEDULED JOBS
# ============================================================================


async def collect_analytics_job() -> None:
    """Запланированная задача: сбор аналитики БД каждый час"""
    logger.info("📊 Running scheduled analytics collection...")

    try:
        # Получить статистику БД
        db_stats = await db_manager.get_database_stats()

        # Получить размер бэкапов
        total_backups_size, backups_count = await s3_manager.get_total_backups_size()

        # Вставить запись в БД
        record_id = await db_manager.insert_analytics_stats(
            total_backups_size=total_backups_size,
            backups_count=backups_count,
            db_tables_count=db_stats["db_tables_count"],
            indexes_size=db_stats["indexes_size"],
            active_connections=db_stats["active_connections"],
            db_size=db_stats["db_size"],
        )

        logger.info(f"✅ Analytics collection completed (record_id={record_id})")

        # Отправить отчет в Telegram
        await telegram_alerter.send_analytics_report(
            tables_count=db_stats["db_tables_count"],
            db_size=db_stats["db_size"],
            backups_count=backups_count,
            backups_size=total_backups_size,
            active_connections=db_stats["active_connections"],
        )

    except Exception as e:
        logger.error(f"❌ Error in analytics collection: {e}")
        await telegram_alerter.send_error_alert("Analytics Collection", str(e))


async def cleanup_backups_job() -> None:
    """Запланированная задача: очистка старых бэкапов каждый день"""
    logger.info("🗑️  Running scheduled backup cleanup...")

    try:
        # Очистить старые бэкапы
        deleted_count, error_count, total_size = await s3_manager.cleanup_old_backups(
            days=BACKUP_RETENTION_DAYS
        )

        # Логировать в БД (для каждого удаленного файла)
        if deleted_count > 0:
            await db_manager.log_backup_deletion(
                backup_key="batch_cleanup",
                deleted_size=total_size,
                reason=f"Automated cleanup of {deleted_count} files older than {BACKUP_RETENTION_DAYS} days",
            )

        # Определить тип оповещения
        alert_type = (
            AlertType.ERROR if error_count > 0 else AlertType.SUCCESS
        )

        # Отправить отчет в Telegram
        await telegram_alerter.send_cleanup_report(
            alert_type=alert_type,
            deleted_count=deleted_count,
            total_size=total_size,
            error_count=error_count,
        )

        logger.info(
            f"✅ Backup cleanup completed: deleted={deleted_count}, "
            f"errors={error_count}, freed={total_size} bytes"
        )

    except Exception as e:
        logger.error(f"❌ Error in backup cleanup: {e}")
        await telegram_alerter.send_error_alert("Backup Cleanup", str(e))


# ============================================================================
# LIFESPAN
# ============================================================================


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Управление жизненным циклом приложения"""
    # Startup
    logger.info("🏁 Starting application...")
    await run_startup_migrations()
    await initialize_managers()
    await initialize_scheduler()
    logger.info("✅ Application started successfully")

    yield

    # Shutdown
    logger.info("🛑 Shutting down application...")
    if scheduler:
        scheduler.shutdown()
    if db_manager:
        await db_manager.close()
    logger.info("✅ Application shut down successfully")


# ============================================================================
# FASTAPI APP
# ============================================================================

from fastapi.middleware.cors import CORSMiddleware
from app.api.endpoints.connections import router as connections_router
from app.api.endpoints.auth import router as auth_router
from app.api.endpoints.users import router as users_router
from app.api.endpoints.billing import router as billing_router

app = FastAPI(
    title="DB Control Center Python Backend",
    description="Автоматизация бэкапов и аналитики",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(connections_router, prefix="/api/connections", tags=["connections"])
app.include_router(auth_router, prefix="/api", tags=["auth"])
app.include_router(users_router, prefix="/api", tags=["users"])
app.include_router(billing_router, prefix="/api", tags=["billing"])


# ============================================================================
# HEALTH CHECK
# ============================================================================


@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Проверить здоровье сервиса"""
    try:
        db_ok = await db_manager.health_check()
        s3_ok = await s3_manager.health_check()
        scheduler_ok = scheduler.running if scheduler else False

        return HealthResponse(
            status="healthy" if all([db_ok, s3_ok, scheduler_ok]) else "degraded",
            database=db_ok,
            s3=s3_ok,
            scheduler=scheduler_ok,
        )
    except Exception as e:
        logger.error(f"❌ Health check failed: {e}")
        raise HTTPException(status_code=503, detail="Service unavailable")


# ============================================================================
# BACKUPS AND ANALYTICS ENDPOINTS
# ============================================================================

class BackupResponse(BaseModel):
    success: bool
    message: str

async def create_backup_job():
    """Фоновая задача создания бэкапа и загрузки в MinIO"""
    logger.info("💾 Starting manual backup creation...")
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    file_name = f"control_center_{timestamp}.sql"
    file_path = f"/tmp/{file_name}"
    
    try:
        # Run pg_dump
        process = await asyncio.create_subprocess_shell(
            f"pg_dump -h {DB_HOST} -p {DB_PORT} -U {DB_USER} -d {DB_NAME} -F c -f {file_path}",
            env=dict(os.environ, PGPASSWORD=DB_PASSWORD),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        stdout, stderr = await process.communicate()
        
        if process.returncode != 0:
            logger.error(f"❌ pg_dump failed: {stderr.decode()}")
            await telegram_alerter.send_error_alert("Backup Creation", f"pg_dump failed: {stderr.decode()}")
            return False
            
        logger.info(f"✅ Backup created locally at {file_path}")
        
        # Upload to MinIO
        file_size = os.path.getsize(file_path)
        success = await s3_manager.upload_file(file_path, file_name)
        
        # Log to DB
        if success:
            await db_manager.log_backup_action(
                action="create", 
                filename=file_name, 
                size_bytes=file_size, 
                status="success"
            )
            logger.info(f"✅ Backup {file_name} completed.")
        else:
            await db_manager.log_backup_action(
                action="create", 
                filename=file_name, 
                size_bytes=file_size, 
                status="error",
                error_message="Upload to MinIO failed"
            )
            logger.error(f"❌ Backup {file_name} failed to upload.")
            
    except Exception as e:
        logger.error(f"❌ Error during backup creation: {e}")
        await telegram_alerter.send_error_alert("Backup Creation", str(e))
        try:
            await db_manager.log_backup_action(
                action="create", 
                filename=file_name, 
                size_bytes=0, 
                status="error",
                error_message=str(e)
            )
        except Exception as inner_e:
            logger.error(f"Failed to log error to db: {inner_e}")
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)

@app.post("/api/backup/create", response_model=BackupResponse)
async def trigger_backup_create(
    background_tasks: BackgroundTasks,
    current_user=Depends(require_roles(ROLE_ADMIN, ROLE_OPERATOR)),
) -> BackupResponse:
    """Запуск создания бэкапа в фоне"""
    await enforce_daily_limit(current_user, ACTION_BACKUP_CREATE)
    background_tasks.add_task(create_backup_job)
    await write_audit_log(
        user=current_user,
        action=ACTION_BACKUP_CREATE,
        resource="control_center",
        status="accepted",
    )
    return BackupResponse(success=True, message="Backup process started in background")

class RestoreRequest(BaseModel):
    filename: str

async def restore_backup_job(filename: str):
    """Фоновая задача скачивания и восстановления бэкапа"""
    logger.info(f"🔄 Starting manual backup restore for {filename}...")
    file_path = f"/tmp/{filename}"
    
    try:
        # 1. Download from MinIO
        success_download = await s3_manager.download_file(filename, file_path)
        if not success_download:
            logger.error(f"❌ Failed to download {filename} from S3.")
            await telegram_alerter.send_error_alert("Backup Restore", f"Failed to download {filename} from S3.")
            return False
            
        # 2. Restore DB
        success_restore = await db_manager.restore_database(file_path)
        if not success_restore:
            logger.error(f"❌ Failed to restore database from {filename}.")
            await telegram_alerter.send_error_alert("Backup Restore", f"pg_restore failed for {filename}.")
            return False
            
        logger.info(f"✅ Backup {filename} successfully restored.")
        await db_manager.log_backup_action(
            action="restore", 
            filename=filename, 
            size_bytes=os.path.getsize(file_path), 
            status="success"
        )
            
    except Exception as e:
        logger.error(f"❌ Error during backup restore: {e}")
        await telegram_alerter.send_error_alert("Backup Restore", str(e))
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)

@app.post("/api/backup/restore", response_model=BackupResponse)
async def trigger_backup_restore(
    request: RestoreRequest,
    background_tasks: BackgroundTasks,
    current_user=Depends(require_roles(ROLE_ADMIN, ROLE_OPERATOR)),
) -> BackupResponse:
    """Запуск восстановления бэкапа в фоне"""
    await enforce_daily_limit(current_user, ACTION_BACKUP_RESTORE)
    background_tasks.add_task(restore_backup_job, request.filename)
    await write_audit_log(
        user=current_user,
        action=ACTION_BACKUP_RESTORE,
        resource=request.filename,
        status="accepted",
    )
    return BackupResponse(success=True, message=f"Restore process for {request.filename} started in background")


@app.post("/api/trigger-cleanup", response_model=CleanupResponse)
async def trigger_cleanup(current_user=Depends(require_roles(ROLE_ADMIN, ROLE_OPERATOR))) -> CleanupResponse:
    """
    Принудительно запустить очистку старых бэкапов
    
    Эндпоинт вызывается кнопкой на дашборде
    """
    logger.info("🗑️  Manual cleanup triggered")
    await enforce_daily_limit(current_user, ACTION_BACKUP_CLEANUP)

    try:
        # Запустить очистку в фоне
        deleted_count, error_count, total_size = await s3_manager.cleanup_old_backups(
            days=BACKUP_RETENTION_DAYS
        )

        # Логировать в БД
        if deleted_count > 0:
            await db_manager.log_backup_deletion(
                backup_key="manual_cleanup",
                deleted_size=total_size,
                reason="Manual cleanup triggered by user",
            )

        # Отправить оповещение
        alert_type = AlertType.ERROR if error_count > 0 else AlertType.SUCCESS
        await telegram_alerter.send_cleanup_report(
            alert_type=alert_type,
            deleted_count=deleted_count,
            total_size=total_size,
            error_count=error_count,
            details="Manual cleanup",
        )

        await write_audit_log(
            user=current_user,
            action=ACTION_BACKUP_CLEANUP,
            resource="backups",
            status="success" if error_count == 0 else "partial",
            details=f"deleted={deleted_count}, errors={error_count}, freed={total_size}",
        )

        return CleanupResponse(
            success=error_count == 0,
            deleted_files=deleted_count,
            total_size_freed=total_size,
            errors=error_count,
            message=f"Cleanup completed: {deleted_count} files deleted, "
            f"{error_count} errors",
        )

    except Exception as e:
        logger.error(f"❌ Cleanup failed: {e}")
        await telegram_alerter.send_error_alert("Manual Cleanup", str(e))
        await write_audit_log(
            user=current_user,
            action=ACTION_BACKUP_CLEANUP,
            resource="backups",
            status="error",
            details=str(e),
        )
        raise HTTPException(status_code=500, detail=f"Cleanup failed: {str(e)}")


@app.post("/api/trigger-analytics", response_model=AnalyticsResponse)
async def trigger_analytics(
    current_user=Depends(require_roles(ROLE_ADMIN, ROLE_OPERATOR)),
) -> AnalyticsResponse:
    """
    Принудительно собрать аналитику
    
    Эндпоинт для ручного срабатывания сбора данных
    """
    logger.info("📊 Manual analytics collection triggered")
    await enforce_daily_limit(current_user, ACTION_ANALYTICS_MANUAL)

    try:
        # Получить статистику БД
        db_stats = await db_manager.get_database_stats()

        # Получить размер бэкапов
        total_backups_size, backups_count = await s3_manager.get_total_backups_size()

        # Вставить запись в БД
        record_id = await db_manager.insert_analytics_stats(
            total_backups_size=total_backups_size,
            backups_count=backups_count,
            db_tables_count=db_stats["db_tables_count"],
            indexes_size=db_stats["indexes_size"],
            active_connections=db_stats["active_connections"],
            db_size=db_stats["db_size"],
        )

        await write_audit_log(
            user=current_user,
            action=ACTION_ANALYTICS_MANUAL,
            resource="analytics_stats",
            status="success",
            details=f"record_id={record_id}",
        )

        return AnalyticsResponse(
            success=True,
            record_id=record_id,
            message="Analytics record created successfully",
        )

    except Exception as e:
        logger.error(f"❌ Analytics collection failed: {e}")
        await write_audit_log(
            user=current_user,
            action=ACTION_ANALYTICS_MANUAL,
            resource="analytics_stats",
            status="error",
            details=str(e),
        )
        raise HTTPException(status_code=500, detail=f"Analytics failed: {str(e)}")


@app.get("/api/audit/logs", response_model=AuditLogsResponse)
async def get_audit_logs(
    limit: int = Query(default=100, ge=1, le=500),
    _=Depends(require_roles(ROLE_ADMIN)),
) -> AuditLogsResponse:
    rows = await db_manager.get_recent_audit_logs(limit=limit)
    return AuditLogsResponse(success=True, count=len(rows), data=rows)


@app.get("/api/usage/limits", response_model=UsageLimitsResponse)
async def get_usage_limits(
    current_user=Depends(get_current_user),
) -> UsageLimitsResponse:
    entries = await build_usage_limits(current_user)
    return UsageLimitsResponse(
        success=True,
        role=str(current_user.get("role", "viewer")).lower(),
        window="day",
        data=entries,
    )


# ============================================================================
# ROOT ENDPOINT
# ============================================================================


@app.get("/")
async def root():
    """Информация о сервисе"""
    return {
        "service": "DB Control Center Python Backend",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "health": "/health",
            "trigger_cleanup": "POST /api/trigger-cleanup",
            "trigger_analytics": "POST /api/trigger-analytics",
            "audit_logs": "GET /api/audit/logs",
            "usage_limits": "GET /api/usage/limits",
            "billing_current": "GET /api/billing/current",
            "billing_checkout": "POST /api/billing/checkout",
            "docs": "/docs",
        },
    }


# ============================================================================
# ERROR HANDLERS
# ============================================================================


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Глобальный обработчик исключений"""
    logger.error(f"❌ Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "error": str(exc)},
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level=os.getenv("LOG_LEVEL", "info").lower(),
    )
