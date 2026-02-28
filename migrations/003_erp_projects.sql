-- ERP Projects Module Tables
-- Migration: 003_erp_projects.sql
-- Created: 2026-02-14

-- =============================================
-- Projects
-- =============================================

CREATE TABLE IF NOT EXISTS prj_projects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  client_company_id INT NULL,
  status ENUM('draft', 'planning', 'active', 'on_hold', 'completed', 'cancelled') DEFAULT 'draft',
  priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
  project_type ENUM('internal', 'client', 'maintenance', 'research') DEFAULT 'internal',
  start_date DATE,
  target_end_date DATE,
  actual_end_date DATE,
  budget_amount DECIMAL(15, 2) DEFAULT 0.00,
  spent_amount DECIMAL(15, 2) DEFAULT 0.00,
  billable BOOLEAN DEFAULT FALSE,
  hourly_rate DECIMAL(10, 2) DEFAULT 0.00,
  total_hours_estimated DECIMAL(10, 2) DEFAULT 0.00,
  total_hours_logged DECIMAL(10, 2) DEFAULT 0.00,
  progress_percent INT DEFAULT 0,
  manager_id INT,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_projects_status (status),
  INDEX idx_projects_manager (manager_id),
  INDEX idx_projects_dates (start_date, target_end_date)
);

-- =============================================
-- Project Team Members
-- =============================================

CREATE TABLE IF NOT EXISTS prj_team_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  user_id INT NOT NULL,
  role VARCHAR(100) DEFAULT 'member',
  hourly_rate DECIMAL(10, 2) DEFAULT 0.00,
  allocated_hours DECIMAL(10, 2) DEFAULT 0.00,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  left_at TIMESTAMP NULL,
  is_active BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (project_id) REFERENCES prj_projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_project_member (project_id, user_id),
  INDEX idx_team_project (project_id),
  INDEX idx_team_user (user_id)
);

-- =============================================
-- Project Milestones
-- =============================================

CREATE TABLE IF NOT EXISTS prj_milestones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  due_date DATE,
  completed_at TIMESTAMP NULL,
  status ENUM('pending', 'in_progress', 'completed', 'overdue') DEFAULT 'pending',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES prj_projects(id) ON DELETE CASCADE,
  INDEX idx_milestones_project (project_id),
  INDEX idx_milestones_status (status)
);

-- =============================================
-- Tasks (Kanban)
-- =============================================

CREATE TABLE IF NOT EXISTS prj_tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  milestone_id INT NULL,
  parent_task_id INT NULL,
  task_number VARCHAR(20) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status ENUM('backlog', 'todo', 'in_progress', 'review', 'done', 'cancelled') DEFAULT 'todo',
  priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
  task_type ENUM('feature', 'bug', 'improvement', 'task', 'research') DEFAULT 'task',
  assignee_id INT NULL,
  reporter_id INT NOT NULL,
  estimated_hours DECIMAL(10, 2) DEFAULT 0.00,
  actual_hours DECIMAL(10, 2) DEFAULT 0.00,
  due_date DATE NULL,
  started_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  sort_order INT DEFAULT 0,
  tags JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES prj_projects(id) ON DELETE CASCADE,
  FOREIGN KEY (milestone_id) REFERENCES prj_milestones(id) ON DELETE SET NULL,
  FOREIGN KEY (parent_task_id) REFERENCES prj_tasks(id) ON DELETE SET NULL,
  FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (reporter_id) REFERENCES users(id),
  INDEX idx_tasks_project (project_id),
  INDEX idx_tasks_assignee (assignee_id),
  INDEX idx_tasks_status (status),
  INDEX idx_tasks_milestone (milestone_id)
);

-- =============================================
-- Task Comments
-- =============================================

CREATE TABLE IF NOT EXISTS prj_comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  user_id INT NOT NULL,
  content TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT FALSE,
  edited_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES prj_tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_comments_task (task_id)
);

-- =============================================
-- Time Entries
-- =============================================

CREATE TABLE IF NOT EXISTS prj_time_entries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  task_id INT NULL,
  user_id INT NOT NULL,
  description VARCHAR(500),
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NULL,
  duration_minutes INT DEFAULT 0,
  billable BOOLEAN DEFAULT TRUE,
  billed BOOLEAN DEFAULT FALSE,
  invoice_id INT NULL,
  hourly_rate DECIMAL(10, 2) DEFAULT 0.00,
  is_running BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES prj_projects(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES prj_tasks(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_time_project (project_id),
  INDEX idx_time_user (user_id),
  INDEX idx_time_task (task_id),
  INDEX idx_time_dates (start_time, end_time),
  INDEX idx_time_billable (billable, billed)
);

-- =============================================
-- Project Files/Attachments
-- =============================================

CREATE TABLE IF NOT EXISTS prj_attachments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  task_id INT NULL,
  uploaded_by INT NOT NULL,
  filename VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INT DEFAULT 0,
  mime_type VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES prj_projects(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES prj_tasks(id) ON DELETE SET NULL,
  FOREIGN KEY (uploaded_by) REFERENCES users(id),
  INDEX idx_attachments_project (project_id),
  INDEX idx_attachments_task (task_id)
);
