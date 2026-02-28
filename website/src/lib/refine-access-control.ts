/**
 * Refine Access Control Provider for ERP
 * Handles permission-based access control
 */

import { AccessControlProvider } from "@refinedev/core";

type ERPModule = "finance" | "projects" | "hr" | "crm" | "inventory" | "invoicing" | "settings";
type ERPPermission = "read" | "write" | "delete" | "approve";

// Map resources to modules
const resourceModuleMap: Record<string, ERPModule> = {
  // CRM
  companies: "crm",
  contacts: "crm",
  deals: "crm",
  activities: "crm",
  pipelines: "crm",
  "pipeline-stages": "crm",

  // Finance
  accounts: "finance",
  budgets: "finance",
  categories: "finance",
  expenses: "finance",
  journal: "finance",

  // HR
  employees: "hr",
  departments: "hr",
  positions: "hr",
  "leave-requests": "hr",
  "leave-types": "hr",
  "payroll-runs": "hr",

  // Inventory
  products: "inventory",
  stock: "inventory",
  suppliers: "inventory",
  "inventory-categories": "inventory",
  locations: "inventory",

  // Invoicing
  invoices: "invoicing",
  payments: "invoicing",

  // Projects
  projects: "projects",
  tasks: "projects",
  "time-entries": "projects",
  milestones: "projects",
  "team-members": "projects",

  // Settings
  users: "settings",
  roles: "settings",
  "user-roles": "settings",
  "audit-log": "settings",
  notifications: "settings",
  "notification-types": "settings",
  webhooks: "settings",
};

// Map actions to permissions
const actionPermissionMap: Record<string, ERPPermission> = {
  list: "read",
  show: "read",
  create: "write",
  edit: "write",
  delete: "delete",
  clone: "write",
};

export const erpAccessControlProvider: AccessControlProvider = {
  can: async ({ resource, action, params }) => {
    // Get permissions from localStorage (set during login)
    const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;

    if (!token) {
      return { can: false, reason: "Not authenticated" };
    }

    // Get cached permissions or fetch them
    let permissions: Record<ERPModule, ERPPermission[]> | null = null;

    try {
      const cachedPerms = typeof window !== "undefined"
        ? sessionStorage.getItem("erp_permissions")
        : null;

      if (cachedPerms) {
        permissions = JSON.parse(cachedPerms);
      } else {
        const response = await fetch("/api/erp/auth/permissions", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          permissions = data.permissions;
          if (typeof window !== "undefined") {
            sessionStorage.setItem("erp_permissions", JSON.stringify(permissions));
          }
        }
      }
    } catch {
      return { can: false, reason: "Failed to fetch permissions" };
    }

    if (!permissions) {
      return { can: false, reason: "No permissions found" };
    }

    // Special case for dashboard
    if (resource === "dashboard" || !resource) {
      return { can: true };
    }

    // Get the module for this resource
    const module = resourceModuleMap[resource];
    if (!module) {
      // Unknown resource - allow if user has any permissions
      const hasAnyPermission = Object.values(permissions).some(p => p.length > 0);
      return { can: hasAnyPermission };
    }

    // Get the required permission for this action
    const requiredPermission = actionPermissionMap[action] || "read";

    // Check if user has the required permission
    const modulePermissions = permissions[module] || [];
    const hasPermission = modulePermissions.includes(requiredPermission);

    return {
      can: hasPermission,
      reason: hasPermission ? undefined : `Missing ${requiredPermission} permission for ${module}`,
    };
  },

  options: {
    buttons: {
      enableAccessControl: true,
      hideIfUnauthorized: true,
    },
  },
};

export default erpAccessControlProvider;
