# Demo Script (3-5 минут)

Цель: за короткий показ пройти полный цикл `connect -> backup -> verify -> restore safety -> cleanup -> audit`.

## 1. Что подготовить заранее (1 раз)

1. Поднять сервисы:
```bash
make demo
```
2. Создать/обновить админ-учетку для входа:
```bash
make seed-admin ADMIN_PASSWORD="StrongPass123!"
```
3. Данные для логина в UI:
- Email: `admin@example.com`
- Password: `StrongPass123!`
4. Тестовая БД для подключения в Settings (из `docker-compose.yml`):
- Host: `target-postgres`
- Port: `5432`
- Database: `target_db`
- User: `test_user`
- Password: `test_password`

## 2. Сценарий кликов (основной, ~4 минуты)

1. Открыть `http://localhost:3000`, войти под `admin@example.com`.
2. Перейти в `Настройки`:
- заполнить поля подключения (значения выше),
- нажать `Проверить и сохранить`,
- дождаться success toast.
3. Перейти в `Обзор (Dashboard)`:
- в пустом состоянии нажать `Запустить демо` (подсветятся нужные CTA),
- проверить подсказку: `Подключите БД -> настройте бэкапы -> сделайте первый бэкап`.
4. В блоке `Профили бэкапов`:
- оставить default `Full` профиль или создать `+ Новый профиль` (custom/partial),
- выбрать профиль кнопкой `Выбрать`.
5. В блоке `Управление базой данных`:
- нажать `Сделать бэкап`,
- в истории увидеть новую запись + бейдж `Full/Partial`.
6. Для свежего backup нажать `Verify`:
- показать статус в истории (`Verified` / `Verify Partial`).
7. Нажать `Восстановить`:
- показать modal безопасности (для partial по умолчанию target = new database и предупреждения).
8. Нажать `Очистить бэкапы`:
- подтвердить действие,
- показать блок `Retention Cleanup` (last run / deleted / errors).
9. Открыть `http://localhost:3000/audit`:
- показать события `backup.verify`, `backup.cleanup`, restore/backup действия.

## 3. Что озвучить во время демо

1. Безопасность restore: partial backup не маскируется под full и требует дополнительные подтверждения.
2. Verify проверяет артефакт до восстановления.
3. Retention cleanup автоматизирует удаление и оставляет audit trail.

## 4. Критерий успешного демо

- Новый человек может пройти шаги без помощи и получить:
  - хотя бы 1 backup в истории,
  - видимый verify result,
  - запись cleanup в audit/jobs.
