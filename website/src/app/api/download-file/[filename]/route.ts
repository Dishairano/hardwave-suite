import { NextRequest, NextResponse } from 'next/server';
import { stat } from 'fs/promises';
import { createReadStream } from 'fs';
import path from 'path';
import { Readable } from 'node:stream';

const DOWNLOADS_DIR = process.env.PUBLIC_DOWNLOADS_DIR || '/home/cnstexultant/hardwave-uploads/public-downloads';

const ALLOWED_SUFFIXES = [
  '.zip',
  '.exe',
  '.msi',
  '.dmg',
  '.appimage',
  '.deb',
  '.tar.gz',
  '.sig',
  '.json',
  '.docx',
] as const;

function pickAllowedSuffix(nameLower: string): (typeof ALLOWED_SUFFIXES)[number] | null {
  for (const suffix of ALLOWED_SUFFIXES) {
    if (nameLower.endsWith(suffix)) return suffix;
  }
  return null;
}

function contentTypeForSuffix(suffix: string): string {
  switch (suffix) {
    case '.json':
      return 'application/json; charset=utf-8';
    case '.zip':
      return 'application/zip';
    case '.msi':
      return 'application/x-msi';
    case '.dmg':
      return 'application/x-apple-diskimage';
    case '.deb':
      return 'application/vnd.debian.binary-package';
    case '.sig':
      return 'text/plain; charset=utf-8';
    case '.docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    default:
      return 'application/octet-stream';
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;

    // Validate filename:
    // - no subpaths
    // - safe characters only (allow spaces for legacy downloads)
    // - known file suffixes only
    if (filename !== path.basename(filename)) {
      return NextResponse.json(
        { error: 'Invalid filename' },
        { status: 400 }
      );
    }
    if (!/^[a-zA-Z0-9._() -]+$/.test(filename)) {
      return NextResponse.json(
        { error: 'Invalid filename' },
        { status: 400 }
      );
    }
    const suffix = pickAllowedSuffix(filename.toLowerCase());
    if (!suffix) {
      return NextResponse.json(
        { error: 'Invalid filename' },
        { status: 400 }
      );
    }

    const filePath = path.join(DOWNLOADS_DIR, filename);

    // Check if file exists
    let fileStats: { size: number };
    try {
      fileStats = await stat(filePath);
    } catch {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    const contentType = contentTypeForSuffix(suffix);
    const isJson = suffix === '.json';
    const cacheControl = isJson ? 'no-cache' : 'public, max-age=31536000, immutable';
    const dispositionType = isJson ? 'inline' : 'attachment';

    const range = request.headers.get('range');
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/i.exec(range);
      if (!match) {
        return new NextResponse(null, {
          status: 416,
          headers: {
            'Content-Range': `bytes */${fileStats.size}`,
          },
        });
      }

      const startRaw = match[1];
      const endRaw = match[2];
      const start = startRaw ? Number.parseInt(startRaw, 10) : 0;
      const end = endRaw ? Number.parseInt(endRaw, 10) : fileStats.size - 1;

      if (
        Number.isNaN(start) ||
        Number.isNaN(end) ||
        start < 0 ||
        end < 0 ||
        start > end ||
        start >= fileStats.size
      ) {
        return new NextResponse(null, {
          status: 416,
          headers: {
            'Content-Range': `bytes */${fileStats.size}`,
          },
        });
      }

      const clampedEnd = Math.min(end, fileStats.size - 1);
      const stream = createReadStream(filePath, { start, end: clampedEnd });
      const webStream = Readable.toWeb(stream) as unknown as ReadableStream;

      return new NextResponse(webStream, {
        status: 206,
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `${dispositionType}; filename="${filename}"`,
          'Content-Range': `bytes ${start}-${clampedEnd}/${fileStats.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': (clampedEnd - start + 1).toString(),
          'Cache-Control': cacheControl,
        },
      });
    }

    const stream = createReadStream(filePath);
    const webStream = Readable.toWeb(stream) as unknown as ReadableStream;

    return new NextResponse(webStream, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `${dispositionType}; filename="${filename}"`,
        'Accept-Ranges': 'bytes',
        'Content-Length': fileStats.size.toString(),
        'Cache-Control': cacheControl,
      },
    });
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json(
      { error: 'Download failed' },
      { status: 500 }
    );
  }
}
