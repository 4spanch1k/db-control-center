import { NextRequest, NextResponse } from 'next/server';
import { buildBackendHeaders } from '@/lib/backend-proxy';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filename } = body;

    if (!filename) {
      return NextResponse.json(
        { success: false, error: 'Имя файла не указано' },
        { status: 400 }
      );
    }

    const pythonBackendUrl = process.env.PYTHON_BACKEND_URL || 'http://python_backend:8000';

    const response = await fetch(`${pythonBackendUrl}/api/backup/restore`, {
      method: 'POST',
      headers: buildBackendHeaders(request),
      body: JSON.stringify({ filename }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Ошибка запуска восстановления в Python Backend: ${errorData}`);
    }

    const data = await response.json();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Ошибка API восстановления:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
