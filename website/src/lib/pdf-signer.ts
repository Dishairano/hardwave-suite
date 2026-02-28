import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

interface SignaturePosition {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DatePosition {
  page: number;
  x: number;
  y: number;
}

/**
 * Embeds a signature image and date/time text into a PDF at the specified positions.
 * Coordinates use PDF coordinate system (origin at bottom-left).
 * The position picker on the frontend uses top-left origin, so y is flipped here.
 *
 * @param pdfPath - Absolute path to the PDF file on disk
 * @param signatureBase64 - Base64 PNG data URL (data:image/png;base64,...)
 * @param dateString - Date/time string to render
 * @param sigPos - Where to place the signature image
 * @param datePos - Where to place the date text
 */
export async function embedSignatureInPdf(
  pdfPath: string,
  signatureBase64: string,
  dateString: string,
  sigPos: SignaturePosition | undefined,
  datePos: DatePosition | undefined,
): Promise<void> {
  if (!sigPos && !datePos) return;

  const pdfBytes = await readFile(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();

  // Embed signature image
  if (sigPos) {
    const pageIndex = Math.min(sigPos.page, pages.length - 1);
    const page = pages[pageIndex];
    const { height: pageHeight } = page.getSize();

    // Strip the data URL prefix to get raw base64
    const base64Data = signatureBase64.replace(/^data:image\/png;base64,/, '');
    const pngBytes = Buffer.from(base64Data, 'base64');
    const pngImage = await pdfDoc.embedPng(pngBytes);

    // The frontend picker uses top-left origin; PDF uses bottom-left.
    // Convert: pdfY = pageHeight - pickerY - imageHeight
    const pdfY = pageHeight - sigPos.y - sigPos.height;

    page.drawImage(pngImage, {
      x: sigPos.x,
      y: pdfY,
      width: sigPos.width,
      height: sigPos.height,
    });
  }

  // Embed date text
  if (datePos) {
    const pageIndex = Math.min(datePos.page, pages.length - 1);
    const page = pages[pageIndex];
    const { height: pageHeight } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const pdfY = pageHeight - datePos.y - 10; // 10 ≈ font size offset

    page.drawText(dateString, {
      x: datePos.x,
      y: pdfY,
      size: 10,
      font,
      color: rgb(0, 0, 0),
    });
  }

  const modifiedBytes = await pdfDoc.save();
  await writeFile(pdfPath, Buffer.from(modifiedBytes));
}

/**
 * Resolves the absolute file path from a document_url like "/uploads/contracts/file.pdf"
 */
export function resolveContractPdfPath(documentUrl: string): string {
  // documentUrl is like "/uploads/contracts/contract-123-xxx.pdf"
  return join(process.cwd(), 'public', documentUrl);
}
