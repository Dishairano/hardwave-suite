/**
 * Refine Resources Configuration for ERP
 * Defines all resources available in the admin panel
 */

import { ResourceProps } from "@refinedev/core";

export const erpResources: ResourceProps[] = [
  // Dashboard
  {
    name: "dashboard",
    list: "/admin",
    meta: {
      label: "Dashboard",
      icon: "dashboard",
    },
  },

  // CRM Module
  {
    name: "companies",
    list: "/admin/crm/companies",
    create: "/admin/crm/companies/create",
    edit: "/admin/crm/companies/edit/:id",
    show: "/admin/crm/companies/show/:id",
    meta: {
      label: "Companies",
      parent: "crm",
      icon: "building",
    },
  },
  {
    name: "contacts",
    list: "/admin/crm/contacts",
    create: "/admin/crm/contacts/create",
    edit: "/admin/crm/contacts/edit/:id",
    show: "/admin/crm/contacts/show/:id",
    meta: {
      label: "Contacts",
      parent: "crm",
      icon: "users",
    },
  },
  {
    name: "deals",
    list: "/admin/crm/deals",
    create: "/admin/crm/deals/create",
    edit: "/admin/crm/deals/edit/:id",
    show: "/admin/crm/deals/show/:id",
    meta: {
      label: "Deals",
      parent: "crm",
      icon: "handshake",
    },
  },
  {
    name: "activities",
    list: "/admin/crm/activities",
    create: "/admin/crm/activities/create",
    edit: "/admin/crm/activities/edit/:id",
    meta: {
      label: "Activities",
      parent: "crm",
      icon: "activity",
    },
  },
  {
    name: "pipelines",
    list: "/admin/crm/pipelines",
    create: "/admin/crm/pipelines/create",
    edit: "/admin/crm/pipelines/edit/:id",
    meta: {
      label: "Pipelines",
      parent: "crm",
      icon: "git-branch",
    },
  },

  // Finance Module
  {
    name: "accounts",
    list: "/admin/finance/accounts",
    create: "/admin/finance/accounts/create",
    edit: "/admin/finance/accounts/edit/:id",
    show: "/admin/finance/accounts/show/:id",
    meta: {
      label: "Chart of Accounts",
      parent: "finance",
      icon: "book",
    },
  },
  {
    name: "expenses",
    list: "/admin/finance/expenses",
    create: "/admin/finance/expenses/create",
    edit: "/admin/finance/expenses/edit/:id",
    show: "/admin/finance/expenses/show/:id",
    meta: {
      label: "Expenses",
      parent: "finance",
      icon: "receipt",
    },
  },
  {
    name: "budgets",
    list: "/admin/finance/budgets",
    create: "/admin/finance/budgets/create",
    edit: "/admin/finance/budgets/edit/:id",
    meta: {
      label: "Budgets",
      parent: "finance",
      icon: "pie-chart",
    },
  },
  {
    name: "journal",
    list: "/admin/finance/journal",
    create: "/admin/finance/journal/create",
    show: "/admin/finance/journal/show/:id",
    meta: {
      label: "Journal Entries",
      parent: "finance",
      icon: "file-text",
    },
  },

  // HR Module
  {
    name: "employees",
    list: "/admin/hr/employees",
    create: "/admin/hr/employees/create",
    edit: "/admin/hr/employees/edit/:id",
    show: "/admin/hr/employees/show/:id",
    meta: {
      label: "Employees",
      parent: "hr",
      icon: "user",
    },
  },
  {
    name: "departments",
    list: "/admin/hr/departments",
    create: "/admin/hr/departments/create",
    edit: "/admin/hr/departments/edit/:id",
    meta: {
      label: "Departments",
      parent: "hr",
      icon: "folder",
    },
  },
  {
    name: "positions",
    list: "/admin/hr/positions",
    create: "/admin/hr/positions/create",
    edit: "/admin/hr/positions/edit/:id",
    meta: {
      label: "Positions",
      parent: "hr",
      icon: "briefcase",
    },
  },
  {
    name: "leave-requests",
    list: "/admin/hr/leave",
    create: "/admin/hr/leave/create",
    edit: "/admin/hr/leave/edit/:id",
    show: "/admin/hr/leave/show/:id",
    meta: {
      label: "Leave Requests",
      parent: "hr",
      icon: "calendar",
    },
  },
  {
    name: "payroll-runs",
    list: "/admin/hr/payroll",
    create: "/admin/hr/payroll/create",
    show: "/admin/hr/payroll/show/:id",
    meta: {
      label: "Payroll",
      parent: "hr",
      icon: "dollar-sign",
    },
  },

  // Inventory Module
  {
    name: "products",
    list: "/admin/inventory/products",
    create: "/admin/inventory/products/create",
    edit: "/admin/inventory/products/edit/:id",
    show: "/admin/inventory/products/show/:id",
    meta: {
      label: "Products",
      parent: "inventory",
      icon: "package",
    },
  },
  {
    name: "stock",
    list: "/admin/inventory/stock",
    meta: {
      label: "Stock Levels",
      parent: "inventory",
      icon: "layers",
    },
  },
  {
    name: "suppliers",
    list: "/admin/inventory/suppliers",
    create: "/admin/inventory/suppliers/create",
    edit: "/admin/inventory/suppliers/edit/:id",
    show: "/admin/inventory/suppliers/show/:id",
    meta: {
      label: "Suppliers",
      parent: "inventory",
      icon: "truck",
    },
  },
  {
    name: "locations",
    list: "/admin/inventory/locations",
    create: "/admin/inventory/locations/create",
    edit: "/admin/inventory/locations/edit/:id",
    meta: {
      label: "Locations",
      parent: "inventory",
      icon: "map-pin",
    },
  },

  // Invoicing Module
  {
    name: "invoices",
    list: "/admin/invoicing",
    create: "/admin/invoicing/create",
    edit: "/admin/invoicing/edit/:id",
    show: "/admin/invoicing/show/:id",
    meta: {
      label: "Invoices",
      parent: "invoicing",
      icon: "file-invoice",
    },
  },
  {
    name: "payments",
    list: "/admin/invoicing/payments",
    create: "/admin/invoicing/payments/create",
    meta: {
      label: "Payments",
      parent: "invoicing",
      icon: "credit-card",
    },
  },

  // Projects Module
  {
    name: "projects",
    list: "/admin/projects",
    create: "/admin/projects/create",
    edit: "/admin/projects/edit/:id",
    show: "/admin/projects/show/:id",
    meta: {
      label: "Projects",
      parent: "projects",
      icon: "folder-kanban",
    },
  },
  {
    name: "tasks",
    list: "/admin/projects/tasks",
    create: "/admin/projects/tasks/create",
    edit: "/admin/projects/tasks/edit/:id",
    show: "/admin/projects/tasks/show/:id",
    meta: {
      label: "Tasks",
      parent: "projects",
      icon: "check-square",
    },
  },
  {
    name: "time-entries",
    list: "/admin/projects/time",
    create: "/admin/projects/time/create",
    meta: {
      label: "Time Tracking",
      parent: "projects",
      icon: "clock",
    },
  },
  {
    name: "milestones",
    list: "/admin/projects/milestones",
    create: "/admin/projects/milestones/create",
    edit: "/admin/projects/milestones/edit/:id",
    meta: {
      label: "Milestones",
      parent: "projects",
      icon: "flag",
    },
  },

  // Settings Module
  {
    name: "users",
    list: "/admin/settings/users",
    create: "/admin/settings/users/create",
    edit: "/admin/settings/users/edit/:id",
    show: "/admin/settings/users/show/:id",
    meta: {
      label: "Users",
      parent: "settings",
      icon: "users",
    },
  },
  {
    name: "roles",
    list: "/admin/settings/roles",
    create: "/admin/settings/roles/create",
    edit: "/admin/settings/roles/edit/:id",
    meta: {
      label: "Roles",
      parent: "settings",
      icon: "shield",
    },
  },
  {
    name: "audit-log",
    list: "/admin/settings/audit-log",
    meta: {
      label: "Audit Log",
      parent: "settings",
      icon: "file-search",
    },
  },
  {
    name: "notifications",
    list: "/admin/settings/notifications",
    meta: {
      label: "Notifications",
      parent: "settings",
      icon: "bell",
    },
  },
];

// Menu structure for sidebar
export const menuStructure = [
  {
    name: "dashboard",
    label: "Dashboard",
    icon: "LayoutDashboard",
    path: "/admin",
  },
  {
    name: "crm",
    label: "CRM",
    icon: "Users",
    children: ["companies", "contacts", "deals", "activities", "pipelines"],
  },
  {
    name: "finance",
    label: "Finance",
    icon: "DollarSign",
    children: ["accounts", "expenses", "budgets", "journal"],
  },
  {
    name: "hr",
    label: "HR",
    icon: "UserCircle",
    children: ["employees", "departments", "positions", "leave-requests", "payroll-runs"],
  },
  {
    name: "inventory",
    label: "Inventory",
    icon: "Package",
    children: ["products", "stock", "suppliers", "locations"],
  },
  {
    name: "invoicing",
    label: "Invoicing",
    icon: "FileText",
    children: ["invoices", "payments"],
  },
  {
    name: "projects",
    label: "Projects",
    icon: "FolderKanban",
    children: ["projects", "tasks", "time-entries", "milestones"],
  },
  {
    name: "settings",
    label: "Settings",
    icon: "Settings",
    children: ["users", "roles", "audit-log", "notifications"],
  },
];

export default erpResources;
