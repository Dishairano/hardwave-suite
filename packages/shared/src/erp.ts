/**
 * ERP Utilities Library
 * Provides permission management, audit logging, and ERP-specific helpers
 */

import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { query, queryOne } from './db';

// =============================================
// Types
// =============================================

export type ERPModule = 'finance' | 'projects' | 'hr' | 'crm' | 'inventory' | 'invoicing' | 'settings';

export type ERPPermission = 'read' | 'write' | 'delete' | 'approve';

export interface ERPRole {
  id: number;
  name: string;
  description: string;
  permissions: Record<ERPModule, ERPPermission[]>;
  is_system: boolean;
}

export interface ERPUserRole {
  id: number;
  user_id: number;
  role_id: number;
  role_name: string;
  module?: string;
  permissions: Record<ERPModule, ERPPermission[]>;
  granted_by: number;
  granted_at: Date;
  expires_at?: Date;
  is_active: boolean;
}

export interface ERPAuthContext {
  userId: number;
  email: string;
  isAdmin: boolean;
  erpRoles: ERPUserRole[];
  permissions: Record<ERPModule, ERPPermission[]>;
  hasERPAccess: boolean;
}

export interface AuditLogEntry {
  user_id: number;
  module: ERPModule;
  action: string;
  entity_type: string;
  entity_id?: number;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
}

// =============================================
// Permission Management
// =============================================

/**
 * Get all ERP roles for a user
 */
export async function getUserERPRoles(userId: number): Promise<ERPUserRole[]> {
  const roles = await query<any[]>(`
    SELECT
      ur.id,
      ur.user_id,
      ur.role_id,
      r.name as role_name,
      ur.module,
      r.permissions,
      ur.granted_by,
      ur.granted_at,
      ur.expires_at,
      ur.is_active
    FROM erp_user_roles ur
    JOIN erp_roles r ON ur.role_id = r.id
    WHERE ur.user_id = ?
      AND ur.is_active = TRUE
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
  `, [userId]);

  return roles.map(role => ({
    ...role,
    permissions: typeof role.permissions === 'string'
      ? JSON.parse(role.permissions)
      : role.permissions,
  }));
}

/**
 * Get consolidated permissions for a user across all their roles
 */
export async function getUserERPPermissions(userId: number): Promise<Record<ERPModule, ERPPermission[]>> {
  const roles = await getUserERPRoles(userId);

  const permissions: Record<ERPModule, Set<ERPPermission>> = {
    finance: new Set(),
    projects: new Set(),
    hr: new Set(),
    crm: new Set(),
    inventory: new Set(),
    invoicing: new Set(),
    settings: new Set(),
  };

  for (const role of roles) {
    for (const [module, perms] of Object.entries(role.permissions)) {
      if (permissions[module as ERPModule] && Array.isArray(perms)) {
        perms.forEach(p => permissions[module as ERPModule].add(p as ERPPermission));
      }
    }
  }

  // Convert Sets back to arrays
  const result: Record<ERPModule, ERPPermission[]> = {} as any;
  for (const [module, perms] of Object.entries(permissions)) {
    result[module as ERPModule] = Array.from(perms);
  }

  return result;
}

/**
 * Check if user has specific permission on a module
 */
export async function hasERPPermission(
  userId: number,
  module: ERPModule,
  permission: ERPPermission
): Promise<boolean> {
  const permissions = await getUserERPPermissions(userId);
  return permissions[module]?.includes(permission) ?? false;
}

/**
 * Check if user has any ERP access
 */
export async function hasERPAccess(userId: number): Promise<boolean> {
  const permissions = await getUserERPPermissions(userId);
  return Object.values(permissions).some(perms => perms.length > 0);
}

/**
 * Verify ERP auth and return full context
 */
export async function verifyERPAuth(request: NextRequest): Promise<ERPAuthContext | null> {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your_secret_key'
    ) as { userId: number; email: string; isAdmin: boolean };

    const erpRoles = await getUserERPRoles(decoded.userId);
    const permissions = await getUserERPPermissions(decoded.userId);

    // Admin users get full access
    if (decoded.isAdmin) {
      const fullPermissions: ERPPermission[] = ['read', 'write', 'delete', 'approve'];
      return {
        userId: decoded.userId,
        email: decoded.email,
        isAdmin: true,
        erpRoles,
        permissions: {
          finance: fullPermissions,
          projects: fullPermissions,
          hr: fullPermissions,
          crm: fullPermissions,
          inventory: fullPermissions,
          invoicing: fullPermissions,
          settings: fullPermissions,
        },
        hasERPAccess: true,
      };
    }

    return {
      userId: decoded.userId,
      email: decoded.email,
      isAdmin: false,
      erpRoles,
      permissions,
      hasERPAccess: Object.values(permissions).some(perms => perms.length > 0),
    };
  } catch {
    return null;
  }
}

/**
 * Require specific ERP permission - returns auth context or throws
 */
export async function requireERPPermission(
  request: NextRequest,
  module: ERPModule,
  permission: ERPPermission
): Promise<ERPAuthContext> {
  const auth = await verifyERPAuth(request);

  if (!auth) {
    throw new ERPError('Unauthorized', 401);
  }

  if (!auth.permissions[module]?.includes(permission)) {
    throw new ERPError(`Missing ${permission} permission for ${module} module`, 403);
  }

  return auth;
}

// =============================================
// Role Management
// =============================================

/**
 * Assign role to user
 */
export async function assignERPRole(
  userId: number,
  roleId: number,
  grantedBy: number,
  expiresAt?: Date
): Promise<number> {
  const result = await query<any>(`
    INSERT INTO erp_user_roles (user_id, role_id, granted_by, expires_at)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE is_active = TRUE, granted_by = ?, expires_at = ?
  `, [userId, roleId, grantedBy, expiresAt || null, grantedBy, expiresAt || null]);

  return result.insertId || 0;
}

/**
 * Revoke role from user
 */
export async function revokeERPRole(userId: number, roleId: number): Promise<void> {
  await query(`
    UPDATE erp_user_roles
    SET is_active = FALSE
    WHERE user_id = ? AND role_id = ?
  `, [userId, roleId]);
}

/**
 * Get all available ERP roles
 */
export async function getAllERPRoles(): Promise<ERPRole[]> {
  const roles = await query<any[]>(`
    SELECT id, name, description, permissions, is_system
    FROM erp_roles
    ORDER BY name
  `);

  return roles.map(role => ({
    ...role,
    permissions: typeof role.permissions === 'string'
      ? JSON.parse(role.permissions)
      : role.permissions,
  }));
}

// =============================================
// Audit Logging
// =============================================

/**
 * Log an ERP action
 */
export async function logERPAction(entry: AuditLogEntry): Promise<number> {
  const result = await query<any>(`
    INSERT INTO erp_audit_log (
      user_id, module, action, entity_type, entity_id,
      old_values, new_values, ip_address, user_agent
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    entry.user_id,
    entry.module,
    entry.action,
    entry.entity_type,
    entry.entity_id || null,
    entry.old_values ? JSON.stringify(entry.old_values) : null,
    entry.new_values ? JSON.stringify(entry.new_values) : null,
    entry.ip_address || null,
    entry.user_agent || null,
  ]);

  return result.insertId;
}

/**
 * Get audit log entries with filters
 */
export async function getAuditLogs(options: {
  module?: ERPModule;
  userId?: number;
  entityType?: string;
  entityId?: number;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}): Promise<{ entries: any[]; total: number }> {
  let sql = `
    SELECT
      al.*,
      u.email as user_email,
      u.display_name as user_name
    FROM erp_audit_log al
    LEFT JOIN users u ON al.user_id = u.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (options.module) {
    sql += ' AND al.module = ?';
    params.push(options.module);
  }
  if (options.userId) {
    sql += ' AND al.user_id = ?';
    params.push(options.userId);
  }
  if (options.entityType) {
    sql += ' AND al.entity_type = ?';
    params.push(options.entityType);
  }
  if (options.entityId) {
    sql += ' AND al.entity_id = ?';
    params.push(options.entityId);
  }
  if (options.startDate) {
    sql += ' AND al.created_at >= ?';
    params.push(options.startDate);
  }
  if (options.endDate) {
    sql += ' AND al.created_at <= ?';
    params.push(options.endDate);
  }

  // Get total count
  const countSql = sql.replace('SELECT \n      al.*,\n      u.email as user_email,\n      u.display_name as user_name', 'SELECT COUNT(*) as total');
  const countResult = await queryOne<{ total: number }>(countSql, params);
  const total = countResult?.total || 0;

  // Add ordering and pagination
  sql += ' ORDER BY al.created_at DESC';
  sql += ' LIMIT ? OFFSET ?';
  params.push(options.limit || 50, options.offset || 0);

  const entries = await query<any[]>(sql, params);

  return { entries, total };
}

// =============================================
// Sequence Number Generation
// =============================================

/**
 * Get next sequence number
 */
export async function getNextSequence(sequenceType: string): Promise<string> {
  const seq = await queryOne<{
    prefix: string;
    next_number: number;
    padding: number;
  }>(`
    SELECT prefix, next_number, padding
    FROM erp_sequences
    WHERE sequence_type = ?
    FOR UPDATE
  `, [sequenceType]);

  if (!seq) {
    throw new ERPError(`Sequence type ${sequenceType} not found`, 500);
  }

  const number = seq.prefix + String(seq.next_number).padStart(seq.padding, '0');

  await query(`
    UPDATE erp_sequences
    SET next_number = next_number + 1, updated_at = NOW()
    WHERE sequence_type = ?
  `, [sequenceType]);

  return number;
}

// =============================================
// Helper Functions
// =============================================

/**
 * Custom ERP error class
 */
export class ERPError extends Error {
  status: number;

  constructor(message: string, status: number = 400) {
    super(message);
    this.name = 'ERPError';
    this.status = status;
  }
}

/**
 * Format currency amount
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Calculate date difference in days
 */
export function daysBetween(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round(Math.abs((date1.getTime() - date2.getTime()) / oneDay));
}

/**
 * Parse JSON field safely
 */
export function parseJsonField<T>(value: any, defaultValue: T): T {
  if (!value) return defaultValue;
  if (typeof value === 'object') return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * Build pagination response
 */
export function buildPaginationResponse<T>(
  items: T[],
  total: number,
  page: number,
  limit: number
) {
  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    },
  };
}

/**
 * Get client IP from request
 */
export function getClientIP(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

/**
 * Sanitize object for audit log (remove sensitive fields)
 */
export function sanitizeForAudit(obj: Record<string, any>): Record<string, any> {
  const sensitiveFields = ['password', 'password_hash', 'token', 'secret', 'api_key', 'bank_account_number', 'tax_id'];
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (sensitiveFields.some(f => key.toLowerCase().includes(f))) {
      sanitized[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeForAudit(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Calculate financial period dates
 */
export function getFiscalPeriod(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return { start, end };
}

/**
 * Calculate work days between two dates (excludes weekends)
 */
export function workDaysBetween(startDate: Date, endDate: Date): number {
  let count = 0;
  const current = new Date(startDate);

  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

// =============================================
// Validation Helpers
// =============================================

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * Validate phone format
 */
export function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 15;
}

/**
 * Validate currency code
 */
export function isValidCurrency(code: string): boolean {
  const validCurrencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CNY', 'INR'];
  return validCurrencies.includes(code.toUpperCase());
}

/**
 * Validate date string
 */
export function isValidDate(dateStr: string): boolean {
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

// =============================================
// Query Building Helpers
// =============================================

/**
 * Build ORDER BY clause from query params
 */
export function buildSortClause(
  sortBy: string | null,
  sortOrder: string | null,
  allowedFields: string[],
  defaultSort: string = 'created_at DESC'
): string {
  if (!sortBy || !allowedFields.includes(sortBy)) {
    return defaultSort;
  }
  const order = sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  return `${sortBy} ${order}`;
}

/**
 * Build date range filter
 */
export function buildDateRangeFilter(
  field: string,
  startDate: string | null,
  endDate: string | null,
  params: any[]
): string {
  let sql = '';
  if (startDate) {
    sql += ` AND ${field} >= ?`;
    params.push(startDate);
  }
  if (endDate) {
    sql += ` AND ${field} <= ?`;
    params.push(endDate);
  }
  return sql;
}

/**
 * Parse array from query string (comma-separated)
 */
export function parseArrayParam(value: string | null): number[] {
  if (!value) return [];
  return value.split(',').map(v => parseInt(v.trim())).filter(v => !isNaN(v));
}

// =============================================
// Bulk Operation Helpers
// =============================================

export interface BulkOperationResult {
  success: number;
  failed: number;
  errors: { id: number; error: string }[];
}

/**
 * Execute bulk delete with validation
 */
export async function bulkDelete(
  table: string,
  ids: number[],
  validateFn?: (id: number) => Promise<string | null>
): Promise<BulkOperationResult> {
  const result: BulkOperationResult = { success: 0, failed: 0, errors: [] };

  for (const id of ids) {
    try {
      if (validateFn) {
        const error = await validateFn(id);
        if (error) {
          result.failed++;
          result.errors.push({ id, error });
          continue;
        }
      }
      await query(`DELETE FROM ${table} WHERE id = ?`, [id]);
      result.success++;
    } catch (err: any) {
      result.failed++;
      result.errors.push({ id, error: err.message });
    }
  }

  return result;
}

/**
 * Execute bulk update
 */
export async function bulkUpdate(
  table: string,
  ids: number[],
  updates: Record<string, any>,
  allowedFields: string[]
): Promise<BulkOperationResult> {
  const result: BulkOperationResult = { success: 0, failed: 0, errors: [] };

  const setClauses: string[] = [];
  const values: any[] = [];

  for (const [field, value] of Object.entries(updates)) {
    if (allowedFields.includes(field)) {
      setClauses.push(`${field} = ?`);
      values.push(value);
    }
  }

  if (setClauses.length === 0) {
    return { success: 0, failed: ids.length, errors: [{ id: 0, error: 'No valid fields to update' }] };
  }

  for (const id of ids) {
    try {
      await query(`UPDATE ${table} SET ${setClauses.join(', ')} WHERE id = ?`, [...values, id]);
      result.success++;
    } catch (err: any) {
      result.failed++;
      result.errors.push({ id, error: err.message });
    }
  }

  return result;
}
