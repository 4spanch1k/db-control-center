FROM n8nio/n8n:2.0.0

# Переключаемся на root для установки пакетов
USER root

# В стабильной версии 2.0.0 утилита apk работает отлично
RUN apk update && apk add --no-cache postgresql-client curl bash

# Скачиваем и устанавливаем MinIO Client (mc) для архитектуры ARM64
RUN curl -O https://dl.min.io/client/mc/release/linux-arm64/mc && \
    chmod +x mc && \
    mv mc /usr/local/bin/mc

# Возвращаемся к пользователю node
USER node