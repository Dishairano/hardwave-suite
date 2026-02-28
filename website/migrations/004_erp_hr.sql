-- ERP HR Module Tables
-- Migration: 004_erp_hr.sql
-- Created: 2026-02-14

-- =============================================
-- Departments
-- =============================================

CREATE TABLE IF NOT EXISTS hr_departments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) UNIQUE,
  description TEXT,
  parent_id INT NULL,
  manager_id INT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES hr_departments(id) ON DELETE SET NULL,
  INDEX idx_departments_parent (parent_id)
);

INSERT INTO hr_departments (name, code, description) VALUES
('Executive', 'EXEC', 'Executive leadership'),
('Engineering', 'ENG', 'Software development and engineering'),
('Design', 'DES', 'UI/UX and product design'),
('Marketing', 'MKT', 'Marketing and communications'),
('Sales', 'SAL', 'Sales and business development'),
('Finance', 'FIN', 'Finance and accounting'),
('Human Resources', 'HR', 'People operations'),
('Operations', 'OPS', 'Business operations');

-- =============================================
-- Positions
-- =============================================

CREATE TABLE IF NOT EXISTS hr_positions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  department_id INT,
  description TEXT,
  min_salary DECIMAL(15, 2),
  max_salary DECIMAL(15, 2),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES hr_departments(id) ON DELETE SET NULL,
  INDEX idx_positions_dept (department_id)
);

INSERT INTO hr_positions (title, description) VALUES
('CEO', 'Chief Executive Officer'),
('CTO', 'Chief Technology Officer'),
('CFO', 'Chief Financial Officer'),
('Software Engineer', 'Software development'),
('Senior Software Engineer', 'Senior software development'),
('Product Designer', 'Product and UI/UX design'),
('Marketing Manager', 'Marketing leadership'),
('Sales Representative', 'Sales and client relations'),
('HR Manager', 'Human resources management'),
('Accountant', 'Financial accounting');

-- =============================================
-- Employees
-- =============================================

CREATE TABLE IF NOT EXISTS hr_employees (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNIQUE,
  employee_number VARCHAR(20) NOT NULL UNIQUE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  personal_email VARCHAR(255),
  date_of_birth DATE,
  gender ENUM('male', 'female', 'other', 'prefer_not_to_say'),
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100) DEFAULT 'United States',
  department_id INT,
  position_id INT,
  manager_id INT NULL,
  employment_type ENUM('full_time', 'part_time', 'contract', 'intern') DEFAULT 'full_time',
  employment_status ENUM('active', 'on_leave', 'terminated', 'suspended') DEFAULT 'active',
  hire_date DATE NOT NULL,
  termination_date DATE NULL,
  probation_end_date DATE,
  work_location ENUM('office', 'remote', 'hybrid') DEFAULT 'remote',
  salary DECIMAL(15, 2),
  salary_frequency ENUM('hourly', 'monthly', 'annual') DEFAULT 'annual',
  currency VARCHAR(3) DEFAULT 'USD',
  bank_name VARCHAR(100),
  bank_account_number VARCHAR(50),
  bank_routing_number VARCHAR(50),
  tax_id VARCHAR(50),
  emergency_contact_name VARCHAR(100),
  emergency_contact_phone VARCHAR(20),
  emergency_contact_relation VARCHAR(50),
  notes TEXT,
  profile_photo_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (department_id) REFERENCES hr_departments(id) ON DELETE SET NULL,
  FOREIGN KEY (position_id) REFERENCES hr_positions(id) ON DELETE SET NULL,
  FOREIGN KEY (manager_id) REFERENCES hr_employees(id) ON DELETE SET NULL,
  INDEX idx_employees_dept (department_id),
  INDEX idx_employees_manager (manager_id),
  INDEX idx_employees_status (employment_status)
);

-- =============================================
-- Leave Types
-- =============================================

CREATE TABLE IF NOT EXISTS hr_leave_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) UNIQUE,
  description TEXT,
  default_days_per_year DECIMAL(5, 2) DEFAULT 0,
  is_paid BOOLEAN DEFAULT TRUE,
  requires_approval BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  color VARCHAR(7) DEFAULT '#3B82F6',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO hr_leave_types (name, code, description, default_days_per_year, is_paid, color) VALUES
('Annual Leave', 'AL', 'Paid vacation time', 15, TRUE, '#10B981'),
('Sick Leave', 'SL', 'Paid sick days', 10, TRUE, '#EF4444'),
('Personal Leave', 'PL', 'Personal time off', 3, TRUE, '#8B5CF6'),
('Unpaid Leave', 'UL', 'Unpaid time off', 0, FALSE, '#6B7280'),
('Parental Leave', 'PAR', 'Maternity/Paternity leave', 60, TRUE, '#EC4899'),
('Bereavement', 'BRV', 'Bereavement leave', 5, TRUE, '#1F2937'),
('Jury Duty', 'JD', 'Jury duty leave', 5, TRUE, '#F59E0B'),
('Work From Home', 'WFH', 'Work from home day', 0, TRUE, '#06B6D4');

-- =============================================
-- Leave Balances
-- =============================================

CREATE TABLE IF NOT EXISTS hr_leave_balances (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  leave_type_id INT NOT NULL,
  year INT NOT NULL,
  entitled_days DECIMAL(5, 2) DEFAULT 0,
  used_days DECIMAL(5, 2) DEFAULT 0,
  pending_days DECIMAL(5, 2) DEFAULT 0,
  carried_over DECIMAL(5, 2) DEFAULT 0,
  remaining_days DECIMAL(5, 2) GENERATED ALWAYS AS (entitled_days + carried_over - used_days - pending_days) STORED,
  FOREIGN KEY (employee_id) REFERENCES hr_employees(id) ON DELETE CASCADE,
  FOREIGN KEY (leave_type_id) REFERENCES hr_leave_types(id) ON DELETE CASCADE,
  UNIQUE KEY unique_balance (employee_id, leave_type_id, year),
  INDEX idx_balances_employee (employee_id)
);

-- =============================================
-- Leave Requests
-- =============================================

CREATE TABLE IF NOT EXISTS hr_leave_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  leave_type_id INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_requested DECIMAL(5, 2) NOT NULL,
  is_half_day BOOLEAN DEFAULT FALSE,
  half_day_period ENUM('morning', 'afternoon') NULL,
  reason TEXT,
  status ENUM('pending', 'approved', 'rejected', 'cancelled') DEFAULT 'pending',
  approved_by INT NULL,
  approved_at TIMESTAMP NULL,
  rejection_reason VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES hr_employees(id) ON DELETE CASCADE,
  FOREIGN KEY (leave_type_id) REFERENCES hr_leave_types(id),
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_leave_employee (employee_id),
  INDEX idx_leave_status (status),
  INDEX idx_leave_dates (start_date, end_date)
);

-- =============================================
-- Performance Reviews
-- =============================================

CREATE TABLE IF NOT EXISTS hr_performance_reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  reviewer_id INT NOT NULL,
  review_period_start DATE NOT NULL,
  review_period_end DATE NOT NULL,
  review_type ENUM('annual', 'quarterly', 'probation', 'project') DEFAULT 'annual',
  status ENUM('draft', 'pending_self', 'pending_manager', 'completed') DEFAULT 'draft',
  overall_rating DECIMAL(3, 2),
  self_assessment TEXT,
  manager_assessment TEXT,
  goals_achieved TEXT,
  areas_of_improvement TEXT,
  goals_for_next_period TEXT,
  employee_comments TEXT,
  manager_comments TEXT,
  submitted_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES hr_employees(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewer_id) REFERENCES users(id),
  INDEX idx_reviews_employee (employee_id),
  INDEX idx_reviews_status (status)
);

-- =============================================
-- Payroll Runs
-- =============================================

CREATE TABLE IF NOT EXISTS hr_payroll_runs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  payroll_number VARCHAR(20) NOT NULL UNIQUE,
  pay_period_start DATE NOT NULL,
  pay_period_end DATE NOT NULL,
  payment_date DATE NOT NULL,
  status ENUM('draft', 'processing', 'approved', 'paid', 'cancelled') DEFAULT 'draft',
  total_gross DECIMAL(15, 2) DEFAULT 0.00,
  total_deductions DECIMAL(15, 2) DEFAULT 0.00,
  total_net DECIMAL(15, 2) DEFAULT 0.00,
  employee_count INT DEFAULT 0,
  notes TEXT,
  created_by INT NOT NULL,
  approved_by INT NULL,
  approved_at TIMESTAMP NULL,
  paid_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_payroll_status (status),
  INDEX idx_payroll_dates (pay_period_start, pay_period_end)
);

-- =============================================
-- Payroll Items (Employee-level details)
-- =============================================

CREATE TABLE IF NOT EXISTS hr_payroll_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  payroll_run_id INT NOT NULL,
  employee_id INT NOT NULL,
  base_salary DECIMAL(15, 2) DEFAULT 0.00,
  hours_worked DECIMAL(10, 2) DEFAULT 0.00,
  overtime_hours DECIMAL(10, 2) DEFAULT 0.00,
  overtime_rate DECIMAL(5, 2) DEFAULT 1.5,
  gross_pay DECIMAL(15, 2) DEFAULT 0.00,
  federal_tax DECIMAL(15, 2) DEFAULT 0.00,
  state_tax DECIMAL(15, 2) DEFAULT 0.00,
  social_security DECIMAL(15, 2) DEFAULT 0.00,
  medicare DECIMAL(15, 2) DEFAULT 0.00,
  health_insurance DECIMAL(15, 2) DEFAULT 0.00,
  retirement_401k DECIMAL(15, 2) DEFAULT 0.00,
  other_deductions DECIMAL(15, 2) DEFAULT 0.00,
  total_deductions DECIMAL(15, 2) DEFAULT 0.00,
  net_pay DECIMAL(15, 2) DEFAULT 0.00,
  notes TEXT,
  FOREIGN KEY (payroll_run_id) REFERENCES hr_payroll_runs(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES hr_employees(id) ON DELETE CASCADE,
  UNIQUE KEY unique_payroll_employee (payroll_run_id, employee_id),
  INDEX idx_payroll_items_run (payroll_run_id),
  INDEX idx_payroll_items_employee (employee_id)
);
