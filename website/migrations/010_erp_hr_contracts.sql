-- ERP HR Contracts & Document Signing System
-- Migration: 010_erp_hr_contracts.sql
-- Created: 2026-02-23

-- =============================================
-- HR Contracts & NDAs
-- =============================================

CREATE TABLE IF NOT EXISTS hr_contracts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  document_type ENUM('nda', 'employment_contract', 'vendor_agreement', 'service_agreement', 'other') NOT NULL,
  description TEXT,
  document_url VARCHAR(500),
  status ENUM('draft', 'pending_internal', 'pending_external', 'completed', 'revoked', 'expired') DEFAULT 'draft',

  -- Entity linking
  entity_type ENUM('employee', 'vendor', 'project', 'standalone') DEFAULT 'standalone',
  entity_id INT,

  -- Internal signer (company representative)
  internal_signer_id INT,
  internal_signed_at DATETIME,
  internal_signature_data TEXT,
  internal_ip_address VARCHAR(45),

  -- External signer (employee, contractor, vendor, etc.)
  external_signer_name VARCHAR(255),
  external_signer_email VARCHAR(255),
  external_signed_at DATETIME,
  external_signature_data TEXT,
  external_ip_address VARCHAR(45),

  -- Signing workflow metadata
  sent_to_external_at DATETIME,
  last_reminder_sent_at DATETIME,
  reminder_count INT DEFAULT 0,
  signing_token VARCHAR(255) UNIQUE,
  token_expires_at DATETIME,

  -- Revocation
  revoked_at DATETIME,
  revoked_by INT,
  revoke_reason TEXT,

  -- Audit
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (internal_signer_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (revoked_by) REFERENCES users(id) ON DELETE SET NULL,

  INDEX idx_contracts_status (status),
  INDEX idx_contracts_entity (entity_type, entity_id),
  INDEX idx_contracts_external_email (external_signer_email),
  INDEX idx_contracts_signing_token (signing_token),
  INDEX idx_contracts_created (created_at)
);

-- =============================================
-- Contract Audit Log
-- =============================================

CREATE TABLE IF NOT EXISTS hr_contract_audit_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  contract_id INT NOT NULL,
  action ENUM('created', 'uploaded', 'internal_signed', 'sent_to_external', 'external_signed', 'revoked', 'reminder_sent', 'viewed', 'downloaded') NOT NULL,
  user_id INT,
  user_name VARCHAR(255),
  user_email VARCHAR(255),
  ip_address VARCHAR(45),
  user_agent TEXT,
  notes TEXT,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (contract_id) REFERENCES hr_contracts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,

  INDEX idx_audit_contract (contract_id),
  INDEX idx_audit_action (action),
  INDEX idx_audit_created (created_at)
);
