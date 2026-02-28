"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  Building2,
  Handshake,
  Activity,
  GitBranch,
  DollarSign,
  BookOpen,
  Receipt,
  PieChart,
  FileText,
  UserCircle,
  FolderKanban,
  Briefcase,
  Calendar,
  Package,
  Layers,
  Truck,
  MapPin,
  CreditCard,
  CheckSquare,
  Clock,
  Flag,
  Settings,
  Shield,
  Search,
  Bell,
  ChevronDown,
  ChevronRight,
  LogOut,
} from "lucide-react";

interface MenuItem {
  name: string;
  label: string;
  icon: React.ElementType;
  path?: string;
  children?: { name: string; label: string; path: string }[];
}

const menuItems: MenuItem[] = [
  {
    name: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    path: "/admin",
  },
  {
    name: "crm",
    label: "CRM",
    icon: Users,
    children: [
      { name: "companies", label: "Companies", path: "/admin/crm/companies" },
      { name: "contacts", label: "Contacts", path: "/admin/crm/contacts" },
      { name: "deals", label: "Deals", path: "/admin/crm/deals" },
      { name: "activities", label: "Activities", path: "/admin/crm/activities" },
      { name: "pipelines", label: "Pipelines", path: "/admin/crm/pipelines" },
    ],
  },
  {
    name: "finance",
    label: "Finance",
    icon: DollarSign,
    children: [
      { name: "accounts", label: "Chart of Accounts", path: "/admin/finance/accounts" },
      { name: "expenses", label: "Expenses", path: "/admin/finance/expenses" },
      { name: "budgets", label: "Budgets", path: "/admin/finance/budgets" },
      { name: "journal", label: "Journal Entries", path: "/admin/finance/journal" },
    ],
  },
  {
    name: "hr",
    label: "HR",
    icon: UserCircle,
    children: [
      { name: "employees", label: "Employees", path: "/admin/hr/employees" },
      { name: "departments", label: "Departments", path: "/admin/hr/departments" },
      { name: "positions", label: "Positions", path: "/admin/hr/positions" },
      { name: "leave", label: "Leave Requests", path: "/admin/hr/leave" },
      { name: "payroll", label: "Payroll", path: "/admin/hr/payroll" },
    ],
  },
  {
    name: "inventory",
    label: "Inventory",
    icon: Package,
    children: [
      { name: "products", label: "Products", path: "/admin/inventory/products" },
      { name: "stock", label: "Stock Levels", path: "/admin/inventory/stock" },
      { name: "suppliers", label: "Suppliers", path: "/admin/inventory/suppliers" },
      { name: "locations", label: "Locations", path: "/admin/inventory/locations" },
    ],
  },
  {
    name: "invoicing",
    label: "Invoicing",
    icon: FileText,
    children: [
      { name: "invoices", label: "Invoices", path: "/admin/invoicing" },
      { name: "payments", label: "Payments", path: "/admin/invoicing/payments" },
    ],
  },
  {
    name: "projects",
    label: "Projects",
    icon: FolderKanban,
    children: [
      { name: "projects", label: "Projects", path: "/admin/projects" },
      { name: "tasks", label: "Tasks", path: "/admin/projects/tasks" },
      { name: "time", label: "Time Tracking", path: "/admin/projects/time" },
      { name: "milestones", label: "Milestones", path: "/admin/projects/milestones" },
    ],
  },
  {
    name: "settings",
    label: "Settings",
    icon: Settings,
    children: [
      { name: "users", label: "Users", path: "/admin/settings/users" },
      { name: "roles", label: "Roles", path: "/admin/settings/roles" },
      { name: "audit-log", label: "Audit Log", path: "/admin/settings/audit-log" },
      { name: "notifications", label: "Notifications", path: "/admin/settings/notifications" },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [expandedMenus, setExpandedMenus] = useState<string[]>(["crm", "finance", "hr"]);

  const toggleMenu = (name: string) => {
    setExpandedMenus((prev) =>
      prev.includes(name) ? prev.filter((m) => m !== name) : [...prev, name]
    );
  };

  const isActive = (path: string) => pathname === path;
  const isChildActive = (children: { path: string }[]) =>
    children.some((child) => pathname.startsWith(child.path));

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user");
    window.location.href = "/admin/login";
  };

  return (
    <aside className="w-64 bg-[#0c0c12] border-r border-white/10 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="p-4 border-b border-white/10">
        <Link href="/admin" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
            <span className="text-white font-bold text-lg">H</span>
          </div>
          <div>
            <h1 className="text-white font-bold">Hardwave</h1>
            <p className="text-xs text-zinc-500">ERP System</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {menuItems.map((item) => (
          <div key={item.name}>
            {item.path ? (
              <Link
                href={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition ${
                  isActive(item.path)
                    ? "bg-orange-500/10 text-orange-400"
                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            ) : (
              <>
                <button
                  onClick={() => toggleMenu(item.name)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition ${
                    item.children && isChildActive(item.children)
                      ? "bg-orange-500/10 text-orange-400"
                      : "text-zinc-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="w-5 h-5" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </div>
                  {expandedMenus.includes(item.name) ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
                {item.children && expandedMenus.includes(item.name) && (
                  <div className="ml-4 mt-1 space-y-1 border-l border-white/10 pl-3">
                    {item.children.map((child) => (
                      <Link
                        key={child.name}
                        href={child.path}
                        className={`block px-3 py-2 rounded-lg text-sm transition ${
                          isActive(child.path)
                            ? "bg-orange-500/10 text-orange-400"
                            : "text-zinc-500 hover:text-white hover:bg-white/5"
                        }`}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-white/10">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-sm font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
}

export default AdminSidebar;
