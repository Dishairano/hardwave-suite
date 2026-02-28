/**
 * Web Share API utilities
 */

export interface ShareData {
  title: string;
  text?: string;
  url?: string;
  files?: File[];
}

/**
 * Check if Web Share API is supported
 */
export function canShare(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.share;
}

/**
 * Check if file sharing is supported
 */
export function canShareFiles(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.canShare;
}

/**
 * Share content using Web Share API
 */
export async function share(data: ShareData): Promise<boolean> {
  if (!canShare()) {
    // Fallback: copy to clipboard
    const text = data.url || data.text || data.title;
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  try {
    await navigator.share({
      title: data.title,
      text: data.text,
      url: data.url,
    });
    return true;
  } catch (err: any) {
    // User cancelled or error
    if (err.name === 'AbortError') {
      return false;
    }
    console.error('Share failed:', err);
    return false;
  }
}

/**
 * Share a sample file
 */
export async function shareSample(
  filename: string,
  fileId: string,
  metadata?: { bpm?: number; key?: string }
): Promise<boolean> {
  const title = `Check out this sample: ${filename}`;
  let text = filename;

  if (metadata?.bpm) {
    text += ` | ${metadata.bpm} BPM`;
  }
  if (metadata?.key) {
    text += ` | ${metadata.key}`;
  }

  // Generate shareable URL
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const url = `${baseUrl}/app/sample/${fileId}`;

  return share({ title, text, url });
}

/**
 * Share multiple samples
 */
export async function shareMultipleSamples(
  samples: Array<{ filename: string; id: string }>
): Promise<boolean> {
  const count = samples.length;
  const title = `${count} sample${count !== 1 ? 's' : ''} from Hardwave`;
  const text = samples.map((s) => s.filename).join(', ');
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const url = `${baseUrl}/app`;

  return share({ title, text, url });
}

/**
 * Copy text to clipboard with fallback
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    return true;
  } catch (err) {
    console.error('Copy failed:', err);
    return false;
  }
}
