/**
 * Contract File Storage Utilities
 */

import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { randomBytes } from 'crypto';

// Storage directory for contract documents
const CONTRACTS_DIR = join(process.cwd(), 'public', 'uploads', 'contracts');

/**
 * Ensures the contracts storage directory exists
 */
export async function ensureContractsDir(): Promise<void> {
  try {
    await mkdir(CONTRACTS_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating contracts directory:', error);
    throw new Error('Failed to initialize contracts storage');
  }
}

/**
 * Generates a secure filename for a contract document
 * @param contractId - The contract ID
 * @param originalFilename - Original file name with extension
 * @returns Secure filename
 */
export function generateSecureFilename(contractId: number, originalFilename: string): string {
  const timestamp = Date.now();
  const random = randomBytes(8).toString('hex');
  const extension = originalFilename.split('.').pop() || 'pdf';
  return `contract-${contractId}-${timestamp}-${random}.${extension}`;
}

/**
 * Generates a filename for a signed/completed contract
 * @param contractId - The contract ID
 * @param originalExtension - File extension
 * @returns Filename for signed document
 */
export function generateSignedFilename(contractId: number, originalExtension: string = 'pdf'): string {
  return `contract-${contractId}-signed.${originalExtension}`;
}

/**
 * Saves a file buffer to the contracts directory
 * @param buffer - File data as Buffer
 * @param filename - Target filename
 * @returns Public URL path to the file
 */
export async function saveContractFile(buffer: Buffer, filename: string): Promise<string> {
  await ensureContractsDir();
  const filePath = join(CONTRACTS_DIR, filename);
  await writeFile(filePath, buffer);
  return `/uploads/contracts/${filename}`;
}

/**
 * Generates a secure signing token
 * @returns Random secure token
 */
export function generateSigningToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Gets the expiration date for a signing token (30 days from now)
 * @returns ISO date string
 */
export function getTokenExpirationDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  // Return MySQL datetime format: YYYY-MM-DD HH:MM:SS
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Validates if a token is expired
 * @param expiresAt - ISO date string of expiration
 * @returns true if expired
 */
export function isTokenExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return true;
  return new Date(expiresAt) < new Date();
}

/**
 * Extracts client IP address from request
 * @param request - Next.js request object
 * @returns IP address string
 */
export function getClientIp(request: Request): string {
  const headers = new Headers(request.headers);
  return (
    headers.get('x-forwarded-for')?.split(',')[0] ||
    headers.get('x-real-ip') ||
    'unknown'
  );
}

/**
 * Extracts user agent from request
 * @param request - Next.js request object
 * @returns User agent string
 */
export function getUserAgent(request: Request): string {
  return request.headers.get('user-agent') || 'unknown';
}
