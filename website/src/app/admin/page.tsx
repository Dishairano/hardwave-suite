"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  DollarSign,
  Users,
  FolderKanban,
  Package,
  FileText,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { StatCard } from "@/components/admin/StatCard";

interface DashboardData {
  finance: {
    total_revenue: number;
    total_expenses: number;
    net_income: number;
    pending_invoices: number;
  };
  crm: {
    total_contacts: number;
    total_companies: number;
    active_deals: number;
    deals_value: number;
  };
  projects: {
    active_projects: number;
    total_tasks: number;
    completed_tasks: number;
    hours_logged: number;
  };
  hr: {
    total_employees: number;
    pending_leave: number;
    pending_payroll: number;
  };
  inventory: {
    total_products: number;
    low_stock_items: number;
    total_value: number;
  };
}

interface RecentActivity {
  id: number;
  type: string;
  message: string;
  created_at: string;
  user_name: string;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const token = localStorage.getItem("auth_token");
        const headers = { Authorization: `Bearer ${token}` };

        const [reportsRes, auditRes] = await Promise.all([
          fetch("/api/erp/reports", { headers }),
          fetch("/api/erp/settings/audit-log?limit=10", { headers }),
        ]);

        if (reportsRes.ok) {
          const reportsData = await reportsRes.json();
          setData(reportsData);
        }

        if (auditRes.ok) {
          const auditData = await auditRes.json();
          setActivities(auditData.items || []);
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-US").format(num);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-zinc-400 mt-1">
          Welcome back! Here's what's happening with your business.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Revenue"
          value={formatCurrency(data?.finance?.total_revenue || 0)}
          change={{ value: 12.5, label: "vs last month" }}
          icon={DollarSign}
          color="green"
          isLoading={isLoading}
        />
        <StatCard
          title="Active Deals"
          value={formatNumber(data?.crm?.active_deals || 0)}
          change={{ value: 8.2, label: "vs last month" }}
          icon={TrendingUp}
          color="blue"
          isLoading={isLoading}
        />
        <StatCard
          title="Active Projects"
          value={formatNumber(data?.projects?.active_projects || 0)}
          icon={FolderKanban}
          color="purple"
          isLoading={isLoading}
        />
        <StatCard
          title="Team Members"
          value={formatNumber(data?.hr?.total_employees || 0)}
          icon={Users}
          color="orange"
          isLoading={isLoading}
        />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Financial Overview */}
        <div className="lg:col-span-2 space-y-6">
          {/* Finance Summary */}
          <div className="bg-[#101018] border border-white/10 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">
                Financial Overview
              </h2>
              <Link
                href="/admin/finance/accounts"
                className="text-sm text-orange-400 hover:text-orange-300 flex items-center gap-1"
              >
                View details <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-green-500/5 border border-green-500/10 rounded-lg">
                <p className="text-sm text-zinc-400 mb-1">Revenue</p>
                <p className="text-xl font-bold text-green-400">
                  {formatCurrency(data?.finance?.total_revenue || 0)}
                </p>
              </div>
              <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-lg">
                <p className="text-sm text-zinc-400 mb-1">Expenses</p>
                <p className="text-xl font-bold text-red-400">
                  {formatCurrency(data?.finance?.total_expenses || 0)}
                </p>
              </div>
              <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-lg">
                <p className="text-sm text-zinc-400 mb-1">Net Income</p>
                <p className="text-xl font-bold text-blue-400">
                  {formatCurrency(data?.finance?.net_income || 0)}
                </p>
              </div>
            </div>
          </div>

          {/* Projects & Tasks */}
          <div className="bg-[#101018] border border-white/10 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">
                Projects & Tasks
              </h2>
              <Link
                href="/admin/projects"
                className="text-sm text-orange-400 hover:text-orange-300 flex items-center gap-1"
              >
                View all <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-white/5 rounded-lg">
                <FolderKanban className="w-6 h-6 text-purple-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">
                  {data?.projects?.active_projects || 0}
                </p>
                <p className="text-xs text-zinc-500">Active Projects</p>
              </div>
              <div className="text-center p-4 bg-white/5 rounded-lg">
                <FileText className="w-6 h-6 text-blue-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">
                  {data?.projects?.total_tasks || 0}
                </p>
                <p className="text-xs text-zinc-500">Total Tasks</p>
              </div>
              <div className="text-center p-4 bg-white/5 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">
                  {data?.projects?.completed_tasks || 0}
                </p>
                <p className="text-xs text-zinc-500">Completed</p>
              </div>
              <div className="text-center p-4 bg-white/5 rounded-lg">
                <Clock className="w-6 h-6 text-orange-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">
                  {data?.projects?.hours_logged || 0}h
                </p>
                <p className="text-xs text-zinc-500">Hours Logged</p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link
              href="/admin/crm/deals/create"
              className="p-4 bg-[#101018] border border-white/10 rounded-xl hover:border-orange-500/50 transition group"
            >
              <TrendingUp className="w-6 h-6 text-orange-400 mb-2 group-hover:scale-110 transition" />
              <p className="text-sm font-medium text-white">New Deal</p>
            </Link>
            <Link
              href="/admin/invoicing/create"
              className="p-4 bg-[#101018] border border-white/10 rounded-xl hover:border-orange-500/50 transition group"
            >
              <FileText className="w-6 h-6 text-blue-400 mb-2 group-hover:scale-110 transition" />
              <p className="text-sm font-medium text-white">Create Invoice</p>
            </Link>
            <Link
              href="/admin/finance/expenses/create"
              className="p-4 bg-[#101018] border border-white/10 rounded-xl hover:border-orange-500/50 transition group"
            >
              <DollarSign className="w-6 h-6 text-green-400 mb-2 group-hover:scale-110 transition" />
              <p className="text-sm font-medium text-white">Add Expense</p>
            </Link>
            <Link
              href="/admin/projects/create"
              className="p-4 bg-[#101018] border border-white/10 rounded-xl hover:border-orange-500/50 transition group"
            >
              <FolderKanban className="w-6 h-6 text-purple-400 mb-2 group-hover:scale-110 transition" />
              <p className="text-sm font-medium text-white">New Project</p>
            </Link>
          </div>
        </div>

        {/* Right Column - Activity & Alerts */}
        <div className="space-y-6">
          {/* Pending Actions */}
          <div className="bg-[#101018] border border-white/10 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">
              Pending Actions
            </h2>
            <div className="space-y-3">
              {(data?.finance?.pending_invoices || 0) > 0 && (
                <Link
                  href="/admin/invoicing"
                  className="flex items-center gap-3 p-3 bg-yellow-500/5 border border-yellow-500/10 rounded-lg hover:bg-yellow-500/10 transition"
                >
                  <FileText className="w-5 h-5 text-yellow-400" />
                  <div className="flex-1">
                    <p className="text-sm text-white">Pending Invoices</p>
                    <p className="text-xs text-zinc-500">
                      {data?.finance?.pending_invoices} awaiting payment
                    </p>
                  </div>
                </Link>
              )}
              {(data?.hr?.pending_leave || 0) > 0 && (
                <Link
                  href="/admin/hr/leave"
                  className="flex items-center gap-3 p-3 bg-blue-500/5 border border-blue-500/10 rounded-lg hover:bg-blue-500/10 transition"
                >
                  <Clock className="w-5 h-5 text-blue-400" />
                  <div className="flex-1">
                    <p className="text-sm text-white">Leave Requests</p>
                    <p className="text-xs text-zinc-500">
                      {data?.hr?.pending_leave} pending approval
                    </p>
                  </div>
                </Link>
              )}
              {(data?.inventory?.low_stock_items || 0) > 0 && (
                <Link
                  href="/admin/inventory/stock"
                  className="flex items-center gap-3 p-3 bg-red-500/5 border border-red-500/10 rounded-lg hover:bg-red-500/10 transition"
                >
                  <AlertCircle className="w-5 h-5 text-red-400" />
                  <div className="flex-1">
                    <p className="text-sm text-white">Low Stock Alert</p>
                    <p className="text-xs text-zinc-500">
                      {data?.inventory?.low_stock_items} items below threshold
                    </p>
                  </div>
                </Link>
              )}
              {!data?.finance?.pending_invoices &&
                !data?.hr?.pending_leave &&
                !data?.inventory?.low_stock_items && (
                  <p className="text-sm text-zinc-500 text-center py-4">
                    No pending actions
                  </p>
                )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-[#101018] border border-white/10 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">
                Recent Activity
              </h2>
              <Link
                href="/admin/settings/audit-log"
                className="text-sm text-orange-400 hover:text-orange-300"
              >
                View all
              </Link>
            </div>
            <div className="space-y-4">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex gap-3 animate-pulse">
                    <div className="w-8 h-8 bg-white/10 rounded-full" />
                    <div className="flex-1">
                      <div className="h-4 w-3/4 bg-white/10 rounded mb-1" />
                      <div className="h-3 w-1/2 bg-white/10 rounded" />
                    </div>
                  </div>
                ))
              ) : activities.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-4">
                  No recent activity
                </p>
              ) : (
                activities.slice(0, 5).map((activity) => (
                  <div key={activity.id} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                      <Users className="w-4 h-4 text-zinc-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-300 truncate">
                        {activity.message}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {activity.user_name} •{" "}
                        {new Date(activity.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* CRM Summary */}
          <div className="bg-[#101018] border border-white/10 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">CRM Summary</h2>
              <Link
                href="/admin/crm/deals"
                className="text-sm text-orange-400 hover:text-orange-300"
              >
                View deals
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-white">
                  {data?.crm?.total_contacts || 0}
                </p>
                <p className="text-xs text-zinc-500">Contacts</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-white">
                  {data?.crm?.total_companies || 0}
                </p>
                <p className="text-xs text-zinc-500">Companies</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-white/10">
              <p className="text-sm text-zinc-400">Pipeline Value</p>
              <p className="text-xl font-bold text-green-400">
                {formatCurrency(data?.crm?.deals_value || 0)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
