-- Migration: Add profile fields to users table for ERP user management
-- Run: docker exec hardcore_mysql mysql -u root -p'root_pass_2024' fl_organizer_db < migrations/002_add_user_profile_fields.sql
-- Status: APPLIED

ALTER TABLE users
  ADD COLUMN role VARCHAR(50) DEFAULT 'user' AFTER is_admin,
  ADD COLUMN last_login DATETIME NULL AFTER last_login_at,
  ADD COLUMN phone VARCHAR(50) NULL AFTER display_name,
  ADD COLUMN address_line1 VARCHAR(255) NULL AFTER phone,
  ADD COLUMN address_line2 VARCHAR(255) NULL AFTER address_line1,
  ADD COLUMN city VARCHAR(100) NULL AFTER address_line2,
  ADD COLUMN state VARCHAR(100) NULL AFTER city,
  ADD COLUMN postal_code VARCHAR(20) NULL AFTER state,
  ADD COLUMN country VARCHAR(100) NULL AFTER postal_code,
  ADD COLUMN notes TEXT NULL AFTER country;

-- Sync existing admin users
UPDATE users SET role = 'admin' WHERE is_admin = 1;
