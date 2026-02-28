/**
 * ERP TypeScript Type Definitions
 */

// =============================================
// Core Types
// =============================================

export type ERPModule = 'finance' | 'projects' | 'hr' | 'crm' | 'inventory' | 'invoicing' | 'settings';
export type ERPPermission = 'read' | 'write' | 'delete' | 'approve';

// =============================================
// Finance Module Types
// =============================================

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export interface FinAccount {
  id: number;
  code: string;
  name: string;
  account_type: AccountType;
  parent_id: number | null;
  description: string | null;
  is_active: boolean;
  opening_balance: number;
  current_balance: number;
  currency: string;
  created_at: Date;
  updated_at: Date;
  children?: FinAccount[];
}

export type JournalEntryStatus = 'draft' | 'posted' | 'reversed';

export interface FinJournalEntry {
  id: number;
  entry_number: string;
  entry_date: Date;
  description: string | null;
  reference: string | null;
  status: JournalEntryStatus;
  total_debit: number;
  total_credit: number;
  created_by: number;
  approved_by: number | null;
  approved_at: Date | null;
  posted_at: Date | null;
  created_at: Date;
  updated_at: Date;
  lines?: FinJournalLine[];
}

export interface FinJournalLine {
  id: number;
  journal_entry_id: number;
  account_id: number;
  account_code?: string;
  account_name?: string;
  description: string | null;
  debit: number;
  credit: number;
  line_order: number;
}

export type ExpenseStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'paid';

export interface FinExpense {
  id: number;
  expense_number: string;
  user_id: number;
  category_id: number | null;
  category_name?: string;
  amount: number;
  currency: string;
  expense_date: Date;
  vendor: string | null;
  description: string | null;
  receipt_url: string | null;
  status: ExpenseStatus;
  submitted_at: Date | null;
  approved_by: number | null;
  approved_at: Date | null;
  rejected_reason: string | null;
  paid_at: Date | null;
  project_id: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface FinExpenseCategory {
  id: number;
  name: string;
  description: string | null;
  account_id: number | null;
  is_active: boolean;
}

export type BudgetStatus = 'draft' | 'active' | 'closed';

export interface FinBudget {
  id: number;
  name: string;
  description: string | null;
  fiscal_year: number;
  start_date: Date;
  end_date: Date;
  status: BudgetStatus;
  total_amount: number;
  created_by: number;
  approved_by: number | null;
  approved_at: Date | null;
  created_at: Date;
  updated_at: Date;
  lines?: FinBudgetLine[];
}

export interface FinBudgetLine {
  id: number;
  budget_id: number;
  account_id: number;
  account_code?: string;
  account_name?: string;
  period_type: 'monthly' | 'quarterly' | 'annual';
  period_number: number;
  budgeted_amount: number;
  actual_amount: number;
  variance: number;
  notes: string | null;
}

// =============================================
// Projects Module Types
// =============================================

export type ProjectStatus = 'draft' | 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
export type ProjectPriority = 'low' | 'medium' | 'high' | 'urgent';
export type ProjectType = 'internal' | 'client' | 'maintenance' | 'research';

export interface Project {
  id: number;
  project_code: string;
  name: string;
  description: string | null;
  client_company_id: number | null;
  client_name?: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  project_type: ProjectType;
  start_date: Date | null;
  target_end_date: Date | null;
  actual_end_date: Date | null;
  budget_amount: number;
  spent_amount: number;
  billable: boolean;
  hourly_rate: number;
  total_hours_estimated: number;
  total_hours_logged: number;
  progress_percent: number;
  manager_id: number | null;
  manager_name?: string;
  created_by: number;
  created_at: Date;
  updated_at: Date;
  team_members?: ProjectTeamMember[];
  milestones?: ProjectMilestone[];
}

export interface ProjectTeamMember {
  id: number;
  project_id: number;
  user_id: number;
  user_name?: string;
  user_email?: string;
  role: string;
  hourly_rate: number;
  allocated_hours: number;
  joined_at: Date;
  left_at: Date | null;
  is_active: boolean;
}

export type MilestoneStatus = 'pending' | 'in_progress' | 'completed' | 'overdue';

export interface ProjectMilestone {
  id: number;
  project_id: number;
  name: string;
  description: string | null;
  due_date: Date | null;
  completed_at: Date | null;
  status: MilestoneStatus;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskType = 'feature' | 'bug' | 'improvement' | 'task' | 'research';

export interface Task {
  id: number;
  project_id: number;
  project_name?: string;
  milestone_id: number | null;
  parent_task_id: number | null;
  task_number: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  task_type: TaskType;
  assignee_id: number | null;
  assignee_name?: string;
  reporter_id: number;
  reporter_name?: string;
  estimated_hours: number;
  actual_hours: number;
  due_date: Date | null;
  started_at: Date | null;
  completed_at: Date | null;
  sort_order: number;
  tags: string[];
  created_at: Date;
  updated_at: Date;
  comments?: TaskComment[];
}

export interface TaskComment {
  id: number;
  task_id: number;
  user_id: number;
  user_name?: string;
  content: string;
  is_internal: boolean;
  edited_at: Date | null;
  created_at: Date;
}

export interface TimeEntry {
  id: number;
  project_id: number;
  project_name?: string;
  task_id: number | null;
  task_title?: string;
  user_id: number;
  user_name?: string;
  description: string | null;
  start_time: Date;
  end_time: Date | null;
  duration_minutes: number;
  billable: boolean;
  billed: boolean;
  invoice_id: number | null;
  hourly_rate: number;
  is_running: boolean;
  created_at: Date;
  updated_at: Date;
}

// =============================================
// HR Module Types
// =============================================

export interface HRDepartment {
  id: number;
  name: string;
  code: string | null;
  description: string | null;
  parent_id: number | null;
  manager_id: number | null;
  manager_name?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  children?: HRDepartment[];
  parent_name?: string;
  employee_count?: number;
}

export interface HRPosition {
  id: number;
  title: string;
  department_id: number | null;
  department_name?: string;
  description: string | null;
  min_salary: number | null;
  max_salary: number | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'intern';
export type EmploymentStatus = 'active' | 'on_leave' | 'terminated' | 'suspended';
export type WorkLocation = 'office' | 'remote' | 'hybrid';
export type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';
export type SalaryFrequency = 'hourly' | 'monthly' | 'annual';

export interface HREmployee {
  id: number;
  user_id: number | null;
  employee_number: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  personal_email: string | null;
  date_of_birth: Date | null;
  gender: Gender | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string;
  department_id: number | null;
  department_name?: string;
  position_id: number | null;
  position_title?: string;
  manager_id: number | null;
  manager_name?: string;
  employment_type: EmploymentType;
  employment_status: EmploymentStatus;
  hire_date: Date;
  termination_date: Date | null;
  probation_end_date: Date | null;
  work_location: WorkLocation;
  salary: number | null;
  salary_frequency: SalaryFrequency;
  currency: string;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_routing_number: string | null;
  tax_id: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relation: string | null;
  notes: string | null;
  profile_photo_url: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface HREmployeeDocument {
  id: number;
  employee_id: number;
  document_type: 'contract' | 'nda' | 'offer_letter' | 'performance_review' | 'certification' | 'other';
  title: string;
  description: string | null;
  document_url: string | null;
  status: 'active' | 'expired' | 'archived';
  issue_date: string | null;
  expiry_date: string | null;
  uploaded_by: number;
  uploaded_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface HRDocumentTemplate {
  id: number;
  name: string;
  document_type: 'contract' | 'nda' | 'offer_letter' | 'performance_review' | 'certification' | 'other';
  title_template: string;
  description_template: string | null;
  content: string | null;
  is_active: boolean;
  created_by: number;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface HRLeaveType {
  id: number;
  name: string;
  code: string | null;
  description: string | null;
  default_days_per_year: number;
  is_paid: boolean;
  requires_approval: boolean;
  is_active: boolean;
  color: string;
}

export interface HRLeaveBalance {
  id: number;
  employee_id: number;
  leave_type_id: number;
  leave_type_name?: string;
  year: number;
  entitled_days: number;
  used_days: number;
  pending_days: number;
  carried_over: number;
  remaining_days: number;
}

export type LeaveRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface HRLeaveRequest {
  id: number;
  employee_id: number;
  employee_name?: string;
  leave_type_id: number;
  leave_type_name?: string;
  start_date: Date;
  end_date: Date;
  days_requested: number;
  is_half_day: boolean;
  half_day_period: 'morning' | 'afternoon' | null;
  reason: string | null;
  status: LeaveRequestStatus;
  approved_by: number | null;
  approved_at: Date | null;
  rejection_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

export type PayrollStatus = 'draft' | 'processing' | 'approved' | 'paid' | 'cancelled';

export interface HRPayrollRun {
  id: number;
  payroll_number: string;
  pay_period_start: Date;
  pay_period_end: Date;
  payment_date: Date;
  status: PayrollStatus;
  total_gross: number;
  total_deductions: number;
  total_net: number;
  employee_count: number;
  notes: string | null;
  created_by: number;
  approved_by: number | null;
  approved_at: Date | null;
  paid_at: Date | null;
  created_at: Date;
  updated_at: Date;
  items?: HRPayrollItem[];
}

export interface HRPayrollItem {
  id: number;
  payroll_run_id: number;
  employee_id: number;
  employee_name?: string;
  base_salary: number;
  hours_worked: number;
  overtime_hours: number;
  overtime_rate: number;
  gross_pay: number;
  federal_tax: number;
  state_tax: number;
  social_security: number;
  medicare: number;
  health_insurance: number;
  retirement_401k: number;
  other_deductions: number;
  total_deductions: number;
  net_pay: number;
  notes: string | null;
}

export type ContractStatus = 'draft' | 'pending_internal' | 'pending_external' | 'completed' | 'revoked' | 'expired';
export type ContractDocumentType = 'nda' | 'employment_contract' | 'vendor_agreement' | 'service_agreement' | 'other';
export type ContractEntityType = 'employee' | 'vendor' | 'project' | 'standalone';

export interface HRContract {
  id: number;
  title: string;
  document_type: ContractDocumentType;
  description: string | null;
  document_url: string | null;
  status: ContractStatus;

  entity_type: ContractEntityType;
  entity_id: number | null;

  internal_signer_id: number | null;
  internal_signer_name?: string;
  internal_signer_email?: string;
  internal_signed_at: string | null;
  internal_signature_data: string | null;
  internal_ip_address: string | null;

  external_signer_name: string | null;
  external_signer_email: string | null;
  external_signed_at: string | null;
  external_signature_data: string | null;
  external_ip_address: string | null;

  sent_to_external_at: string | null;
  last_reminder_sent_at: string | null;
  reminder_count: number;
  signing_token: string | null;
  token_expires_at: string | null;

  signature_positions: {
    internal_signature?: { page: number; x: number; y: number; width: number; height: number };
    internal_date?: { page: number; x: number; y: number };
    external_signature?: { page: number; x: number; y: number; width: number; height: number };
    external_date?: { page: number; x: number; y: number };
  } | null;

  revoked_at: string | null;
  revoked_by: number | null;
  revoke_reason: string | null;

  created_by: number;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

export type ContractAuditAction =
  | 'created'
  | 'uploaded'
  | 'internal_signed'
  | 'sent_to_external'
  | 'external_signed'
  | 'revoked'
  | 'reminder_sent'
  | 'viewed'
  | 'downloaded';

export interface HRContractAuditLog {
  id: number;
  contract_id: number;
  action: ContractAuditAction;
  user_id: number | null;
  user_name: string | null;
  user_email: string | null;
  ip_address: string | null;
  user_agent: string | null;
  notes: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
}

// =============================================
// CRM Module Types
// =============================================

export interface CRMPipeline {
  id: number;
  name: string;
  description: string | null;
  is_default: boolean;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  stages?: CRMPipelineStage[];
}

export interface CRMPipelineStage {
  id: number;
  pipeline_id: number;
  name: string;
  probability: number;
  sort_order: number;
  is_won: boolean;
  is_lost: boolean;
  color: string;
  deal_count?: number;
  total_value?: number;
}

export type CompanySize = '1-10' | '11-50' | '51-200' | '201-500' | '501-1000' | '1000+';

export interface CRMCompany {
  id: number;
  name: string;
  domain: string | null;
  industry: string | null;
  company_size: CompanySize | null;
  annual_revenue: number | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string;
  description: string | null;
  logo_url: string | null;
  linkedin_url: string | null;
  twitter_url: string | null;
  owner_id: number | null;
  owner_name?: string;
  source: string | null;
  tags: string[];
  custom_fields: Record<string, any>;
  created_at: Date;
  updated_at: Date;
  contacts_count?: number;
  deals_count?: number;
}

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'unqualified' | 'converted';

export interface CRMContact {
  id: number;
  company_id: number | null;
  company_name?: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  job_title: string | null;
  department: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  linkedin_url: string | null;
  twitter_url: string | null;
  profile_photo_url: string | null;
  lead_source: string | null;
  lead_status: LeadStatus;
  owner_id: number | null;
  owner_name?: string;
  is_primary_contact: boolean;
  do_not_call: boolean;
  do_not_email: boolean;
  notes: string | null;
  tags: string[];
  custom_fields: Record<string, any>;
  last_contacted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CRMDeal {
  id: number;
  deal_number: string;
  name: string;
  company_id: number | null;
  company_name?: string;
  contact_id: number | null;
  contact_name?: string;
  pipeline_id: number;
  pipeline_name?: string;
  stage_id: number;
  stage_name?: string;
  stage_color?: string;
  owner_id: number | null;
  owner_name?: string;
  amount: number;
  currency: string;
  probability: number;
  expected_close_date: Date | null;
  actual_close_date: Date | null;
  source: string | null;
  description: string | null;
  next_step: string | null;
  lost_reason: string | null;
  competitor: string | null;
  tags: string[];
  custom_fields: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export type ActivityType = 'call' | 'meeting' | 'email' | 'task' | 'note';

export interface CRMActivity {
  id: number;
  activity_type: ActivityType;
  subject: string;
  description: string | null;
  contact_id: number | null;
  contact_name?: string;
  company_id: number | null;
  company_name?: string;
  deal_id: number | null;
  deal_name?: string;
  owner_id: number;
  owner_name?: string;
  assigned_to: number | null;
  assigned_to_name?: string;
  due_date: Date | null;
  completed_at: Date | null;
  duration_minutes: number;
  outcome: string | null;
  priority: 'low' | 'medium' | 'high';
  is_completed: boolean;
  reminder_at: Date | null;
  location: string | null;
  meeting_link: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CRMEmailTemplate {
  id: number;
  name: string;
  subject: string;
  body: string;
  category: string | null;
  is_active: boolean;
  usage_count: number;
  created_by: number;
  created_at: Date;
  updated_at: Date;
}

// =============================================
// Inventory Module Types
// =============================================

export interface InvCategory {
  id: number;
  name: string;
  description: string | null;
  parent_id: number | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  children?: InvCategory[];
  product_count?: number;
}

export type ProductType = 'physical' | 'digital' | 'service';
export type WeightUnit = 'kg' | 'lb' | 'g' | 'oz';
export type DimensionsUnit = 'cm' | 'in' | 'm';

export interface InvProduct {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  category_id: number | null;
  category_name?: string;
  product_type: ProductType;
  unit_of_measure: string;
  cost_price: number;
  selling_price: number;
  currency: string;
  tax_rate: number;
  barcode: string | null;
  weight: number | null;
  weight_unit: WeightUnit;
  dimensions_length: number | null;
  dimensions_width: number | null;
  dimensions_height: number | null;
  dimensions_unit: DimensionsUnit;
  min_stock_level: number;
  max_stock_level: number;
  reorder_point: number;
  reorder_quantity: number;
  lead_time_days: number;
  is_active: boolean;
  is_sellable: boolean;
  is_purchasable: boolean;
  track_inventory: boolean;
  allow_backorder: boolean;
  image_url: string | null;
  tags: string[];
  custom_fields: Record<string, any>;
  created_at: Date;
  updated_at: Date;
  total_stock?: number;
  available_stock?: number;
}

export type LocationType = 'warehouse' | 'store' | 'virtual' | 'transit';

export interface InvLocation {
  id: number;
  code: string;
  name: string;
  description: string | null;
  location_type: LocationType;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string;
  manager_id: number | null;
  manager_name?: string;
  is_active: boolean;
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface InvStock {
  id: number;
  product_id: number;
  product_name?: string;
  product_sku?: string;
  location_id: number;
  location_name?: string;
  quantity_on_hand: number;
  quantity_reserved: number;
  quantity_available: number;
  quantity_incoming: number;
  last_counted_at: Date | null;
  last_movement_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export type StockMovementType = 'receipt' | 'issue' | 'transfer_in' | 'transfer_out' | 'adjustment' | 'return' | 'damage' | 'count';

export interface InvStockMovement {
  id: number;
  product_id: number;
  product_name?: string;
  location_id: number;
  location_name?: string;
  movement_type: StockMovementType;
  quantity: number;
  quantity_before: number;
  quantity_after: number;
  reference_type: string | null;
  reference_id: number | null;
  unit_cost: number | null;
  notes: string | null;
  created_by: number;
  created_by_name?: string;
  created_at: Date;
}

export interface InvSupplier {
  id: number;
  code: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string;
  payment_terms: number;
  currency: string;
  tax_id: string | null;
  notes: string | null;
  is_active: boolean;
  rating: number;
  total_orders: number;
  total_spent: number;
  created_at: Date;
  updated_at: Date;
}

export type PurchaseOrderStatus = 'draft' | 'submitted' | 'confirmed' | 'partial' | 'received' | 'cancelled';
export type PaymentStatus = 'pending' | 'partial' | 'paid';

export interface InvPurchaseOrder {
  id: number;
  po_number: string;
  supplier_id: number;
  supplier_name?: string;
  location_id: number;
  location_name?: string;
  status: PurchaseOrderStatus;
  order_date: Date;
  expected_date: Date | null;
  received_date: Date | null;
  subtotal: number;
  tax_amount: number;
  shipping_cost: number;
  discount_amount: number;
  total_amount: number;
  currency: string;
  payment_terms: number;
  payment_status: PaymentStatus;
  shipping_method: string | null;
  tracking_number: string | null;
  notes: string | null;
  internal_notes: string | null;
  created_by: number;
  approved_by: number | null;
  approved_at: Date | null;
  created_at: Date;
  updated_at: Date;
  items?: InvPurchaseOrderItem[];
}

export interface InvPurchaseOrderItem {
  id: number;
  purchase_order_id: number;
  product_id: number;
  product_name?: string;
  product_sku?: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost: number;
  tax_rate: number;
  discount_percent: number;
  line_total: number;
  notes: string | null;
}

// =============================================
// Invoicing Module Types
// =============================================

export type InvoiceType = 'invoice' | 'quote' | 'credit_note' | 'proforma';
export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'partial' | 'paid' | 'overdue' | 'cancelled' | 'refunded';
export type DiscountType = 'percentage' | 'fixed';

export interface ERPInvoice {
  id: number;
  invoice_number: string;
  invoice_type: InvoiceType;
  company_id: number | null;
  company_name?: string;
  contact_id: number | null;
  contact_name?: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  billing_address_line1: string | null;
  billing_address_line2: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_postal_code: string | null;
  billing_country: string;
  project_id: number | null;
  project_name?: string;
  deal_id: number | null;
  issue_date: Date;
  due_date: Date;
  sent_at: Date | null;
  viewed_at: Date | null;
  paid_at: Date | null;
  subtotal: number;
  discount_type: DiscountType;
  discount_value: number;
  discount_amount: number;
  tax_rate: number;
  tax_amount: number;
  shipping_amount: number;
  total_amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  exchange_rate: number;
  status: InvoiceStatus;
  notes: string | null;
  terms: string | null;
  footer: string | null;
  stripe_invoice_id: string | null;
  stripe_payment_intent_id: string | null;
  payment_link: string | null;
  pdf_url: string | null;
  pdf_generated_at: Date | null;
  created_by: number;
  approved_by: number | null;
  approved_at: Date | null;
  created_at: Date;
  updated_at: Date;
  items?: ERPInvoiceItem[];
  payments?: ERPPayment[];
}

export type InvoiceItemType = 'product' | 'service' | 'time' | 'expense' | 'custom';

export interface ERPInvoiceItem {
  id: number;
  invoice_id: number;
  product_id: number | null;
  time_entry_id: number | null;
  item_type: InvoiceItemType;
  description: string;
  quantity: number;
  unit_price: number;
  unit: string;
  discount_percent: number;
  tax_rate: number;
  line_total: number;
  sort_order: number;
  notes: string | null;
}

export type PaymentMethod = 'cash' | 'check' | 'bank_transfer' | 'credit_card' | 'paypal' | 'stripe' | 'other';
export type PaymentStatusType = 'pending' | 'completed' | 'failed' | 'refunded' | 'cancelled';

export interface ERPPayment {
  id: number;
  payment_number: string;
  invoice_id: number;
  invoice_number?: string;
  amount: number;
  currency: string;
  payment_date: Date;
  payment_method: PaymentMethod;
  reference_number: string | null;
  transaction_id: string | null;
  stripe_payment_id: string | null;
  status: PaymentStatusType;
  notes: string | null;
  received_by: number;
  received_by_name?: string;
  created_at: Date;
  updated_at: Date;
}

// =============================================
// Agenda Module Types
// =============================================

export interface AgendaEvent {
  id: number;
  title: string;
  description: string | null;
  start_datetime: string;
  end_datetime: string | null;
  all_day: boolean;
  color: string;
  module: string | null;
  entity_type: string | null;
  entity_id: number | null;
  created_by: number;
  assigned_to: number | null;
  created_by_name?: string;
  assigned_to_name?: string;
  is_recurring: boolean;
  recurrence_rule: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================
// Common Types
// =============================================

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface SortParams {
  field: string;
  direction: 'asc' | 'desc';
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface DashboardStats {
  finance?: {
    totalRevenue: number;
    totalExpenses: number;
    netIncome: number;
    pendingExpenses: number;
  };
  projects?: {
    totalProjects: number;
    activeProjects: number;
    completedProjects: number;
    overdueTask: number;
    hoursLoggedThisWeek: number;
  };
  hr?: {
    totalEmployees: number;
    activeEmployees: number;
    pendingLeaveRequests: number;
    upcomingPayroll: number;
  };
  crm?: {
    totalContacts: number;
    totalCompanies: number;
    openDeals: number;
    pipelineValue: number;
    dealsWonThisMonth: number;
  };
  inventory?: {
    totalProducts: number;
    lowStockItems: number;
    pendingPurchaseOrders: number;
    totalStockValue: number;
  };
  invoicing?: {
    pendingInvoices: number;
    overdueInvoices: number;
    paidThisMonth: number;
    outstandingAmount: number;
  };
}
