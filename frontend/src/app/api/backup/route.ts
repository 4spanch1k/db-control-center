import { NextRequest, NextResponse } from 'next/server';
import { buildBackendHeaders } from '@/lib/backend-proxy';

export async function POST(request: NextRequest) {
  try {
    const pythonBackendUrl = process.env.PYTHON_BACKEND_URL || 'http://python_backend:8000';
    const response = await fetch(`${pythonBackendUrl}/api/backup/create`, {
      method: 'POST',
      headers: buildBackendHeaders(request),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Ошибка запуска бэкапа в Python Backend: ${errorData}`);
    }

    const data = await response.json();

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Ошибка API:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
