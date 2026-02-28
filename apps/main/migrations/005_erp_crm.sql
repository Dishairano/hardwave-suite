-- ERP CRM Module Tables
-- Migration: 005_erp_crm.sql
-- Created: 2026-02-14

-- =============================================
-- Sales Pipelines
-- =============================================

CREATE TABLE IF NOT EXISTS crm_pipelines (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO crm_pipelines (name, description, is_default) VALUES
('Sales Pipeline', 'Default sales pipeline', TRUE),
('Enterprise Pipeline', 'For enterprise deals', FALSE),
('Partnership Pipeline', 'For partnership opportunities', FALSE);

-- =============================================
-- Pipeline Stages
-- =============================================

CREATE TABLE IF NOT EXISTS crm_pipeline_stages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pipeline_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  probability INT DEFAULT 0,
  sort_order INT DEFAULT 0,
  is_won BOOLEAN DEFAULT FALSE,
  is_lost BOOLEAN DEFAULT FALSE,
  color VARCHAR(7) DEFAULT '#3B82F6',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pipeline_id) REFERENCES crm_pipelines(id) ON DELETE CASCADE,
  INDEX idx_stages_pipeline (pipeline_id)
);

-- Default stages for default pipeline
INSERT INTO crm_pipeline_stages (pipeline_id, name, probability, sort_order, color) VALUES
(1, 'Lead', 10, 1, '#6B7280'),
(1, 'Qualified', 25, 2, '#3B82F6'),
(1, 'Proposal', 50, 3, '#8B5CF6'),
(1, 'Negotiation', 75, 4, '#F59E0B'),
(1, 'Closed Won', 100, 5, '#10B981'),
(1, 'Closed Lost', 0, 6, '#EF4444');

UPDATE crm_pipeline_stages SET is_won = TRUE WHERE name = 'Closed Won';
UPDATE crm_pipeline_stages SET is_lost = TRUE WHERE name = 'Closed Lost';

-- =============================================
-- Companies
-- =============================================

CREATE TABLE IF NOT EXISTS crm_companies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255),
  industry VARCHAR(100),
  company_size ENUM('1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'),
  annual_revenue DECIMAL(15, 2),
  website VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100) DEFAULT 'United States',
  description TEXT,
  logo_url VARCHAR(500),
  linkedin_url VARCHAR(255),
  twitter_url VARCHAR(255),
  owner_id INT,
  source VARCHAR(100),
  tags JSON,
  custom_fields JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_companies_owner (owner_id),
  INDEX idx_companies_industry (industry)
);

-- =============================================
-- Contacts
-- =============================================

CREATE TABLE IF NOT EXISTS crm_contacts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(50),
  mobile VARCHAR(50),
  job_title VARCHAR(100),
  department VARCHAR(100),
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100),
  linkedin_url VARCHAR(255),
  twitter_url VARCHAR(255),
  profile_photo_url VARCHAR(500),
  lead_source VARCHAR(100),
  lead_status ENUM('new', 'contacted', 'qualified', 'unqualified', 'converted') DEFAULT 'new',
  owner_id INT,
  is_primary_contact BOOLEAN DEFAULT FALSE,
  do_not_call BOOLEAN DEFAULT FALSE,
  do_not_email BOOLEAN DEFAULT FALSE,
  notes TEXT,
  tags JSON,
  custom_fields JSON,
  last_contacted_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES crm_companies(id) ON DELETE SET NULL,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_contacts_company (company_id),
  INDEX idx_contacts_owner (owner_id),
  INDEX idx_contacts_email (email),
  INDEX idx_contacts_status (lead_status)
);

-- =============================================
-- Deals
-- =============================================

CREATE TABLE IF NOT EXISTS crm_deals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  deal_number VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  company_id INT NULL,
  contact_id INT NULL,
  pipeline_id INT NOT NULL,
  stage_id INT NOT NULL,
  owner_id INT,
  amount DECIMAL(15, 2) DEFAULT 0.00,
  currency VARCHAR(3) DEFAULT 'USD',
  probability INT DEFAULT 0,
  expected_close_date DATE,
  actual_close_date DATE,
  source VARCHAR(100),
  description TEXT,
  next_step VARCHAR(255),
  lost_reason VARCHAR(255),
  competitor VARCHAR(255),
  tags JSON,
  custom_fields JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES crm_companies(id) ON DELETE SET NULL,
  FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE SET NULL,
  FOREIGN KEY (pipeline_id) REFERENCES crm_pipelines(id),
  FOREIGN KEY (stage_id) REFERENCES crm_pipeline_stages(id),
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_deals_company (company_id),
  INDEX idx_deals_contact (contact_id),
  INDEX idx_deals_owner (owner_id),
  INDEX idx_deals_stage (stage_id),
  INDEX idx_deals_close_date (expected_close_date)
);

-- =============================================
-- Activities (Calls, Meetings, Emails, Tasks)
-- =============================================

CREATE TABLE IF NOT EXISTS crm_activities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  activity_type ENUM('call', 'meeting', 'email', 'task', 'note') NOT NULL,
  subject VARCHAR(255) NOT NULL,
  description TEXT,
  contact_id INT NULL,
  company_id INT NULL,
  deal_id INT NULL,
  owner_id INT NOT NULL,
  assigned_to INT NULL,
  due_date TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  duration_minutes INT DEFAULT 0,
  outcome VARCHAR(100),
  priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
  is_completed BOOLEAN DEFAULT FALSE,
  reminder_at TIMESTAMP NULL,
  location VARCHAR(255),
  meeting_link VARCHAR(500),
  call_recording_url VARCHAR(500),
  email_message_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE SET NULL,
  FOREIGN KEY (company_id) REFERENCES crm_companies(id) ON DELETE SET NULL,
  FOREIGN KEY (deal_id) REFERENCES crm_deals(id) ON DELETE SET NULL,
  FOREIGN KEY (owner_id) REFERENCES users(id),
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_activities_contact (contact_id),
  INDEX idx_activities_company (company_id),
  INDEX idx_activities_deal (deal_id),
  INDEX idx_activities_owner (owner_id),
  INDEX idx_activities_type (activity_type),
  INDEX idx_activities_due (due_date)
);

-- =============================================
-- Email Templates
-- =============================================

CREATE TABLE IF NOT EXISTS crm_email_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  category VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  usage_count INT DEFAULT 0,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_templates_category (category)
);

INSERT INTO crm_email_templates (name, subject, body, category, created_by) VALUES
('Initial Outreach', 'Introduction from Hardwave Studios', 'Hi {{first_name}},\n\nI hope this email finds you well. I wanted to reach out and introduce myself...\n\nBest regards,\n{{sender_name}}', 'Outreach', 1),
('Follow Up', 'Following up on our conversation', 'Hi {{first_name}},\n\nI wanted to follow up on our recent conversation about {{deal_name}}...\n\nBest regards,\n{{sender_name}}', 'Follow Up', 1),
('Meeting Request', 'Meeting Request - {{company_name}}', 'Hi {{first_name}},\n\nI would love to schedule a meeting to discuss how we can help {{company_name}}...\n\nBest regards,\n{{sender_name}}', 'Meeting', 1),
('Thank You', 'Thank you for your time', 'Hi {{first_name}},\n\nThank you for taking the time to meet with us today...\n\nBest regards,\n{{sender_name}}', 'Thank You', 1);

-- =============================================
-- Deal Products (Line Items)
-- =============================================

CREATE TABLE IF NOT EXISTS crm_deal_products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  deal_id INT NOT NULL,
  product_id INT NULL,
  product_name VARCHAR(255) NOT NULL,
  quantity DECIMAL(10, 2) DEFAULT 1,
  unit_price DECIMAL(15, 2) DEFAULT 0.00,
  discount_percent DECIMAL(5, 2) DEFAULT 0.00,
  total_price DECIMAL(15, 2) DEFAULT 0.00,
  notes TEXT,
  FOREIGN KEY (deal_id) REFERENCES crm_deals(id) ON DELETE CASCADE,
  INDEX idx_deal_products_deal (deal_id)
);

-- =============================================
-- Lead Scoring Rules
-- =============================================

CREATE TABLE IF NOT EXISTS crm_lead_scoring_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  field VARCHAR(100) NOT NULL,
  operator ENUM('equals', 'not_equals', 'contains', 'greater_than', 'less_than') NOT NULL,
  value VARCHAR(255) NOT NULL,
  score INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO crm_lead_scoring_rules (name, field, operator, value, score) VALUES
('Enterprise Company', 'company_size', 'equals', '1000+', 20),
('Decision Maker', 'job_title', 'contains', 'CEO', 15),
('Decision Maker', 'job_title', 'contains', 'CTO', 15),
('Decision Maker', 'job_title', 'contains', 'VP', 10),
('Has Email', 'email', 'not_equals', '', 5),
('Has Phone', 'phone', 'not_equals', '', 5);
