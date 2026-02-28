-- ERP Foreign Keys and Cross-Module References
-- Migration: 008_erp_foreign_keys.sql
-- Created: 2026-02-14
-- Note: Run this after all other ERP migrations

-- =============================================
-- Add Foreign Keys for Cross-Module References
-- =============================================

-- Link expenses to projects
ALTER TABLE fin_expenses
ADD CONSTRAINT fk_expenses_project
FOREIGN KEY (project_id) REFERENCES prj_projects(id) ON DELETE SET NULL;

-- Link projects to CRM companies
ALTER TABLE prj_projects
ADD CONSTRAINT fk_projects_company
FOREIGN KEY (client_company_id) REFERENCES crm_companies(id) ON DELETE SET NULL;

-- Link time entries to invoices
ALTER TABLE prj_time_entries
ADD CONSTRAINT fk_time_invoice
FOREIGN KEY (invoice_id) REFERENCES erp_invoices(id) ON DELETE SET NULL;

-- Link department managers to employees
ALTER TABLE hr_departments
ADD CONSTRAINT fk_departments_manager
FOREIGN KEY (manager_id) REFERENCES hr_employees(id) ON DELETE SET NULL;

-- =============================================
-- Create Helpful Views
-- =============================================

-- Project summary view with hours and budget
CREATE OR REPLACE VIEW erp_project_summary_view AS
SELECT
  p.id,
  p.project_code,
  p.name,
  p.status,
  p.budget_amount,
  p.spent_amount,
  p.total_hours_estimated,
  p.total_hours_logged,
  p.progress_percent,
  p.start_date,
  p.target_end_date,
  c.name AS client_name,
  u.display_name AS manager_name,
  (SELECT COUNT(*) FROM prj_tasks WHERE project_id = p.id) AS total_tasks,
  (SELECT COUNT(*) FROM prj_tasks WHERE project_id = p.id AND status = 'done') AS completed_tasks,
  (SELECT COUNT(*) FROM prj_team_members WHERE project_id = p.id AND is_active = TRUE) AS team_size
FROM prj_projects p
LEFT JOIN crm_companies c ON p.client_company_id = c.id
LEFT JOIN users u ON p.manager_id = u.id;

-- Employee leave summary view
CREATE OR REPLACE VIEW erp_leave_summary_view AS
SELECT
  e.id AS employee_id,
  e.employee_number,
  CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
  lt.name AS leave_type,
  lb.year,
  lb.entitled_days,
  lb.used_days,
  lb.pending_days,
  lb.remaining_days
FROM hr_employees e
CROSS JOIN hr_leave_types lt
LEFT JOIN hr_leave_balances lb ON e.id = lb.employee_id AND lt.id = lb.leave_type_id
WHERE e.employment_status = 'active';

-- Deal pipeline value view
CREATE OR REPLACE VIEW erp_pipeline_value_view AS
SELECT
  p.id AS pipeline_id,
  p.name AS pipeline_name,
  ps.id AS stage_id,
  ps.name AS stage_name,
  ps.probability,
  ps.sort_order,
  COUNT(d.id) AS deal_count,
  COALESCE(SUM(d.amount), 0) AS total_value,
  COALESCE(SUM(d.amount * ps.probability / 100), 0) AS weighted_value
FROM crm_pipelines p
JOIN crm_pipeline_stages ps ON p.id = ps.pipeline_id
LEFT JOIN crm_deals d ON ps.id = d.stage_id
WHERE ps.is_lost = FALSE
GROUP BY p.id, p.name, ps.id, ps.name, ps.probability, ps.sort_order
ORDER BY p.id, ps.sort_order;

-- Stock alert view (low stock)
CREATE OR REPLACE VIEW erp_low_stock_view AS
SELECT
  p.id AS product_id,
  p.sku,
  p.name AS product_name,
  l.code AS location_code,
  l.name AS location_name,
  s.quantity_on_hand,
  s.quantity_reserved,
  s.quantity_available,
  p.min_stock_level,
  p.reorder_point,
  p.reorder_quantity,
  CASE
    WHEN s.quantity_available <= 0 THEN 'out_of_stock'
    WHEN s.quantity_available <= p.min_stock_level THEN 'critical'
    WHEN s.quantity_available <= p.reorder_point THEN 'low'
    ELSE 'ok'
  END AS stock_status
FROM inv_products p
JOIN inv_stock s ON p.id = s.product_id
JOIN inv_locations l ON s.location_id = l.id
WHERE p.track_inventory = TRUE
  AND p.is_active = TRUE
  AND s.quantity_available <= p.reorder_point;

-- Invoice aging view
CREATE OR REPLACE VIEW erp_invoice_aging_view AS
SELECT
  i.id,
  i.invoice_number,
  i.customer_name,
  i.issue_date,
  i.due_date,
  i.total_amount,
  i.amount_paid,
  i.amount_due,
  i.status,
  DATEDIFF(CURRENT_DATE, i.due_date) AS days_overdue,
  CASE
    WHEN i.status = 'paid' THEN 'paid'
    WHEN DATEDIFF(CURRENT_DATE, i.due_date) <= 0 THEN 'current'
    WHEN DATEDIFF(CURRENT_DATE, i.due_date) <= 30 THEN '1-30 days'
    WHEN DATEDIFF(CURRENT_DATE, i.due_date) <= 60 THEN '31-60 days'
    WHEN DATEDIFF(CURRENT_DATE, i.due_date) <= 90 THEN '61-90 days'
    ELSE '90+ days'
  END AS aging_bucket
FROM erp_invoices i
WHERE i.status NOT IN ('cancelled', 'refunded', 'draft');

-- Financial summary view (P&L style)
CREATE OR REPLACE VIEW erp_financial_summary_view AS
SELECT
  a.account_type,
  a.code,
  a.name,
  a.current_balance,
  YEAR(CURRENT_DATE) AS fiscal_year
FROM fin_accounts a
WHERE a.is_active = TRUE
ORDER BY a.account_type, a.code;

-- =============================================
-- Triggers for Auto-Updates
-- =============================================

DELIMITER //

-- Update project hours when time entry is added/updated
CREATE TRIGGER trg_time_entry_after_insert
AFTER INSERT ON prj_time_entries
FOR EACH ROW
BEGIN
  UPDATE prj_projects
  SET total_hours_logged = (
    SELECT COALESCE(SUM(duration_minutes) / 60.0, 0)
    FROM prj_time_entries
    WHERE project_id = NEW.project_id
  ),
  updated_at = NOW()
  WHERE id = NEW.project_id;
END//

CREATE TRIGGER trg_time_entry_after_update
AFTER UPDATE ON prj_time_entries
FOR EACH ROW
BEGIN
  UPDATE prj_projects
  SET total_hours_logged = (
    SELECT COALESCE(SUM(duration_minutes) / 60.0, 0)
    FROM prj_time_entries
    WHERE project_id = NEW.project_id
  ),
  updated_at = NOW()
  WHERE id = NEW.project_id;
END//

-- Update invoice totals when items change
CREATE TRIGGER trg_invoice_items_after_insert
AFTER INSERT ON erp_invoice_items
FOR EACH ROW
BEGIN
  UPDATE erp_invoices
  SET subtotal = (
    SELECT COALESCE(SUM(line_total), 0)
    FROM erp_invoice_items
    WHERE invoice_id = NEW.invoice_id
  ),
  updated_at = NOW()
  WHERE id = NEW.invoice_id;
END//

CREATE TRIGGER trg_invoice_items_after_update
AFTER UPDATE ON erp_invoice_items
FOR EACH ROW
BEGIN
  UPDATE erp_invoices
  SET subtotal = (
    SELECT COALESCE(SUM(line_total), 0)
    FROM erp_invoice_items
    WHERE invoice_id = NEW.invoice_id
  ),
  updated_at = NOW()
  WHERE id = NEW.invoice_id;
END//

CREATE TRIGGER trg_invoice_items_after_delete
AFTER DELETE ON erp_invoice_items
FOR EACH ROW
BEGIN
  UPDATE erp_invoices
  SET subtotal = (
    SELECT COALESCE(SUM(line_total), 0)
    FROM erp_invoice_items
    WHERE invoice_id = OLD.invoice_id
  ),
  updated_at = NOW()
  WHERE id = OLD.invoice_id;
END//

-- Update payment totals on invoice
CREATE TRIGGER trg_payments_after_insert
AFTER INSERT ON erp_payments
FOR EACH ROW
BEGIN
  UPDATE erp_invoices
  SET amount_paid = (
    SELECT COALESCE(SUM(amount), 0)
    FROM erp_payments
    WHERE invoice_id = NEW.invoice_id AND status = 'completed'
  ),
  status = CASE
    WHEN (SELECT COALESCE(SUM(amount), 0) FROM erp_payments WHERE invoice_id = NEW.invoice_id AND status = 'completed') >= total_amount THEN 'paid'
    WHEN (SELECT COALESCE(SUM(amount), 0) FROM erp_payments WHERE invoice_id = NEW.invoice_id AND status = 'completed') > 0 THEN 'partial'
    ELSE status
  END,
  paid_at = CASE
    WHEN (SELECT COALESCE(SUM(amount), 0) FROM erp_payments WHERE invoice_id = NEW.invoice_id AND status = 'completed') >= total_amount THEN NOW()
    ELSE paid_at
  END,
  updated_at = NOW()
  WHERE id = NEW.invoice_id;
END//

-- Update stock levels on movement
CREATE TRIGGER trg_stock_movement_after_insert
AFTER INSERT ON inv_stock_movements
FOR EACH ROW
BEGIN
  UPDATE inv_stock
  SET quantity_on_hand = NEW.quantity_after,
      last_movement_at = NOW(),
      updated_at = NOW()
  WHERE product_id = NEW.product_id AND location_id = NEW.location_id;
END//

-- Update purchase order totals
CREATE TRIGGER trg_po_items_after_insert
AFTER INSERT ON inv_purchase_order_items
FOR EACH ROW
BEGIN
  UPDATE inv_purchase_orders
  SET subtotal = (
    SELECT COALESCE(SUM(line_total), 0)
    FROM inv_purchase_order_items
    WHERE purchase_order_id = NEW.purchase_order_id
  ),
  updated_at = NOW()
  WHERE id = NEW.purchase_order_id;
END//

DELIMITER ;

-- =============================================
-- Stored Procedures
-- =============================================

DELIMITER //

-- Generate next sequence number
CREATE PROCEDURE sp_get_next_sequence(
  IN p_sequence_type VARCHAR(50),
  OUT p_next_number VARCHAR(50)
)
BEGIN
  DECLARE v_prefix VARCHAR(10);
  DECLARE v_number INT;
  DECLARE v_padding INT;

  SELECT prefix, next_number, padding
  INTO v_prefix, v_number, v_padding
  FROM erp_sequences
  WHERE sequence_type = p_sequence_type
  FOR UPDATE;

  SET p_next_number = CONCAT(v_prefix, LPAD(v_number, v_padding, '0'));

  UPDATE erp_sequences
  SET next_number = next_number + 1,
      updated_at = NOW()
  WHERE sequence_type = p_sequence_type;
END//

-- Post journal entry and update account balances
CREATE PROCEDURE sp_post_journal_entry(
  IN p_journal_entry_id INT,
  IN p_user_id INT
)
BEGIN
  DECLARE v_entry_date DATE;
  DECLARE v_total_debit DECIMAL(15,2);
  DECLARE v_total_credit DECIMAL(15,2);

  -- Get entry details
  SELECT entry_date, total_debit, total_credit
  INTO v_entry_date, v_total_debit, v_total_credit
  FROM fin_journal_entries
  WHERE id = p_journal_entry_id AND status = 'draft';

  -- Verify debits = credits
  IF v_total_debit != v_total_credit THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Journal entry is not balanced';
  END IF;

  -- Update account balances
  UPDATE fin_accounts a
  JOIN fin_journal_lines jl ON a.id = jl.account_id
  SET a.current_balance = a.current_balance +
    CASE a.account_type
      WHEN 'asset' THEN jl.debit - jl.credit
      WHEN 'expense' THEN jl.debit - jl.credit
      ELSE jl.credit - jl.debit
    END
  WHERE jl.journal_entry_id = p_journal_entry_id;

  -- Mark entry as posted
  UPDATE fin_journal_entries
  SET status = 'posted',
      approved_by = p_user_id,
      approved_at = NOW(),
      posted_at = NOW()
  WHERE id = p_journal_entry_id;
END//

DELIMITER ;
