"use client";

import { useState } from "react";
import { useList, useDelete } from "@refinedev/core";
import Link from "next/link";
import { Plus, Receipt, DollarSign, CheckCircle, Clock, XCircle } from "lucide-react";
import { DataTable, Column } from "@/components/admin/DataTable";

interface Expense {
  id: number;
  description: string;
  amount: number;
  currency: string;
  category_name?: string;
  submitted_by_name?: string;
  status: string;
  expense_date: string;
  created_at: string;
}

export default function ExpensesListPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortField, setSortField] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");

  const { data, isLoading, refetch } = useList<Expense>({
    resource: "expenses",
    pagination: { current: page, pageSize },
    sorters: [{ field: sortField, order: sortOrder }],
    filters: search
      ? [{ field: "description", operator: "contains", value: search }]
      : [],
  });

  const { mutate: deleteExpense } = useDelete();

  const handleDelete = (expense: Expense) => {
    if (confirm("Delete this expense?")) {
      deleteExpense(
        { resource: "expenses", id: expense.id },
        { onSuccess: () => refetch() }
      );
    }
  };

  const formatCurrency = (amount: number, currency = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount);
  };

  const statusConfig: Record<string, { icon: React.ElementType; color: string }> = {
    pending: { icon: Clock, color: "bg-yellow-500/10 text-yellow-400" },
    approved: { icon: CheckCircle, color: "bg-green-500/10 text-green-400" },
    rejected: { icon: XCircle, color: "bg-red-500/10 text-red-400" },
  };

  const columns: Column<Expense>[] = [
    {
      key: "description",
      header: "Expense",
      sortable: true,
      render: (expense) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
            <Receipt className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <p className="font-medium text-white truncate max-w-[200px]">
              {expense.description}
            </p>
            <p className="text-xs text-zinc-500">
              {expense.category_name || "Uncategorized"}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      sortable: true,
      render: (expense) => (
        <span className="font-medium text-white">
          {formatCurrency(expense.amount, expense.currency)}
        </span>
      ),
    },
    {
      key: "submitted_by_name",
      header: "Submitted By",
      render: (expense) => (
        <span className="text-zinc-300">
          {expense.submitted_by_name || "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (expense) => {
        const config = statusConfig[expense.status] || statusConfig.pending;
        const Icon = config.icon;
        return (
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}
          >
            <Icon className="w-3.5 h-3.5" />
            {expense.status}
          </span>
        );
      },
    },
    {
      key: "expense_date",
      header: "Date",
      sortable: true,
      render: (expense) => (
        <span className="text-zinc-400 text-sm">
          {new Date(expense.expense_date).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Expenses</h1>
          <p className="text-zinc-400 mt-1">
            Track and manage expense submissions
          </p>
        </div>
        <Link
          href="/admin/finance/expenses/create"
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition"
        >
          <Plus className="w-4 h-4" />
          Add Expense
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#101018] border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/10 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-400">Pending</p>
              <p className="text-lg font-semibold text-white">
                {data?.data?.filter((e) => e.status === "pending").length || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-[#101018] border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-400">Approved</p>
              <p className="text-lg font-semibold text-white">
                {data?.data?.filter((e) => e.status === "approved").length || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-[#101018] border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-zinc-400">Total This Month</p>
              <p className="text-lg font-semibold text-white">
                {formatCurrency(
                  data?.data?.reduce((sum, e) => sum + e.amount, 0) || 0
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <DataTable
        data={data?.data || []}
        columns={columns}
        total={data?.total || 0}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
        onSort={(field, order) => {
          setSortField(field);
          setSortOrder(order);
        }}
        sortField={sortField}
        sortOrder={sortOrder}
        onSearch={setSearch}
        searchPlaceholder="Search expenses..."
        isLoading={isLoading}
        actions={{
          show: (e) => `/admin/finance/expenses/show/${e.id}`,
          edit: (e) => `/admin/finance/expenses/edit/${e.id}`,
          delete: handleDelete,
        }}
      />
    </div>
  );
}
