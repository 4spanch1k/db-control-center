import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { filename } = await req.json();
    if (!filename) throw new Error('Имя файла обязательно');

    const response = await fetch('http://localhost:5678/webhook/restore-backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename })
    });

    if (!response.ok) throw new Error('Ошибка n8n');
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
