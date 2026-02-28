-- ERP Finance Module Tables
-- Migration: 002_erp_finance.sql
-- Created: 2026-02-14

-- =============================================
-- Chart of Accounts
-- =============================================

CREATE TABLE IF NOT EXISTS fin_accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  account_type ENUM('asset', 'liability', 'equity', 'revenue', 'expense') NOT NULL,
  parent_id INT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  opening_balance DECIMAL(15, 2) DEFAULT 0.00,
  current_balance DECIMAL(15, 2) DEFAULT 0.00,
  currency VARCHAR(3) DEFAULT 'USD',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES fin_accounts(id) ON DELETE SET NULL,
  INDEX idx_fin_accounts_type (account_type),
  INDEX idx_fin_accounts_parent (parent_id)
);

-- Default chart of accounts
INSERT INTO fin_accounts (code, name, account_type, description) VALUES
-- Assets
('1000', 'Assets', 'asset', 'All asset accounts'),
('1100', 'Cash and Bank', 'asset', 'Cash and bank accounts'),
('1110', 'Cash on Hand', 'asset', 'Physical cash'),
('1120', 'Checking Account', 'asset', 'Primary business checking'),
('1130', 'Savings Account', 'asset', 'Business savings'),
('1200', 'Accounts Receivable', 'asset', 'Customer receivables'),
('1300', 'Inventory', 'asset', 'Product inventory'),
('1400', 'Prepaid Expenses', 'asset', 'Prepaid items'),
('1500', 'Fixed Assets', 'asset', 'Long-term assets'),
('1510', 'Equipment', 'asset', 'Business equipment'),
('1520', 'Accumulated Depreciation', 'asset', 'Accumulated depreciation'),
-- Liabilities
('2000', 'Liabilities', 'liability', 'All liability accounts'),
('2100', 'Accounts Payable', 'liability', 'Supplier payables'),
('2200', 'Credit Cards', 'liability', 'Credit card balances'),
('2300', 'Accrued Expenses', 'liability', 'Accrued liabilities'),
('2400', 'Taxes Payable', 'liability', 'Tax liabilities'),
('2500', 'Loans Payable', 'liability', 'Loan balances'),
-- Equity
('3000', 'Equity', 'equity', 'Owner equity accounts'),
('3100', 'Owner Capital', 'equity', 'Capital contributions'),
('3200', 'Retained Earnings', 'equity', 'Accumulated profits'),
('3300', 'Distributions', 'equity', 'Owner withdrawals'),
-- Revenue
('4000', 'Revenue', 'revenue', 'All revenue accounts'),
('4100', 'Product Sales', 'revenue', 'Product revenue'),
('4200', 'Service Revenue', 'revenue', 'Service income'),
('4300', 'Subscription Revenue', 'revenue', 'Recurring subscriptions'),
('4400', 'Other Income', 'revenue', 'Miscellaneous income'),
-- Expenses
('5000', 'Expenses', 'expense', 'All expense accounts'),
('5100', 'Cost of Goods Sold', 'expense', 'Direct product costs'),
('5200', 'Payroll Expenses', 'expense', 'Employee wages and benefits'),
('5300', 'Rent & Utilities', 'expense', 'Facility costs'),
('5400', 'Marketing', 'expense', 'Advertising and promotion'),
('5500', 'Software & Subscriptions', 'expense', 'Software costs'),
('5600', 'Professional Services', 'expense', 'Legal, accounting, etc.'),
('5700', 'Office Supplies', 'expense', 'General supplies'),
('5800', 'Travel & Entertainment', 'expense', 'Travel costs'),
('5900', 'Depreciation', 'expense', 'Depreciation expense'),
('5950', 'Bank Fees', 'expense', 'Banking charges'),
('5999', 'Other Expenses', 'expense', 'Miscellaneous expenses');

-- Update parent IDs
UPDATE fin_accounts SET parent_id = (SELECT id FROM (SELECT id FROM fin_accounts WHERE code = '1000') AS t) WHERE code IN ('1100', '1200', '1300', '1400', '1500');
UPDATE fin_accounts SET parent_id = (SELECT id FROM (SELECT id FROM fin_accounts WHERE code = '1100') AS t) WHERE code IN ('1110', '1120', '1130');
UPDATE fin_accounts SET parent_id = (SELECT id FROM (SELECT id FROM fin_accounts WHERE code = '1500') AS t) WHERE code IN ('1510', '1520');
UPDATE fin_accounts SET parent_id = (SELECT id FROM (SELECT id FROM fin_accounts WHERE code = '2000') AS t) WHERE code IN ('2100', '2200', '2300', '2400', '2500');
UPDATE fin_accounts SET parent_id = (SELECT id FROM (SELECT id FROM fin_accounts WHERE code = '3000') AS t) WHERE code IN ('3100', '3200', '3300');
UPDATE fin_accounts SET parent_id = (SELECT id FROM (SELECT id FROM fin_accounts WHERE code = '4000') AS t) WHERE code IN ('4100', '4200', '4300', '4400');
UPDATE fin_accounts SET parent_id = (SELECT id FROM (SELECT id FROM fin_accounts WHERE code = '5000') AS t) WHERE code IN ('5100', '5200', '5300', '5400', '5500', '5600', '5700', '5800', '5900', '5950', '5999');

-- =============================================
-- Journal Entries (Double-Entry Bookkeeping)
-- =============================================

CREATE TABLE IF NOT EXISTS fin_journal_entries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  entry_number VARCHAR(20) NOT NULL UNIQUE,
  entry_date DATE NOT NULL,
  description TEXT,
  reference VARCHAR(100),
  status ENUM('draft', 'posted', 'reversed') DEFAULT 'draft',
  total_debit DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  total_credit DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  created_by INT NOT NULL,
  approved_by INT NULL,
  approved_at TIMESTAMP NULL,
  posted_at TIMESTAMP NULL,
  reversed_by INT NULL,
  reversed_at TIMESTAMP NULL,
  reversal_of INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (reversed_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (reversal_of) REFERENCES fin_journal_entries(id) ON DELETE SET NULL,
  INDEX idx_journal_date (entry_date),
  INDEX idx_journal_status (status)
);

CREATE TABLE IF NOT EXISTS fin_journal_lines (
  id INT AUTO_INCREMENT PRIMARY KEY,
  journal_entry_id INT NOT NULL,
  account_id INT NOT NULL,
  description VARCHAR(255),
  debit DECIMAL(15, 2) DEFAULT 0.00,
  credit DECIMAL(15, 2) DEFAULT 0.00,
  line_order INT DEFAULT 0,
  FOREIGN KEY (journal_entry_id) REFERENCES fin_journal_entries(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES fin_accounts(id),
  INDEX idx_journal_lines_entry (journal_entry_id),
  INDEX idx_journal_lines_account (account_id)
);

-- =============================================
-- Expense Categories
-- =============================================

CREATE TABLE IF NOT EXISTS fin_expense_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255),
  account_id INT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES fin_accounts(id) ON DELETE SET NULL
);

INSERT INTO fin_expense_categories (name, description) VALUES
('Travel', 'Business travel expenses'),
('Meals', 'Business meals and entertainment'),
('Supplies', 'Office supplies and materials'),
('Software', 'Software and subscriptions'),
('Equipment', 'Equipment purchases'),
('Professional Services', 'Contractors and consultants'),
('Marketing', 'Advertising and marketing'),
('Other', 'Miscellaneous expenses');

-- =============================================
-- Expenses (Reimbursements)
-- =============================================

CREATE TABLE IF NOT EXISTS fin_expenses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  expense_number VARCHAR(20) NOT NULL UNIQUE,
  user_id INT NOT NULL,
  category_id INT,
  amount DECIMAL(15, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  expense_date DATE NOT NULL,
  vendor VARCHAR(100),
  description TEXT,
  receipt_url VARCHAR(500),
  status ENUM('draft', 'submitted', 'approved', 'rejected', 'paid') DEFAULT 'draft',
  submitted_at TIMESTAMP NULL,
  approved_by INT NULL,
  approved_at TIMESTAMP NULL,
  rejected_reason VARCHAR(255),
  paid_at TIMESTAMP NULL,
  journal_entry_id INT NULL,
  project_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (category_id) REFERENCES fin_expense_categories(id) ON DELETE SET NULL,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (journal_entry_id) REFERENCES fin_journal_entries(id) ON DELETE SET NULL,
  INDEX idx_expenses_user (user_id),
  INDEX idx_expenses_status (status),
  INDEX idx_expenses_date (expense_date)
);

-- =============================================
-- Budgets
-- =============================================

CREATE TABLE IF NOT EXISTS fin_budgets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  fiscal_year INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status ENUM('draft', 'active', 'closed') DEFAULT 'draft',
  total_amount DECIMAL(15, 2) DEFAULT 0.00,
  created_by INT NOT NULL,
  approved_by INT NULL,
  approved_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_budgets_year (fiscal_year),
  INDEX idx_budgets_status (status)
);

CREATE TABLE IF NOT EXISTS fin_budget_lines (
  id INT AUTO_INCREMENT PRIMARY KEY,
  budget_id INT NOT NULL,
  account_id INT NOT NULL,
  period_type ENUM('monthly', 'quarterly', 'annual') DEFAULT 'monthly',
  period_number INT DEFAULT 1,
  budgeted_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  actual_amount DECIMAL(15, 2) DEFAULT 0.00,
  variance DECIMAL(15, 2) GENERATED ALWAYS AS (budgeted_amount - actual_amount) STORED,
  notes TEXT,
  FOREIGN KEY (budget_id) REFERENCES fin_budgets(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES fin_accounts(id),
  UNIQUE KEY unique_budget_account_period (budget_id, account_id, period_type, period_number),
  INDEX idx_budget_lines_budget (budget_id)
);
