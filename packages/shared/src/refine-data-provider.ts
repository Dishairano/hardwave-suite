/**
 * Refine Data Provider for ERP API
 * Custom data provider that connects Refine to the ERP backend
 */

import { DataProvider, HttpError } from "@refinedev/core";

const API_URL = "/api/erp";

// Helper to get auth token
const getAuthHeaders = (): HeadersInit => {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Helper to handle API errors
const handleError = async (response: Response): Promise<never> => {
  const error: HttpError = {
    message: "An error occurred",
    statusCode: response.status,
  };

  try {
    const data = await response.json();
    error.message = data.error || data.message || "An error occurred";
  } catch {
    error.message = response.statusText;
  }

  throw error;
};

// Helper to build query string
const buildQueryString = (params: Record<string, any>): string => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      if (Array.isArray(value)) {
        value.forEach(v => searchParams.append(key, String(v)));
      } else {
        searchParams.append(key, String(value));
      }
    }
  });

  return searchParams.toString();
};

// Resource path mapping
const resourcePaths: Record<string, string> = {
  // CRM
  companies: "crm/companies",
  contacts: "crm/contacts",
  deals: "crm/deals",
  activities: "crm/activities",
  pipelines: "crm/pipelines",
  "pipeline-stages": "crm/pipeline-stages",

  // Finance
  accounts: "finance/accounts",
  budgets: "finance/budgets",
  categories: "finance/categories",
  expenses: "finance/expenses",
  journal: "finance/journal",

  // HR
  employees: "hr/employees",
  departments: "hr/departments",
  positions: "hr/positions",
  "leave-requests": "hr/leave/requests",
  "leave-types": "hr/leave/types",
  "payroll-runs": "hr/payroll/runs",

  // Inventory
  products: "inventory/products",
  stock: "inventory/stock",
  suppliers: "inventory/suppliers",
  "inventory-categories": "inventory/categories",
  locations: "inventory/locations",

  // Invoicing
  invoices: "invoicing",
  payments: "invoicing/payments",

  // Projects
  projects: "projects",
  tasks: "projects/tasks",
  "time-entries": "projects/time",
  milestones: "projects/milestones",
  "team-members": "projects/team",

  // Settings
  users: "settings/users",
  roles: "settings/roles",
  "user-roles": "settings/user-roles",
  "audit-log": "settings/audit-log",

  // Notifications
  notifications: "notifications",
  "notification-types": "notifications/types",
  "notification-preferences": "notifications/preferences",
  webhooks: "notifications/webhooks",
};

const getResourcePath = (resource: string): string => {
  return resourcePaths[resource] || resource;
};

export const erpDataProvider: DataProvider = {
  getApiUrl: () => API_URL,

  getList: async ({ resource, pagination, sorters, filters, meta }) => {
    const path = getResourcePath(resource);
    const { current = 1, pageSize = 20 } = pagination ?? {};

    const queryParams: Record<string, any> = {
      page: current,
      limit: pageSize,
    };

    // Handle sorting
    if (sorters && sorters.length > 0) {
      queryParams.sort_by = sorters[0].field;
      queryParams.sort_order = sorters[0].order;
    }

    // Handle filters
    if (filters) {
      filters.forEach((filter: any) => {
        if ("field" in filter) {
          if (filter.operator === "contains") {
            queryParams.search = filter.value;
          } else if (filter.operator === "eq") {
            queryParams[filter.field] = filter.value;
          } else {
            queryParams[filter.field] = filter.value;
          }
        }
      });
    }

    // Add meta params
    if (meta) {
      Object.assign(queryParams, meta);
    }

    const queryString = buildQueryString(queryParams);
    const url = `${API_URL}/${path}${queryString ? `?${queryString}` : ""}`;

    const response = await fetch(url, {
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      await handleError(response);
    }

    const data = await response.json();

    // Handle different response formats
    if (data.items) {
      return {
        data: data.items,
        total: data.pagination?.total || data.items.length,
      };
    }

    // Handle array responses
    if (Array.isArray(data)) {
      return { data, total: data.length };
    }

    // Handle object with plural key (e.g., { companies: [...] })
    const pluralKey = Object.keys(data).find(key =>
      Array.isArray(data[key]) && !["pagination", "meta"].includes(key)
    );
    if (pluralKey) {
      return {
        data: data[pluralKey],
        total: data.pagination?.total || data[pluralKey].length,
      };
    }

    return { data: [], total: 0 };
  },

  getOne: async ({ resource, id, meta }) => {
    const path = getResourcePath(resource);
    const url = `${API_URL}/${path}/${id}`;

    const response = await fetch(url, {
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      await handleError(response);
    }

    const data = await response.json();

    // Handle { company: {...} } format
    const singularKey = Object.keys(data).find(key =>
      typeof data[key] === "object" && !Array.isArray(data[key]) && key !== "pagination"
    );

    return { data: singularKey ? data[singularKey] : data };
  },

  create: async ({ resource, variables, meta }) => {
    const path = getResourcePath(resource);
    const url = `${API_URL}/${path}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(variables),
    });

    if (!response.ok) {
      await handleError(response);
    }

    const data = await response.json();

    // Extract the created entity from response
    const entityKey = Object.keys(data).find(key =>
      typeof data[key] === "object" && !Array.isArray(data[key]) && key !== "success"
    );

    return { data: entityKey ? data[entityKey] : data };
  },

  update: async ({ resource, id, variables, meta }) => {
    const path = getResourcePath(resource);
    const url = `${API_URL}/${path}/${id}`;

    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(variables),
    });

    if (!response.ok) {
      await handleError(response);
    }

    const data = await response.json();

    const entityKey = Object.keys(data).find(key =>
      typeof data[key] === "object" && !Array.isArray(data[key]) && key !== "success"
    );

    return { data: entityKey ? data[entityKey] : data };
  },

  deleteOne: async ({ resource, id, meta }) => {
    const path = getResourcePath(resource);
    const url = `${API_URL}/${path}/${id}`;

    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      await handleError(response);
    }

    const data = await response.json();
    return { data };
  },

  getMany: async ({ resource, ids, meta }) => {
    // Fetch each item individually and combine
    const promises = ids.map(id =>
      erpDataProvider.getOne({ resource, id, meta })
    );
    const results = await Promise.all(promises);
    return { data: results.map(r => r.data) };
  },

  deleteMany: async ({ resource, ids, meta }) => {
    const path = getResourcePath(resource);

    // Use bulk endpoint if available
    const response = await fetch(`${API_URL}/bulk`, {
      method: "POST",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        entity: resource,
        operation: "delete",
        ids,
      }),
    });

    if (!response.ok) {
      // Fallback to individual deletes
      const promises = ids.map(id =>
        erpDataProvider.deleteOne({ resource, id, meta })
      );
      await Promise.all(promises);
      return { data: ids.map(id => ({ id })) };
    }

    const data = await response.json();
    return { data: ids.map(id => ({ id })) };
  },

  updateMany: async ({ resource, ids, variables, meta }) => {
    // Use bulk endpoint
    const response = await fetch(`${API_URL}/bulk`, {
      method: "POST",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        entity: resource,
        operation: "update",
        ids,
        updates: variables,
      }),
    });

    if (!response.ok) {
      // Fallback to individual updates
      const promises = ids.map(id =>
        erpDataProvider.update({ resource, id, variables, meta })
      );
      const results = await Promise.all(promises);
      return { data: results.map(r => r.data) };
    }

    const data = await response.json();
    return { data: ids.map(id => ({ id, ...variables })) };
  },

  custom: async ({ url, method = "GET", payload, query, headers }) => {
    const queryString = query ? buildQueryString(query) : "";
    const fullUrl = `${url}${queryString ? `?${queryString}` : ""}`;

    const response = await fetch(fullUrl, {
      method,
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
        ...headers,
      },
      body: payload ? JSON.stringify(payload) : undefined,
    });

    if (!response.ok) {
      await handleError(response);
    }

    const data = await response.json();
    return { data };
  },
};

export default erpDataProvider;
