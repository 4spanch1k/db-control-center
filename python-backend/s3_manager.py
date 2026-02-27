"""
S3/MinIO Manager
Управление бэкапами в S3-совместимом хранилище
"""

import logging
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple

import boto3
from botocore.exceptions import ClientError, BotoCoreError

logger = logging.getLogger(__name__)


class S3Manager:
    """Менеджер для работы с MinIO/S3"""

    def __init__(
        self,
        endpoint_url: str,
        access_key: str,
        secret_key: str,
        bucket_name: str,
        use_ssl: bool = False,
    ):
        self.endpoint_url = endpoint_url
        self.access_key = access_key
        self.secret_key = secret_key
        self.bucket_name = bucket_name
        self.use_ssl = use_ssl

        # Инициализируем клиент
        self.client = boto3.client(
            "s3",
            endpoint_url=f"{'https' if use_ssl else 'http'}://{endpoint_url}"
            if "://" not in endpoint_url
            else endpoint_url,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            verify=use_ssl,
        )

        try:
            self.client.head_bucket(Bucket=bucket_name)
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code")
            if error_code == "404":
                self.client.create_bucket(Bucket=bucket_name)
                logger.info(f"Бакет {bucket_name} успешно создан.")
            else:
                logger.error(f"Error checking bucket {bucket_name}: {e}")

        logger.info(
            f"✅ Подключился к MinIO: {endpoint_url}/{bucket_name} (SSL: {use_ssl})"
        )

    async def get_bucket_contents(self) -> List[Dict]:
        """Получить список всех объектов в бакете"""
        try:
            response = self.client.list_objects_v2(Bucket=self.bucket_name)
            contents = response.get("Contents", [])
            logger.info(f"📦 нашел файлы: {len(contents)} шт")
            return contents
        except ClientError as e:
            logger.error(f"❌ Error listing bucket contents: {e}")
            return []
        except Exception as e:
            logger.error(f"❌ Unexpected error listing bucket: {e}")
            return []

    async def get_old_backups(self, days: int = 7) -> List[Dict]:
        """
        Получить список бэкапов старше указанного количества дней
        
        Args:
            days: Количество дней (бэкапы старше этого срока будут в списке)
            
        Returns:
            Список объектов для удаления
        """
        try:
            contents = await self.get_bucket_contents()
            cutoff_date = datetime.utcnow() - timedelta(days=days)

            old_backups = [
                obj
                for obj in contents
                if obj.get("LastModified").replace(tzinfo=None) < cutoff_date
            ]

            logger.info(
                f"🗑️  применил фильтр >{days} дней: найдено {len(old_backups)} бэкапов"
            )
            return old_backups

        except Exception as e:
            logger.error(f"❌ Error getting old backups: {e}")
            return []

    async def delete_file(self, key: str) -> bool:
        """Удалить файл из бакета"""
        try:
            self.client.delete_object(Bucket=self.bucket_name, Key=key)
            logger.info(f"✅ Deleted: {key}")
            return True
        except ClientError as e:
            logger.error(f"❌ Error deleting {key}: {e}")
            return False
        except Exception as e:
            logger.error(f"❌ Unexpected error deleting {key}: {e}")
            return False

    async def upload_file(self, file_path: str, key: str) -> bool:
        """Загрузить файл в бакет MinIO"""
        try:
            self.client.upload_file(file_path, self.bucket_name, key)
            logger.info(f"✅ Uploaded {file_path} to {key}")
            return True
        except ClientError as e:
            logger.error(f"❌ Error uploading {file_path} to {key}: {e}")
            return False
        except Exception as e:
            logger.error(f"❌ Unexpected error uploading {file_path}: {e}")
            return False

    async def download_file(self, key: str, file_path: str) -> bool:
        """Скачать файл из бакета MinIO"""
        try:
            self.client.download_file(self.bucket_name, key, file_path)
            logger.info(f"✅ Downloaded {key} to {file_path}")
            return True
        except ClientError as e:
            logger.error(f"❌ Error downloading {key} to {file_path}: {e}")
            return False
        except Exception as e:
            logger.error(f"❌ Unexpected error downloading {key}: {e}")
            return False

    async def cleanup_old_backups(
        self, days: int = 7
    ) -> Tuple[int, int, int]:
        """
        Удалить все бэкапы старше указанного количества дней
        
        Args:
            days: Количество дней для хранения бэкапов
            
        Returns:
            Кортеж (удалено_файлов, ошибок, суммарный_размер)
        """
        try:
            old_backups = await self.get_old_backups(days)

            deleted_count = 0
            error_count = 0
            total_size = 0

            for backup in old_backups:
                key = backup.get("Key", "")
                size = backup.get("Size", 0)

                success = await self.delete_file(key)
                if success:
                    deleted_count += 1
                    total_size += size
                else:
                    error_count += 1

            logger.info(
                f"✅ Cleanup completed: deleted={deleted_count}, "
                f"errors={error_count}, total_size={total_size} bytes"
            )

            return deleted_count, error_count, total_size

        except Exception as e:
            logger.error(f"❌ Error during cleanup: {e}")
            return 0, 1, 0

    async def get_total_backups_size(self) -> Tuple[int, int]:
        """
        Получить общий размер всех бэкапов и количество
        
        Returns:
            Кортеж (общий_размер, количество_файлов)
        """
        try:
            contents = await self.get_bucket_contents()

            if not contents:
                return 0, 0

            total_size = sum(obj.get("Size", 0) for obj in contents)
            count = len(contents)

            logger.info(f"💾 Total backups size: {total_size} bytes ({count} files)")
            return total_size, count

        except Exception as e:
            logger.error(f"❌ Error getting total backups size: {e}")
            return 0, 0

    async def health_check(self) -> bool:
        """Проверить здоровье подключения к S3"""
        try:
            self.client.head_bucket(Bucket=self.bucket_name)
            logger.info("✅ S3 health check passed")
            return True
        except ClientError as e:
            if e.response["Error"]["Code"] == "404":
                logger.error(f"❌ Bucket does not exist: {self.bucket_name}")
            else:
                logger.error(f"❌ S3 health check failed: {e}")
            return False
        except Exception as e:
            logger.error(f"❌ Unexpected error in S3 health check: {e}")
            return False
