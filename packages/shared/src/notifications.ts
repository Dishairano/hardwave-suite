/**
 * ERP Notification Service
 * Provides utilities for sending and managing notifications
 */

import { query, queryOne } from './db';

export type NotificationModule = 'finance' | 'projects' | 'hr' | 'crm' | 'inventory' | 'invoicing' | 'settings' | 'system';
export type NotificationSeverity = 'info' | 'warning' | 'error' | 'success';
export type NotificationChannel = 'in_app' | 'email' | 'webhook' | 'slack' | 'sms';

export interface CreateNotificationOptions {
  userId: number;
  title: string;
  message: string;
  module: NotificationModule;
  severity?: NotificationSeverity;
  typeCode?: string;
  entityType?: string;
  entityId?: number;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: Record<string, any>;
  expiresAt?: Date;
}

export interface BulkNotificationOptions extends Omit<CreateNotificationOptions, 'userId'> {
  userIds: number[];
}

/**
 * Send a notification to a user
 */
export async function sendNotification(options: CreateNotificationOptions): Promise<number> {
  const {
    userId,
    title,
    message,
    module,
    severity = 'info',
    typeCode,
    entityType,
    entityId,
    actionUrl,
    actionLabel,
    metadata,
    expiresAt,
  } = options;

  // Get notification type if provided
  let notificationTypeId = null;
  if (typeCode) {
    const notificationType = await queryOne<{ id: number }>(
      'SELECT id FROM erp_notification_types WHERE code = ?',
      [typeCode]
    );
    notificationTypeId = notificationType?.id;
  }

  const result = await query<any>(`
    INSERT INTO erp_notifications (
      user_id, notification_type_id, title, message, module, severity,
      entity_type, entity_id, action_url, action_label, metadata, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    userId,
    notificationTypeId,
    title,
    message,
    module,
    severity,
    entityType || null,
    entityId || null,
    actionUrl || null,
    actionLabel || null,
    metadata ? JSON.stringify(metadata) : null,
    expiresAt || null,
  ]);

  // Queue for additional channels (email, webhook, etc.)
  if (notificationTypeId) {
    await queueNotificationChannels(result.insertId, userId, notificationTypeId);
  }

  return result.insertId;
}

/**
 * Send notifications to multiple users
 */
export async function sendBulkNotification(options: BulkNotificationOptions): Promise<number[]> {
  const ids: number[] = [];

  for (const userId of options.userIds) {
    const id = await sendNotification({ ...options, userId });
    ids.push(id);
  }

  return ids;
}

/**
 * Send notification to all users with specific permission
 */
export async function notifyUsersWithPermission(
  module: NotificationModule,
  permission: string,
  options: Omit<CreateNotificationOptions, 'userId'>
): Promise<number[]> {
  // Get users with the specified permission
  const users = await query<{ user_id: number }[]>(`
    SELECT DISTINCT ur.user_id
    FROM erp_user_roles ur
    JOIN erp_roles r ON ur.role_id = r.id
    WHERE ur.is_active = TRUE
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
      AND JSON_CONTAINS(r.permissions->'$."${module}"', '"${permission}"')
  `);

  if (users.length === 0) return [];

  return sendBulkNotification({
    ...options,
    userIds: users.map(u => u.user_id),
  });
}

/**
 * Send notification to a user's manager
 */
export async function notifyManager(
  employeeId: number,
  options: Omit<CreateNotificationOptions, 'userId'>
): Promise<number | null> {
  const employee = await queryOne<{ manager_id: number }>(
    'SELECT manager_id FROM hr_employees WHERE id = ?',
    [employeeId]
  );

  if (!employee?.manager_id) return null;

  // Get the manager's user_id
  const manager = await queryOne<{ user_id: number }>(
    'SELECT user_id FROM hr_employees WHERE id = ?',
    [employee.manager_id]
  );

  if (!manager?.user_id) return null;

  return sendNotification({ ...options, userId: manager.user_id });
}

/**
 * Queue notification for additional delivery channels
 */
async function queueNotificationChannels(
  notificationId: number,
  userId: number,
  notificationTypeId: number
): Promise<void> {
  // Get user's channel preferences
  const preference = await queryOne<{ channels: string }>(
    'SELECT channels FROM erp_notification_preferences WHERE user_id = ? AND notification_type_id = ? AND is_enabled = TRUE',
    [userId, notificationTypeId]
  );

  // Fall back to default channels
  const notificationType = await queryOne<{ default_channels: string }>(
    'SELECT default_channels FROM erp_notification_types WHERE id = ?',
    [notificationTypeId]
  );

  const channelsStr = preference?.channels || notificationType?.default_channels;
  if (!channelsStr) return;

  const channels: NotificationChannel[] = typeof channelsStr === 'string'
    ? JSON.parse(channelsStr)
    : channelsStr;

  // Get user details for email
  const user = await queryOne<{ email: string }>(
    'SELECT email FROM users WHERE id = ?',
    [userId]
  );

  // Get notification details
  const notification = await queryOne<any>(
    'SELECT * FROM erp_notifications WHERE id = ?',
    [notificationId]
  );

  for (const channel of channels) {
    if (channel === 'in_app') continue; // Already stored

    if (channel === 'email' && user?.email) {
      await query(`
        INSERT INTO erp_notification_queue (notification_id, channel, recipient, payload)
        VALUES (?, 'email', ?, ?)
      `, [
        notificationId,
        user.email,
        JSON.stringify({
          subject: notification.title,
          body: notification.message,
          action_url: notification.action_url,
          action_label: notification.action_label,
        }),
      ]);
    }

    // Add other channel handling (webhook, slack, etc.) as needed
  }
}

// =============================================
// Pre-built Notification Helpers
// =============================================

/**
 * Notify about expense submission
 */
export async function notifyExpenseSubmitted(
  expenseId: number,
  amount: number,
  category: string,
  submitterId: number,
  submitterName: string
): Promise<number[]> {
  return notifyUsersWithPermission('finance', 'approve', {
    title: 'New expense submitted for approval',
    message: `A new expense of $${amount.toFixed(2)} has been submitted by ${submitterName} for ${category}.`,
    module: 'finance',
    severity: 'info',
    typeCode: 'expense_submitted',
    entityType: 'expense',
    entityId: expenseId,
    actionUrl: `/erp/finance/expenses/${expenseId}`,
    actionLabel: 'Review Expense',
    metadata: { amount, category, submitter_id: submitterId },
  });
}

/**
 * Notify about expense approval
 */
export async function notifyExpenseApproved(
  expenseId: number,
  userId: number,
  amount: number,
  category: string,
  approverName: string
): Promise<number> {
  return sendNotification({
    userId,
    title: 'Your expense has been approved',
    message: `Your expense of $${amount.toFixed(2)} for ${category} has been approved by ${approverName}.`,
    module: 'finance',
    severity: 'success',
    typeCode: 'expense_approved',
    entityType: 'expense',
    entityId: expenseId,
    actionUrl: `/erp/finance/expenses/${expenseId}`,
    metadata: { amount, category, approver: approverName },
  });
}

/**
 * Notify about low stock
 */
export async function notifyLowStock(
  productId: number,
  productName: string,
  sku: string,
  currentStock: number,
  reorderPoint: number
): Promise<number[]> {
  return notifyUsersWithPermission('inventory', 'write', {
    title: 'Low stock alert',
    message: `Product "${productName}" (SKU: ${sku}) is low on stock. Current: ${currentStock}, Reorder point: ${reorderPoint}`,
    module: 'inventory',
    severity: 'warning',
    typeCode: 'low_stock_alert',
    entityType: 'product',
    entityId: productId,
    actionUrl: `/erp/inventory/products/${productId}`,
    actionLabel: 'View Product',
    metadata: { sku, current_stock: currentStock, reorder_point: reorderPoint },
  });
}

/**
 * Notify about leave request
 */
export async function notifyLeaveRequestSubmitted(
  requestId: number,
  employeeName: string,
  dates: string,
  managerId: number
): Promise<number> {
  // Get manager's user_id
  const manager = await queryOne<{ user_id: number }>(
    'SELECT user_id FROM hr_employees WHERE id = ?',
    [managerId]
  );

  if (!manager?.user_id) {
    throw new Error('Manager user not found');
  }

  return sendNotification({
    userId: manager.user_id,
    title: 'New leave request',
    message: `${employeeName} has submitted a leave request for ${dates}.`,
    module: 'hr',
    severity: 'info',
    typeCode: 'leave_request_submitted',
    entityType: 'leave_request',
    entityId: requestId,
    actionUrl: `/erp/hr/leave/${requestId}`,
    actionLabel: 'Review Request',
    metadata: { employee: employeeName, dates },
  });
}

/**
 * Notify about task assignment
 */
export async function notifyTaskAssigned(
  taskId: number,
  taskName: string,
  projectName: string,
  assigneeUserId: number
): Promise<number> {
  return sendNotification({
    userId: assigneeUserId,
    title: 'Task assigned',
    message: `You have been assigned task "${taskName}" in project ${projectName}.`,
    module: 'projects',
    severity: 'info',
    typeCode: 'task_assigned_project',
    entityType: 'task',
    entityId: taskId,
    actionUrl: `/erp/projects/tasks/${taskId}`,
    actionLabel: 'View Task',
    metadata: { task_name: taskName, project: projectName },
  });
}

/**
 * Notify about overdue invoice
 */
export async function notifyInvoiceOverdue(
  invoiceId: number,
  invoiceNumber: string,
  companyName: string,
  daysOverdue: number,
  ownerUserId: number
): Promise<number> {
  return sendNotification({
    userId: ownerUserId,
    title: 'Invoice overdue',
    message: `Invoice ${invoiceNumber} for ${companyName} is now ${daysOverdue} days overdue.`,
    module: 'invoicing',
    severity: 'warning',
    typeCode: 'invoice_overdue',
    entityType: 'invoice',
    entityId: invoiceId,
    actionUrl: `/erp/invoicing/${invoiceId}`,
    actionLabel: 'View Invoice',
    metadata: { invoice_number: invoiceNumber, company: companyName, days_overdue: daysOverdue },
  });
}

/**
 * Notify about deal won
 */
export async function notifyDealWon(
  dealId: number,
  dealName: string,
  value: number,
  ownerUserId: number
): Promise<number> {
  return sendNotification({
    userId: ownerUserId,
    title: 'Deal won!',
    message: `Congratulations! Deal "${dealName}" worth $${value.toLocaleString()} has been won.`,
    module: 'crm',
    severity: 'success',
    typeCode: 'deal_won',
    entityType: 'deal',
    entityId: dealId,
    actionUrl: `/erp/crm/deals/${dealId}`,
    actionLabel: 'View Deal',
    metadata: { deal_name: dealName, value },
  });
}
