-- ERP Core Infrastructure Tables
-- Migration: 001_erp_core.sql
-- Created: 2026-02-14

-- =============================================
-- ERP Roles & Permissions
-- =============================================

CREATE TABLE IF NOT EXISTS erp_roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(255),
  permissions JSON NOT NULL,
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Default roles
INSERT INTO erp_roles (name, description, permissions, is_system) VALUES
('erp_admin', 'Full ERP access', '{"finance": ["read", "write", "delete", "approve"], "projects": ["read", "write", "delete", "approve"], "hr": ["read", "write", "delete", "approve"], "crm": ["read", "write", "delete"], "inventory": ["read", "write", "delete", "approve"], "invoicing": ["read", "write", "delete", "approve"], "settings": ["read", "write"]}', TRUE),
('finance_manager', 'Finance module full access', '{"finance": ["read", "write", "delete", "approve"], "invoicing": ["read", "write", "approve"]}', TRUE),
('project_manager', 'Projects module full access', '{"projects": ["read", "write", "delete", "approve"]}', TRUE),
('hr_manager', 'HR module full access', '{"hr": ["read", "write", "delete", "approve"]}', TRUE),
('sales_rep', 'CRM read/write access', '{"crm": ["read", "write"]}', TRUE),
('accountant', 'Finance read and journal entry access', '{"finance": ["read", "write"], "invoicing": ["read", "write"]}', TRUE),
('employee', 'Basic employee access', '{"projects": ["read"], "hr": ["read"]}', TRUE);

-- =============================================
-- User Role Assignments
-- =============================================

CREATE TABLE IF NOT EXISTS erp_user_roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  role_id INT NOT NULL,
  module VARCHAR(50),
  granted_by INT,
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NULL,
  is_active BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES erp_roles(id) ON DELETE CASCADE,
  FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY unique_user_role (user_id, role_id)
);

CREATE INDEX idx_erp_user_roles_user ON erp_user_roles(user_id);
CREATE INDEX idx_erp_user_roles_role ON erp_user_roles(role_id);

-- =============================================
-- Audit Log
-- =============================================

CREATE TABLE IF NOT EXISTS erp_audit_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  module VARCHAR(50) NOT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INT,
  old_values JSON,
  new_values JSON,
  ip_address VARCHAR(45),
  user_agent VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_user (user_id),
  INDEX idx_audit_module (module),
  INDEX idx_audit_entity (entity_type, entity_id),
  INDEX idx_audit_created (created_at)
);
