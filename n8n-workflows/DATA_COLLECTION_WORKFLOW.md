# N8N Workflow для сбора аналитических данных DB Control Center

## Обзор

Этот документ описывает workflow n8n для сбора аналитических данных о состоянии PostgreSQL и объеме бэкапов в S3/MinIO.

## Архитектура решения

```
┌─────────────────────┐
│   N8N Scheduler     │
│   (каждый час)      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  Parallel Execution                 │
│  ┌──────────────────────────────┐   │
│  │ 1. PostgreSQL Health Check   │   │
│  │    - Table count             │   │
│  │    - Active connections      │   │
│  │    - DB size                 │   │
│  │    - Index size              │   │
│  └──────────────────────────────┘   │
│  ┌──────────────────────────────┐   │
│  │ 2. S3/MinIO Backup Status    │   │
│  │    - List backup files       │   │
│  │    - Calculate total size    │   │
│  │    - Count backups           │   │
│  └──────────────────────────────┘   │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  Aggregate Data                     │
│  - Combine results from parallel    │
│  - Calculate metrics                │
│  - Format for database              │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  Insert Analytics Record            │
│  - POST /api/analytics/record       │
│  - Save to PostgreSQL               │
└─────────────────────────────────────┘
```

## Шаг 1: Конфигурация триггера (Scheduler)

### 1.1 Создание нового workflow

1. Откройте n8n и создайте новый workflow
2. Добавьте триггер **Schedule Trigger**
3. Конфигурация:
   - **Trigger type**: Every X minutes/hours
   - **minutes**: 60 (для запуска каждый час)
   - Или используйте **Cron expression**: `0 * * * *` (каждый час)

```json
{
  "node": "Schedule Trigger",
  "parameters": {
    "triggerTimes": {
      "item": [
        {
          "mode": "every",
          "value": 60,
          "unit": "minutes"
        }
      ]
    }
  }
}
```

## Шаг 2: Параллельное выполнение запросов

### 2.1 Параллельное выполнение (Merge Node)

Разделите workflow на два параллельных пути для независимого сбора данных.

## Шаг 3: Сбор данных PostgreSQL

### 3.1 Добавление узла PostgreSQL

1. Добавьте узел **Postgres**
2. Конфигурация подключения:
   ```
   Host: localhost (или адрес вашего сервера)
   Port: 5432
   Database: control_center
   User: postgres
   Password: [ваш пароль]
   SSL: true/false (в зависимости от конфигурации)
   ```

### 3.2 Query для получения статистики БД

```sql
SELECT 
    (SELECT COUNT(*) FROM information_schema.tables 
     WHERE table_schema NOT IN ('pg_catalog', 'information_schema')) as db_tables_count,
    (SELECT COALESCE(SUM(pg_relation_size(indexrelid)), 0) 
     FROM pg_indexes) as indexes_size,
    pg_database_size(current_database()) as db_size,
    (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections
```

### 3.3 Node конфигурация в n8n

```json
{
  "node": "Postgres",
  "type": "n8n-nodes-base.postgres",
  "parameters": {
    "connection": "PostgreSQL_Connection",
    "operation": "executeQuery",
    "query": "SELECT (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema')) as db_tables_count, (SELECT COALESCE(SUM(pg_relation_size(indexrelid)), 0) FROM pg_indexes) as indexes_size, pg_database_size(current_database()) as db_size, (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections"
  }
}
```

## Шаг 4: Сбор данных из S3/MinIO

### 4.1 Добавление узла для работы с S3

1. Добавьте узел **AWS S3** или **S3 Compatible (Minio)**
2. Конфигурация:
   - **Access Key ID**: [ваш access key]
   - **Secret Access Key**: [ваш secret key]
   - **Region**: [ваш регион или localhost для MinIO]
   - **Endpoint** (для MinIO): `http://localhost:9000`

### 4.2 Получение списка файлов бэкапов

```json
{
  "node": "S3",
  "type": "n8n-nodes-base.s3",
  "parameters": {
    "operation": "bucket:getAll",
    "bucketName": "backups",
    "limit": 1000,
    "returnAll": true
  }
}
```

### 4.3 Function Node для подсчета размера

Добавьте **Function** node для суммирования размеров:

```javascript
const files = $input.all();
let totalSize = 0;
let backupCount = 0;

// Фильтруем только файлы бэкапов
const backups = files
  .filter(file => file.json && file.json.Key.endsWith('.sql.gz'))
  .map(file => {
    totalSize += file.json.Size || 0;
    backupCount += 1;
    return file;
  });

return {
  json: {
    total_backups_size: totalSize,
    backups_count: backupCount,
    backups_list: backups
  }
};
```

## Шаг 5: Агрегирование данных

### 5.1 Function Node для объединения результатов

```javascript
// Получаем результаты из параллельных выполнений
const postgresData = $input.getNodeData('PostgreSQL', 0);
const s3Data = $input.getNodeData('S3_Function', 0);

const aggregated = {
  total_backups_size: s3Data.json.total_backups_size,
  backups_count: s3Data.json.backups_count,
  db_tables_count: postgresData.json[0].db_tables_count,
  indexes_size: postgresData.json[0].indexes_size,
  active_connections: postgresData.json[0].active_connections,
  db_size: postgresData.json[0].db_size,
  timestamp: new Date().toISOString()
};

return { json: aggregated };
```

## Шаг 6: Отправка данных в API

### 6.1 HTTP Request Node

1. Добавьте узел **HTTP Request**
2. Конфигурация:
   - **Method**: POST
   - **URL**: `http://localhost:3000/api/analytics/record`
   - **Headers**:
     ```json
     {
       "Content-Type": "application/json"
     }
     ```
   - **Body** (JSON):
     ```json
     {
       "total_backups_size": "={{ $node.Aggregate_Data.json.total_backups_size }}",
       "backups_count": "={{ $node.Aggregate_Data.json.backups_count }}",
       "db_tables_count": "={{ $node.Aggregate_Data.json.db_tables_count }}",
       "indexes_size": "={{ $node.Aggregate_Data.json.indexes_size }}",
       "active_connections": "={{ $node.Aggregate_Data.json.active_connections }}",
       "db_size": "={{ $node.Aggregate_Data.json.db_size }}"
     }
     ```

### 6.2 Node конфигурация

```json
{
  "node": "HTTP Request",
  "type": "n8n-nodes-base.httpRequest",
  "parameters": {
    "authentication": "none",
    "method": "POST",
    "url": "http://localhost:3000/api/analytics/record",
    "headers": {
      "Content-Type": "application/json"
    },
    "body": "payload",
    "bodyParameters": {
      "parameters": [
        {
          "name": "total_backups_size",
          "value": "={{ $node.Aggregate_Data.json.total_backups_size }}"
        },
        {
          "name": "backups_count",
          "value": "={{ $node.Aggregate_Data.json.backups_count }}"
        },
        {
          "name": "db_tables_count",
          "value": "={{ $node.Aggregate_Data.json.db_tables_count }}"
        },
        {
          "name": "indexes_size",
          "value": "={{ $node.Aggregate_Data.json.indexes_size }}"
        },
        {
          "name": "active_connections",
          "value": "={{ $node.Aggregate_Data.json.active_connections }}"
        },
        {
          "name": "db_size",
          "value": "={{ $node.Aggregate_Data.json.db_size }}"
        }
      ]
    }
  }
}
```

## Шаг 7: Обработка ошибок

### 7.1 Error Handling через Catch Node

Добавьте **Catch** node для обработки ошибок:

```javascript
// Error handler
const error = $input.getNodeData('error');
console.error('Error in analytics workflow:', error);

// Отправляем уведомление об ошибке
return {
  json: {
    error: true,
    message: error.toString(),
    timestamp: new Date().toISOString()
  }
};
```

## Полная конфигурация Workflow в JSON

```json
{
  "nodes": [
    {
      "parameters": {
        "triggerTimes": {
          "item": [
            {
              "mode": "every",
              "value": 60,
              "unit": "minutes"
            }
          ]
        }
      },
      "name": "Schedule Trigger",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1,
      "position": [250, 300]
    },
    {
      "parameters": {
        "connection": "PostgreSQL",
        "operation": "executeQuery",
        "query": "SELECT (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema')) as db_tables_count, (SELECT COALESCE(SUM(pg_relation_size(indexrelid)), 0) FROM pg_indexes) as indexes_size, pg_database_size(current_database()) as db_size, (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections"
      },
      "name": "PostgreSQL Health",
      "type": "n8n-nodes-base.postgres",
      "typeVersion": 1,
      "position": [450, 200]
    },
    {
      "parameters": {
        "authentication": "serviceAccount",
        "bucketName": "backups",
        "operation": "bucket:getAll",
        "returnAll": true
      },
      "name": "S3 List Files",
      "type": "n8n-nodes-base.s3",
      "typeVersion": 2,
      "position": [450, 400]
    },
    {
      "parameters": {
        "functionCode": "const files = $input.all();\nlet totalSize = 0;\nlet backupCount = 0;\n\nconst backups = files\n  .filter(file => file.json && file.json.Key.endsWith('.sql.gz'))\n  .map(file => {\n    totalSize += file.json.Size || 0;\n    backupCount += 1;\n    return file;\n  });\n\nreturn {\n  json: {\n    total_backups_size: totalSize,\n    backups_count: backupCount\n  }\n};"
      },
      "name": "Calculate Backup Size",
      "type": "n8n-nodes-base.function",
      "typeVersion": 1,
      "position": [650, 400]
    },
    {
      "parameters": {
        "functionCode": "const postgresData = $input.getNodeData('PostgreSQL Health');\nconst s3Data = $input.getNodeData('Calculate Backup Size');\n\nconst aggregated = {\n  total_backups_size: s3Data.json.total_backups_size,\n  backups_count: s3Data.json.backups_count,\n  db_tables_count: postgresData.json[0].db_tables_count,\n  indexes_size: postgresData.json[0].indexes_size,\n  active_connections: postgresData.json[0].active_connections,\n  db_size: postgresData.json[0].db_size\n};\n\nreturn { json: aggregated };"
      },
      "name": "Aggregate Data",
      "type": "n8n-nodes-base.function",
      "typeVersion": 1,
      "position": [850, 300]
    },
    {
      "parameters": {
        "authentication": "none",
        "method": "POST",
        "url": "http://localhost:3000/api/analytics/record",
        "sendBody": true,
        "bodyParameters": {
          "parameters": [
            {
              "name": "total_backups_size",
              "value": "={{ $node.Aggregate_Data.json.total_backups_size }}"
            },
            {
              "name": "backups_count",
              "value": "={{ $node.Aggregate_Data.json.backups_count }}"
            },
            {
              "name": "db_tables_count",
              "value": "={{ $node.Aggregate_Data.json.db_tables_count }}"
            },
            {
              "name": "indexes_size",
              "value": "={{ $node.Aggregate_Data.json.indexes_size }}"
            },
            {
              "name": "active_connections",
              "value": "={{ $node.Aggregate_Data.json.active_connections }}"
            },
            {
              "name": "db_size",
              "value": "={{ $node.Aggregate_Data.json.db_size }}"
            }
          ]
        }
      },
      "name": "Save to API",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 3,
      "position": [1050, 300]
    }
  ],
  "connections": {
    "Schedule Trigger": {
      "main": [
        [
          {
            "node": "PostgreSQL Health",
            "type": "main",
            "index": 0
          },
          {
            "node": "S3 List Files",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "PostgreSQL Health": {
      "main": [
        [
          {
            "node": "Aggregate Data",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "S3 List Files": {
      "main": [
        [
          {
            "node": "Calculate Backup Size",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Calculate Backup Size": {
      "main": [
        [
          {
            "node": "Aggregate Data",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Aggregate Data": {
      "main": [
        [
          {
            "node": "Save to API",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
}
```

## Развертывание и тестирование

### 1. Импорт workflow в n8n

```bash
# Скопируйте JSON выше и импортируйте через UI n8n
# Или используйте API
curl -X POST http://localhost:5678/api/v1/workflows \
  -H "Content-Type: application/json" \
  -d @workflow.json
```

### 2. Проверка подключений

- Протестируйте подключение PostgreSQL
- Протестируйте подключение S3/MinIO
- Убедитесь, что API доступен

### 3. Ручное тестирование

Запустите workflow вручную, чтобы проверить:
- Сбор данных из БД ✓
- Получение списка файлов из S3 ✓
- Отправка данных в API ✓
- Сохранение в PostgreSQL ✓

### 4. Мониторинг

Настройте уведомления об ошибках через:
- Email
- Slack
- Webhook

## Возможные проблемы и решения

### Проблема: Хост не доступен
**Решение**: Убедитесь, что в docker-compose или сетевой конфигурации корректно указаны хосты и порты.

### Проблема: Данные не записываются
**Решение**: Проверьте логи n8n и API, убедитесь что SQL таблица создана.

### Проблема: Slow запросы к БД
**Решение**: Добавьте индексы на `timestamp` и `created_at` в таблице `analytics_stats`.

## Оптимизация

### 1. Увеличение производительности

```sql
-- Добавьте партионирование для больших объемов
CREATE TABLE analytics_stats_2024_01 PARTITION OF analytics_stats
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

### 2. Горячие данные в памяти

```sql
-- Кэширование последних 24 часов
CREATE MATERIALIZED VIEW analytics_stats_24h AS
SELECT * FROM analytics_stats
WHERE timestamp > NOW() - INTERVAL '24 hours';
```

## Масштабирование

Для теоретически неограниченного масштабирования:

1. **Распределенное хранилище**: TimescaleDB для временных рядов
2. **Кэширование**: Redis для часто используемых метрик
3. **Асинхронная обработка**: Очереди сообщений (RabbitMQ, Kafka)
