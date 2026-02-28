import { NextResponse } from 'next/server';
import path from 'path';
import { readFile, stat } from 'fs/promises';

const DOWNLOADS_DIR = process.env.PUBLIC_DOWNLOADS_DIR || '/home/cnstexultant/hardwave-uploads/public-downloads';
const MANIFEST_FILENAME = 'hardwave-suite-latest.json';

export async function GET() {
  const filePath = path.join(DOWNLOADS_DIR, MANIFEST_FILENAME);

  try {
    await stat(filePath);
  } catch {
    return NextResponse.json(
      { error: 'Update manifest not found' },
      { status: 404 }
    );
  }

  const jsonText = await readFile(filePath, 'utf8');

  return new NextResponse(jsonText, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Avoid stale manifests. Installers themselves can be cached aggressively.
      'Cache-Control': 'no-cache',
    },
  });
}
