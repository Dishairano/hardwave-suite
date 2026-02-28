/**
 * Refine Auth Provider for ERP
 * Handles authentication with the ERP system
 */

import { AuthProvider } from "@refinedev/core";

export const erpAuthProvider: AuthProvider = {
  login: async ({ email, password }) => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        return {
          success: false,
          error: {
            name: "Login Error",
            message: data.error || "Invalid credentials",
          },
        };
      }

      const data = await response.json();

      if (data.token) {
        localStorage.setItem("auth_token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
      }

      return {
        success: true,
        redirectTo: "/admin",
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          name: "Login Error",
          message: error.message || "An error occurred during login",
        },
      };
    }
  },

  logout: async () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user");

    return {
      success: true,
      redirectTo: "/admin/login",
    };
  },

  check: async () => {
    const token = localStorage.getItem("auth_token");

    if (!token) {
      return {
        authenticated: false,
        redirectTo: "/admin/login",
      };
    }

    // Verify token with backend
    try {
      const response = await fetch("/api/erp/auth/permissions", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("user");
        return {
          authenticated: false,
          redirectTo: "/admin/login",
        };
      }

      return { authenticated: true };
    } catch {
      return {
        authenticated: false,
        redirectTo: "/admin/login",
      };
    }
  },

  getIdentity: async () => {
    const userStr = localStorage.getItem("user");
    if (!userStr) return null;

    try {
      const user = JSON.parse(userStr);
      return {
        id: user.id,
        name: user.display_name || user.email,
        email: user.email,
        avatar: user.avatar_url,
        role: user.role,
      };
    } catch {
      return null;
    }
  },

  getPermissions: async () => {
    const token = localStorage.getItem("auth_token");
    if (!token) return null;

    try {
      const response = await fetch("/api/erp/auth/permissions", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) return null;

      const data = await response.json();
      return data.permissions;
    } catch {
      return null;
    }
  },

  onError: async (error) => {
    if (error.statusCode === 401) {
      return {
        logout: true,
        redirectTo: "/admin/login",
      };
    }

    return { error };
  },
};

export default erpAuthProvider;
