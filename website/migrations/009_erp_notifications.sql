-- ERP Notifications System
-- Migration: 009_erp_notifications.sql

-- Notification types/templates
CREATE TABLE IF NOT EXISTS erp_notification_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    module ENUM('finance', 'projects', 'hr', 'crm', 'inventory', 'invoicing', 'settings', 'system') NOT NULL,
    template_subject VARCHAR(255),
    template_body TEXT,
    default_channels JSON DEFAULT '["in_app"]', -- in_app, email, webhook
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User notification preferences
CREATE TABLE IF NOT EXISTS erp_notification_preferences (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    notification_type_id INT NOT NULL,
    channels JSON DEFAULT '["in_app"]',
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_type (user_id, notification_type_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (notification_type_id) REFERENCES erp_notification_types(id) ON DELETE CASCADE
);

-- Notifications
CREATE TABLE IF NOT EXISTS erp_notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    notification_type_id INT,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    module ENUM('finance', 'projects', 'hr', 'crm', 'inventory', 'invoicing', 'settings', 'system') NOT NULL,
    severity ENUM('info', 'warning', 'error', 'success') DEFAULT 'info',
    entity_type VARCHAR(50),
    entity_id INT,
    action_url VARCHAR(500),
    action_label VARCHAR(100),
    metadata JSON,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL,
    INDEX idx_user_read (user_id, is_read),
    INDEX idx_user_created (user_id, created_at),
    INDEX idx_module (module),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (notification_type_id) REFERENCES erp_notification_types(id) ON DELETE SET NULL
);

-- Notification queue for async processing
CREATE TABLE IF NOT EXISTS erp_notification_queue (
    id INT AUTO_INCREMENT PRIMARY KEY,
    notification_id INT NOT NULL,
    channel ENUM('email', 'webhook', 'slack', 'sms') NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    payload JSON NOT NULL,
    status ENUM('pending', 'processing', 'sent', 'failed') DEFAULT 'pending',
    attempts INT DEFAULT 0,
    max_attempts INT DEFAULT 3,
    last_attempt_at TIMESTAMP NULL,
    sent_at TIMESTAMP NULL,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_pending (status, created_at),
    FOREIGN KEY (notification_id) REFERENCES erp_notifications(id) ON DELETE CASCADE
);

-- Webhook subscriptions for external integrations
CREATE TABLE IF NOT EXISTS erp_webhook_subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    url VARCHAR(500) NOT NULL,
    secret_key VARCHAR(255),
    events JSON NOT NULL, -- Array of notification type codes
    headers JSON,
    is_active BOOLEAN DEFAULT TRUE,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Insert default notification types
INSERT INTO erp_notification_types (code, name, description, module, template_subject, template_body, default_channels) VALUES
-- Finance notifications
('expense_submitted', 'Expense Submitted', 'When an expense is submitted for approval', 'finance', 'New expense submitted for approval', 'A new expense of {{amount}} has been submitted by {{submitter}} for {{category}}.', '["in_app", "email"]'),
('expense_approved', 'Expense Approved', 'When an expense is approved', 'finance', 'Your expense has been approved', 'Your expense of {{amount}} for {{category}} has been approved by {{approver}}.', '["in_app", "email"]'),
('expense_rejected', 'Expense Rejected', 'When an expense is rejected', 'finance', 'Your expense has been rejected', 'Your expense of {{amount}} has been rejected. Reason: {{reason}}', '["in_app", "email"]'),
('budget_threshold', 'Budget Threshold Alert', 'When budget usage exceeds threshold', 'finance', 'Budget threshold exceeded', 'The budget "{{budget_name}}" has reached {{percentage}}% utilization.', '["in_app", "email"]'),
('invoice_overdue', 'Invoice Overdue', 'When an invoice becomes overdue', 'invoicing', 'Invoice overdue', 'Invoice {{invoice_number}} for {{company}} is now {{days}} days overdue.', '["in_app", "email"]'),
('payment_received', 'Payment Received', 'When a payment is received', 'invoicing', 'Payment received', 'A payment of {{amount}} has been received for invoice {{invoice_number}}.', '["in_app"]'),

-- HR notifications
('leave_request_submitted', 'Leave Request Submitted', 'When a leave request is submitted', 'hr', 'New leave request', '{{employee}} has submitted a leave request for {{dates}}.', '["in_app", "email"]'),
('leave_request_approved', 'Leave Request Approved', 'When a leave request is approved', 'hr', 'Leave request approved', 'Your leave request for {{dates}} has been approved.', '["in_app", "email"]'),
('leave_request_rejected', 'Leave Request Rejected', 'When a leave request is rejected', 'hr', 'Leave request rejected', 'Your leave request has been rejected. Reason: {{reason}}', '["in_app", "email"]'),
('payroll_processed', 'Payroll Processed', 'When payroll run is completed', 'hr', 'Payroll processed', 'Payroll for period {{period}} has been processed.', '["in_app", "email"]'),

-- CRM notifications
('deal_won', 'Deal Won', 'When a deal is marked as won', 'crm', 'Deal won!', 'Congratulations! Deal "{{deal_name}}" worth {{value}} has been won.', '["in_app", "email"]'),
('deal_lost', 'Deal Lost', 'When a deal is marked as lost', 'crm', 'Deal lost', 'Deal "{{deal_name}}" has been lost. Reason: {{reason}}', '["in_app"]'),
('deal_stage_changed', 'Deal Stage Changed', 'When a deal moves to a new stage', 'crm', 'Deal stage updated', 'Deal "{{deal_name}}" has moved to stage {{stage}}.', '["in_app"]'),
('task_assigned', 'CRM Task Assigned', 'When a CRM task is assigned', 'crm', 'New task assigned', 'You have been assigned a new task: {{task_name}}', '["in_app", "email"]'),

-- Inventory notifications
('low_stock_alert', 'Low Stock Alert', 'When product stock falls below reorder point', 'inventory', 'Low stock alert', 'Product "{{product_name}}" (SKU: {{sku}}) is low on stock. Current: {{current}}, Reorder point: {{reorder_point}}', '["in_app", "email"]'),
('purchase_order_received', 'Purchase Order Received', 'When a PO is received', 'inventory', 'Purchase order received', 'Purchase order {{po_number}} from {{supplier}} has been received.', '["in_app"]'),
('stock_adjustment', 'Stock Adjustment', 'When stock is manually adjusted', 'inventory', 'Stock adjusted', 'Stock for "{{product_name}}" has been adjusted by {{quantity}} units.', '["in_app"]'),

-- Project notifications
('task_assigned_project', 'Project Task Assigned', 'When a project task is assigned', 'projects', 'Task assigned', 'You have been assigned task "{{task_name}}" in project {{project}}.', '["in_app", "email"]'),
('task_due_soon', 'Task Due Soon', 'When a task is due within 24 hours', 'projects', 'Task due soon', 'Task "{{task_name}}" is due in {{hours}} hours.', '["in_app", "email"]'),
('task_overdue', 'Task Overdue', 'When a task becomes overdue', 'projects', 'Task overdue', 'Task "{{task_name}}" is now overdue.', '["in_app", "email"]'),
('milestone_approaching', 'Milestone Approaching', 'When a milestone is due within 7 days', 'projects', 'Milestone approaching', 'Milestone "{{milestone_name}}" in project {{project}} is due in {{days}} days.', '["in_app", "email"]'),
('time_entry_reminder', 'Time Entry Reminder', 'Daily reminder to log time', 'projects', 'Log your time', 'Reminder to log your time entries for today.', '["in_app"]'),

-- System notifications
('system_maintenance', 'System Maintenance', 'Scheduled maintenance notification', 'system', 'Scheduled maintenance', 'System maintenance scheduled for {{datetime}}. Expected downtime: {{duration}}.', '["in_app", "email"]'),
('security_alert', 'Security Alert', 'Security-related notifications', 'system', 'Security alert', '{{message}}', '["in_app", "email"]');
