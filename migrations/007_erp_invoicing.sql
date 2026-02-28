-- ERP Invoicing Module Tables
-- Migration: 007_erp_invoicing.sql
-- Created: 2026-02-14

-- =============================================
-- Invoices
-- =============================================

CREATE TABLE IF NOT EXISTS erp_invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_number VARCHAR(20) NOT NULL UNIQUE,
  invoice_type ENUM('invoice', 'quote', 'credit_note', 'proforma') DEFAULT 'invoice',

  -- Customer Info (can link to CRM or standalone)
  company_id INT NULL,
  contact_id INT NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255),
  customer_phone VARCHAR(50),
  billing_address_line1 VARCHAR(255),
  billing_address_line2 VARCHAR(255),
  billing_city VARCHAR(100),
  billing_state VARCHAR(100),
  billing_postal_code VARCHAR(20),
  billing_country VARCHAR(100) DEFAULT 'United States',

  -- Project/Deal Link
  project_id INT NULL,
  deal_id INT NULL,

  -- Dates
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  sent_at TIMESTAMP NULL,
  viewed_at TIMESTAMP NULL,
  paid_at TIMESTAMP NULL,

  -- Amounts
  subtotal DECIMAL(15, 2) DEFAULT 0.00,
  discount_type ENUM('percentage', 'fixed') DEFAULT 'fixed',
  discount_value DECIMAL(15, 2) DEFAULT 0.00,
  discount_amount DECIMAL(15, 2) DEFAULT 0.00,
  tax_rate DECIMAL(5, 2) DEFAULT 0.00,
  tax_amount DECIMAL(15, 2) DEFAULT 0.00,
  shipping_amount DECIMAL(15, 2) DEFAULT 0.00,
  total_amount DECIMAL(15, 2) DEFAULT 0.00,
  amount_paid DECIMAL(15, 2) DEFAULT 0.00,
  amount_due DECIMAL(15, 2) GENERATED ALWAYS AS (total_amount - amount_paid) STORED,
  currency VARCHAR(3) DEFAULT 'USD',
  exchange_rate DECIMAL(10, 6) DEFAULT 1.000000,

  -- Status
  status ENUM('draft', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'cancelled', 'refunded') DEFAULT 'draft',

  -- Content
  notes TEXT,
  terms TEXT,
  footer TEXT,

  -- Stripe Integration
  stripe_invoice_id VARCHAR(255),
  stripe_payment_intent_id VARCHAR(255),
  payment_link VARCHAR(500),

  -- PDF
  pdf_url VARCHAR(500),
  pdf_generated_at TIMESTAMP NULL,

  -- Metadata
  created_by INT NOT NULL,
  approved_by INT NULL,
  approved_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (company_id) REFERENCES crm_companies(id) ON DELETE SET NULL,
  FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE SET NULL,
  FOREIGN KEY (project_id) REFERENCES prj_projects(id) ON DELETE SET NULL,
  FOREIGN KEY (deal_id) REFERENCES crm_deals(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,

  INDEX idx_invoices_number (invoice_number),
  INDEX idx_invoices_company (company_id),
  INDEX idx_invoices_status (status),
  INDEX idx_invoices_due_date (due_date),
  INDEX idx_invoices_project (project_id)
);

-- =============================================
-- Invoice Line Items
-- =============================================

CREATE TABLE IF NOT EXISTS erp_invoice_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL,
  product_id INT NULL,
  time_entry_id INT NULL,

  item_type ENUM('product', 'service', 'time', 'expense', 'custom') DEFAULT 'custom',
  description VARCHAR(500) NOT NULL,
  quantity DECIMAL(10, 2) DEFAULT 1.00,
  unit_price DECIMAL(15, 2) DEFAULT 0.00,
  unit VARCHAR(20) DEFAULT 'unit',
  discount_percent DECIMAL(5, 2) DEFAULT 0.00,
  tax_rate DECIMAL(5, 2) DEFAULT 0.00,
  line_total DECIMAL(15, 2) DEFAULT 0.00,
  sort_order INT DEFAULT 0,
  notes TEXT,

  FOREIGN KEY (invoice_id) REFERENCES erp_invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES inv_products(id) ON DELETE SET NULL,
  FOREIGN KEY (time_entry_id) REFERENCES prj_time_entries(id) ON DELETE SET NULL,

  INDEX idx_invoice_items_invoice (invoice_id)
);

-- =============================================
-- Payments
-- =============================================

CREATE TABLE IF NOT EXISTS erp_payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  payment_number VARCHAR(20) NOT NULL UNIQUE,
  invoice_id INT NOT NULL,

  -- Payment Details
  amount DECIMAL(15, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  payment_date DATE NOT NULL,
  payment_method ENUM('cash', 'check', 'bank_transfer', 'credit_card', 'paypal', 'stripe', 'other') DEFAULT 'bank_transfer',

  -- Reference Info
  reference_number VARCHAR(100),
  transaction_id VARCHAR(255),
  stripe_payment_id VARCHAR(255),

  -- Status
  status ENUM('pending', 'completed', 'failed', 'refunded', 'cancelled') DEFAULT 'completed',

  -- Notes
  notes TEXT,

  -- Metadata
  received_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (invoice_id) REFERENCES erp_invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (received_by) REFERENCES users(id),

  INDEX idx_payments_invoice (invoice_id),
  INDEX idx_payments_date (payment_date),
  INDEX idx_payments_status (status)
);

-- =============================================
-- Recurring Invoice Templates
-- =============================================

CREATE TABLE IF NOT EXISTS erp_recurring_invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  template_name VARCHAR(100) NOT NULL,

  -- Customer
  company_id INT NULL,
  contact_id INT NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255),

  -- Schedule
  frequency ENUM('weekly', 'biweekly', 'monthly', 'quarterly', 'annually') DEFAULT 'monthly',
  start_date DATE NOT NULL,
  end_date DATE NULL,
  next_invoice_date DATE,
  day_of_month INT DEFAULT 1,

  -- Invoice Details
  subtotal DECIMAL(15, 2) DEFAULT 0.00,
  tax_rate DECIMAL(5, 2) DEFAULT 0.00,
  total_amount DECIMAL(15, 2) DEFAULT 0.00,
  currency VARCHAR(3) DEFAULT 'USD',
  payment_terms INT DEFAULT 30,

  -- Settings
  auto_send BOOLEAN DEFAULT FALSE,
  send_days_before INT DEFAULT 0,
  notes TEXT,
  terms TEXT,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  invoices_created INT DEFAULT 0,
  last_invoice_date DATE NULL,
  last_invoice_id INT NULL,

  -- Metadata
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (company_id) REFERENCES crm_companies(id) ON DELETE SET NULL,
  FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (last_invoice_id) REFERENCES erp_invoices(id) ON DELETE SET NULL,

  INDEX idx_recurring_active (is_active),
  INDEX idx_recurring_next (next_invoice_date)
);

CREATE TABLE IF NOT EXISTS erp_recurring_invoice_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  recurring_invoice_id INT NOT NULL,
  product_id INT NULL,
  description VARCHAR(500) NOT NULL,
  quantity DECIMAL(10, 2) DEFAULT 1.00,
  unit_price DECIMAL(15, 2) DEFAULT 0.00,
  sort_order INT DEFAULT 0,

  FOREIGN KEY (recurring_invoice_id) REFERENCES erp_recurring_invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES inv_products(id) ON DELETE SET NULL,

  INDEX idx_recurring_items_invoice (recurring_invoice_id)
);

-- =============================================
-- Invoice Sequences (Auto-numbering)
-- =============================================

CREATE TABLE IF NOT EXISTS erp_sequences (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sequence_type VARCHAR(50) NOT NULL UNIQUE,
  prefix VARCHAR(10) DEFAULT '',
  next_number INT DEFAULT 1,
  padding INT DEFAULT 5,
  reset_frequency ENUM('never', 'yearly', 'monthly') DEFAULT 'never',
  last_reset_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO erp_sequences (sequence_type, prefix, next_number, padding) VALUES
('invoice', 'INV-', 1, 5),
('quote', 'QUO-', 1, 5),
('credit_note', 'CN-', 1, 5),
('payment', 'PAY-', 1, 5),
('expense', 'EXP-', 1, 5),
('journal', 'JE-', 1, 5),
('purchase_order', 'PO-', 1, 5),
('project', 'PRJ-', 1, 4),
('task', 'TSK-', 1, 5),
('deal', 'DEAL-', 1, 5),
('payroll', 'PR-', 1, 5),
('stock_count', 'SC-', 1, 5);

-- =============================================
-- Create view for Stripe invoice sync
-- =============================================

CREATE OR REPLACE VIEW erp_stripe_invoices_view AS
SELECT
  ei.id AS erp_invoice_id,
  ei.invoice_number,
  ei.stripe_invoice_id,
  i.id AS stripe_local_invoice_id,
  i.stripe_invoice_id AS stripe_invoice_ref,
  i.user_id,
  i.status AS stripe_status,
  i.amount_cents,
  i.paid_at AS stripe_paid_at,
  ei.status AS erp_status,
  ei.total_amount,
  ei.paid_at AS erp_paid_at
FROM erp_invoices ei
LEFT JOIN invoices i ON ei.stripe_invoice_id = i.stripe_invoice_id
WHERE ei.stripe_invoice_id IS NOT NULL;
