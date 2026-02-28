import { NextRequest, NextResponse } from 'next/server';
import { buildBackendHeaders } from '@/lib/backend-proxy';

export async function POST(request: NextRequest) {
  try {
    const pythonBackendUrl = process.env.PYTHON_BACKEND_URL || 'http://python_backend:8000';

    const response = await fetch(`${pythonBackendUrl}/api/trigger-cleanup`, {
      method: 'POST',
      headers: buildBackendHeaders(request),
    });

    const payload = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          message: payload?.detail || 'Ошибка при запуске очистки',
        },
        { status: response.status }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: payload?.message || '✅ Очистка запущена! Отчёт придёт в Telegram',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Не удалось связаться с backend',
      },
      { status: 500 }
    );
  }
}
