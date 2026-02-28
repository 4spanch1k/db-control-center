"""
PostgreSQL Database Manager
Управление подключениями и запросами к БД для аналитики
"""

import asyncio
import logging
from typing import Dict, Optional, Tuple
from datetime import datetime

import asyncpg
from asyncpg.pool import Pool
import os
import subprocess

logger = logging.getLogger(__name__)


class DatabaseManager:
    """Менеджер для работы с PostgreSQL"""

    def __init__(
        self,
        host: str,
        port: int,
        database: str,
        user: str,
        password: str,
        min_size: int = 5,
        max_size: int = 20,
    ):
        self.host = host
        self.port = port
        self.database = database
        self.user = user
        self.password = password
        self.min_size = min_size
        self.max_size = max_size
        self.pool: Optional[Pool] = None

    async def connect(self) -> None:
        try:
            self.pool = await asyncpg.create_pool(
                host=self.host,
                port=self.port,
                database=self.database,
                user=self.user,
                password=self.password,
                min_size=self.min_size,
                max_size=self.max_size,
                command_timeout=60,
            )
            logger.info(f"Connected to PostgreSQL: {self.host}:{self.port}/{self.database}")
            await self.init_tables()
        except Exception as e:
            logger.error(f"Failed to connect to PostgreSQL: {e}")
            raise

    async def init_tables(self) -> None:
        conn = None
        try:
            conn = await self.get_connection()
            await conn.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto;")
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS connections (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    name VARCHAR(255) NOT NULL,
                    db_type VARCHAR(50) NOT NULL,
                    host VARCHAR(255) NOT NULL,
                    port INTEGER NOT NULL,
                    username VARCHAR(255) NOT NULL,
                    encrypted_password TEXT NOT NULL,
                    database_name VARCHAR(255),
                    created_at TIMESTAMP DEFAULT NOW(),
                    last_check_status BOOLEAN,
                    last_check_at TIMESTAMP
                );
                
                CREATE TABLE IF NOT EXISTS users (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    email VARCHAR(255) UNIQUE NOT NULL,
                    hashed_password TEXT NOT NULL,
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT NOW()
                );
                
                CREATE TABLE IF NOT EXISTS backup_logs (
                    id SERIAL PRIMARY KEY,
                    action VARCHAR(50) NOT NULL,
                    filename VARCHAR(255) NOT NULL,
                    size_bytes BIGINT NOT NULL,
                    status VARCHAR(50) NOT NULL,
                    error_message TEXT,
                    created_at TIMESTAMP DEFAULT NOW()
                );

                CREATE TABLE IF NOT EXISTS analytics_stats (
                    id BIGSERIAL PRIMARY KEY,
                    "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    total_backups_size BIGINT NOT NULL DEFAULT 0,
                    backups_count INTEGER NOT NULL DEFAULT 0,
                    db_tables_count INTEGER NOT NULL DEFAULT 0,
                    indexes_size BIGINT NOT NULL DEFAULT 0,
                    active_connections INTEGER NOT NULL DEFAULT 0,
                    db_size BIGINT DEFAULT 0,
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS backup_deletion_logs (
                    id BIGSERIAL PRIMARY KEY,
                    backup_key VARCHAR(500) NOT NULL,
                    deleted_size BIGINT NOT NULL,
                    deleted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    reason VARCHAR(255) DEFAULT NULL,
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
            """)
            logger.info("Checked/created DB tables (connections, users, backup_logs, analytics_stats, backup_deletion_logs)")
        except Exception as e:
            logger.error(f"Error initializing tables: {e}")
            raise
        finally:
            if conn:
                await self.pool.release(conn)

    async def close(self) -> None:
        """Закрытие пула соединений"""
        if self.pool:
            await self.pool.close()
            logger.info("✅ PostgreSQL connection pool closed")

    async def get_connection(self) -> asyncpg.Connection:
        """Получить соединение из пула"""
        if not self.pool:
            raise RuntimeError("Database pool not initialized. Call connect() first.")
        return await self.pool.acquire()

    async def health_check(self) -> bool:
        """Проверка доступности БД"""
        conn = None
        try:
            conn = await self.get_connection()
            await conn.execute("SELECT 1")
            return True
        except Exception as e:
            logger.error(f"❌ Database health check failed: {e}")
            return False
        finally:
            if conn:
                await self.pool.release(conn)

    async def log_backup_action(self, action: str, filename: str, size_bytes: int, status: str, error_message: str = None) -> Optional[int]:
        conn = None
        try:
            conn = await self.get_connection()
            record_id = await conn.fetchval(
                """
                INSERT INTO backup_logs (action, filename, size_bytes, status, error_message)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id
                """,
                action, filename, size_bytes, status, error_message
            )
            return record_id
        except Exception as e:
            logger.error(f"❌ Error logging backup action: {e}")
            return None
        finally:
            if conn:
                await self.pool.release(conn)

    async def get_database_stats(self) -> Dict[str, int]:
        """
        Получить статистику БД:
        - Количество таблиц
        - Размер БД
        - Размер индексов
        - Активные подключения
        """
        conn = None
        try:
            conn = await self.get_connection()

            # Количество таблиц
            tables_count = await conn.fetchval(
                """
                SELECT COUNT(*) 
                FROM information_schema.tables 
                WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
                """
            )

            # Размер БД
            db_size = await conn.fetchval(
                "SELECT pg_database_size(current_database())"
            )

            # Размер индексов
            indexes_size = await conn.fetchval(
                """
                SELECT COALESCE(SUM(pg_relation_size(indexrelid)), 0)
                FROM pg_stat_user_indexes
                """
            )

            # Активные подключения
            active_connections = await conn.fetchval(
                """
                SELECT COUNT(*) 
                FROM pg_stat_activity 
                WHERE state = 'active'
                """
            )

            # Idle подключения
            idle_connections = await conn.fetchval(
                """
                SELECT COUNT(*) 
                FROM pg_stat_activity 
                WHERE state = 'idle'
                """
            )

            logger.info(
                f"📊 Database stats: "
                f"tables={tables_count}, "
                f"db_size={db_size}, "
                f"indexes_size={indexes_size}, "
                f"active_conn={active_connections}, "
                f"idle_conn={idle_connections}"
            )

            return {
                "db_tables_count": tables_count or 0,
                "db_size": db_size or 0,
                "indexes_size": indexes_size or 0,
                "active_connections": active_connections or 0,
                "idle_connections": idle_connections or 0,
            }

        except Exception as e:
            logger.error(f"❌ Error getting database stats: {e}")
            raise
        finally:
            if conn:
                await self.pool.release(conn)

    async def restore_database(self, filepath: str) -> bool:
        """Восстановить дамп базы данных из файла"""
        logger.info(f"💾 Starting database restore from {filepath}...")
        try:
            # We use pg_restore since backups are in custom format (-F c)
            # The -O flag skips restoring object ownership
            # The -x flag skips restoring privileges/ACLs
            # The --clean flag drops database objects prior to recreating them
            # The --clean flag drops database objects prior to recreating them
            process = await asyncio.create_subprocess_shell(
                f"pg_restore -h {self.host} -p {self.port} -U {self.user} -d {self.database} -O -x --clean {filepath}",
                env=dict(os.environ, PGPASSWORD=self.password),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            stdout, stderr = await process.communicate()
            
            # Note: pg_restore might emit non-fatal warnings to stderr even on success
            # We'll check returncode. A return code of 0 usually means full success,
            # but sometimes pg_restore exits with warnings (>0). For safety, we'll
            # log stderr but treat non-zero returncode as failure.
            
            if process.returncode != 0:
                logger.error(f"❌ pg_restore failed with return code {process.returncode}")
                # Log the last 500 chars of stdout/stderr to protect against huge output
                logger.error(f"Stdout: {stdout.decode()[:500]}")
                logger.error(f"Stderr: {stderr.decode()[:500]}")
                return False
                
            logger.info("✅ Database restored successfully")
            return True
        except Exception as e:
            logger.error(f"❌ Error during database restore: {e}")
            return False

    async def insert_analytics_stats(
        self,
        total_backups_size: int,
        backups_count: int,
        db_tables_count: int,
        indexes_size: int,
        active_connections: int,
        db_size: int = 0,
    ) -> Optional[int]:
        """
        Вставить новую запись в таблицу analytics_stats
        
        Args:
            total_backups_size: Общий размер всех бэкапов
            backups_count: Количество бэкапов
            db_tables_count: Количество таблиц
            indexes_size: Размер индексов
            active_connections: Активные подключения
            db_size: Размер БД
            
        Returns:
            ID вставленной записи или None при ошибке
        """
        conn = None
        try:
            conn = await self.get_connection()

            record_id = await conn.fetchval(
                """
                INSERT INTO analytics_stats (
                    total_backups_size,
                    backups_count,
                    db_tables_count,
                    indexes_size,
                    active_connections,
                    db_size
                ) VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id
                """,
                total_backups_size,
                backups_count,
                db_tables_count,
                indexes_size,
                active_connections,
                db_size,
            )

            logger.info(f"✅ Analytics record inserted with ID: {record_id}")
            return record_id

        except Exception as e:
            logger.error(f"❌ Error inserting analytics stats: {e}")
            raise
        finally:
            if conn:
                await self.pool.release(conn)

    async def log_backup_deletion(
        self,
        backup_key: str,
        deleted_size: int,
        reason: str = "Automated cleanup",
    ) -> Optional[int]:
        """
        Логировать удаление бэкапа
        
        Args:
            backup_key: Ключ (путь) файла бэкапа в S3
            deleted_size: Размер удаленного файла
            reason: Причина удаления
            
        Returns:
            ID вставленной записи
        """
        conn = None
        try:
            conn = await self.get_connection()

            record_id = await conn.fetchval(
                """
                INSERT INTO backup_deletion_logs (
                    backup_key,
                    deleted_size,
                    reason
                ) VALUES ($1, $2, $3)
                RETURNING id
                """,
                backup_key,
                deleted_size,
                reason,
            )

            logger.info(f"✅ Deletion log recorded with ID: {record_id}")
            return record_id

        except Exception as e:
            logger.error(f"❌ Error logging backup deletion: {e}")
            raise
        finally:
            if conn:
                await self.pool.release(conn)

    async def get_total_saved_space(self) -> int:
        """Получить сумму всех удаленных объемов"""
        conn = None
        try:
            conn = await self.get_connection()

            total = await conn.fetchval(
                """
                SELECT COALESCE(SUM(deleted_size), 0)
                FROM backup_deletion_logs
                """
            )

            logger.info(f"💾 Total saved space: {total} bytes")
            return total or 0

        except Exception as e:
            logger.error(f"❌ Error getting saved space: {e}")
            raise
        finally:
            if conn:
                await self.pool.release(conn)

    async def save_connection(
        self,
        name: str,
        db_type: str,
        host: str,
        port: int,
        username: str,
        encrypted_password: str,
        database_name: str | None = None
    ):
        conn = None
        try:
            conn = await self.get_connection()
            record_id = await conn.fetchval(
                """
                INSERT INTO connections (
                    name, db_type, host, port, username, encrypted_password, database_name, last_check_status, last_check_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                RETURNING id
                """,
                name, db_type, host, port, username, encrypted_password, database_name, True
            )
            return record_id
        except Exception as e:
            logger.error(f"Error saving connection: {e}")
            raise
        finally:
            if conn:
                await self.pool.release(conn)

    async def get_user_by_email(self, email: str):
        conn = None
        try:
            conn = await self.get_connection()
            user = await conn.fetchrow(
                "SELECT id, email, hashed_password, is_active FROM users WHERE email = $1",
                email
            )
            return dict(user) if user else None
        except Exception as e:
            logger.error(f"Error getting user: {e}")
            raise
        finally:
            if conn:
                await self.pool.release(conn)

    async def create_user(self, email: str, hashed_password: str):
        conn = None
        try:
            conn = await self.get_connection()
            user_id = await conn.fetchval(
                """
                INSERT INTO users (email, hashed_password) 
                VALUES ($1, $2) 
                RETURNING id
                """,
                email, hashed_password
            )
            return str(user_id)
        except Exception as e:
            logger.error(f"Error creating user: {e}")
            raise
        finally:
            if conn:
                await self.pool.release(conn)
