"""
Telegram Alerts
Отправка уведомлений об операциях в Telegram
"""

import logging
from typing import Optional
from enum import Enum

import httpx

logger = logging.getLogger(__name__)


class AlertType(str, Enum):
    """Типы оповещений"""

    SUCCESS = "success"
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


class TelegramAlerter:
    """Отправка оповещений в Telegram"""

    def __init__(self, bot_token: str, chat_id: str):
        self.bot_token = bot_token
        self.chat_id = chat_id
        self.base_url = f"https://api.telegram.org/bot{bot_token}"
        self.enabled = bool(bot_token and chat_id)

        if self.enabled:
            logger.info(f"✅ Telegram alerts enabled for chat {chat_id}")
        else:
            logger.info("⚠️  Telegram alerts disabled (missing credentials)")

    async def send_message(self, message: str, parse_mode: str = "HTML") -> bool:
        """
        Отправить сообщение в Telegram
        
        Args:
            message: Текст сообщения
            parse_mode: Режим разбора (HTML, Markdown, MarkdownV2)
            
        Returns:
            True если успешно, False если ошибка
        """
        if not self.enabled:
            logger.debug(f"Telegram disabled, skipping message: {message}")
            return False

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/sendMessage",
                    json={
                        "chat_id": self.chat_id,
                        "text": message,
                        "parse_mode": parse_mode,
                    },
                    timeout=10.0,
                )

                if response.status_code == 200:
                    logger.info("✅ Telegram message sent successfully")
                    return True
                else:
                    logger.error(f"❌ Telegram API error: {response.text}")
                    return False

        except httpx.TimeoutException:
            logger.error("❌ Telegram API timeout")
            return False
        except Exception as e:
            logger.error(f"❌ Error sending Telegram message: {e}")
            return False

    async def send_cleanup_report(
        self,
        alert_type: AlertType,
        deleted_count: int,
        total_size: int,
        error_count: int = 0,
        details: Optional[str] = None,
    ) -> bool:
        """
        Отправить отчет об очистке бэкапов
        
        Args:
            alert_type: Тип оповещения (success, error, warning)
            deleted_count: Количество удаленных файлов
            total_size: Суммарный размер удаленных файлов
            error_count: Количество ошибок
            details: Дополнительные детали
            
        Returns:
            True если успешно отправлено
        """
        emoji_map = {
            AlertType.SUCCESS: "✅",
            AlertType.ERROR: "❌",
            AlertType.WARNING: "⚠️",
            AlertType.INFO: "ℹ️",
        }

        emoji = emoji_map.get(alert_type, "📋")

        size_mb = total_size / (1024 * 1024)
        size_gb = size_mb / 1024

        size_str = f"{size_gb:.2f} GB" if size_gb >= 1 else f"{size_mb:.2f} MB"

        message = f"""
{emoji} <b>Backup Cleanup Report</b>

<b>Status:</b> {alert_type.value.upper()}
<b>Deleted Files:</b> {deleted_count}
<b>Total Size Freed:</b> {size_str}
<b>Errors:</b> {error_count}
"""

        if details:
            message += f"\n<b>Details:</b>\n<code>{details}</code>"

        return await self.send_message(message)

    async def send_analytics_report(
        self,
        tables_count: int,
        db_size: int,
        backups_count: int,
        backups_size: int,
        active_connections: int,
    ) -> bool:
        """
        Отправить отчет об аналитике БД
        
        Args:
            tables_count: Количество таблиц
            db_size: Размер БД
            backups_count: Количество бэкапов
            backups_size: Размер бэкапов
            active_connections: Активные подключения
            
        Returns:
            True если успешно отправлено
        """
        db_size_gb = db_size / (1024 * 1024 * 1024)
        backups_size_gb = backups_size / (1024 * 1024 * 1024)

        message = f"""
📊 <b>Database Analytics Report</b>

<b>Database:</b>
• Tables: {tables_count}
• Size: {db_size_gb:.2f} GB
• Active Connections: {active_connections}

<b>Backups:</b>
• Count: {backups_count}
• Total Size: {backups_size_gb:.2f} GB
"""

        return await self.send_message(message)

    async def send_error_alert(
        self,
        operation: str,
        error_message: str,
    ) -> bool:
        """
        Отправить оповещение об ошибке
        
        Args:
            operation: Название операции
            error_message: Сообщение об ошибке
            
        Returns:
            True если успешно отправлено
        """
        message = f"""
❌ <b>Error in {operation}</b>

<code>{error_message}</code>

Please check the logs for more details.
"""

        return await self.send_message(message)
