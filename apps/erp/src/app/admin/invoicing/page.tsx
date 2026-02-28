"use client";

import { useState } from "react";
import { useList, useDelete } from "@refinedev/core";
import Link from "next/link";
import {
  Plus,
  FileText,
  Send,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  Download,
} from "lucide-react";
import { DataTable, Column } from "@/components/admin/DataTable";

interface Invoice {
  id: number;
  invoice_number: string;
  company_name?: string;
  contact_name?: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  currency: string;
  status: string;
  issue_date: string;
  due_date: string;
  paid_date?: string;
  created_at: string;
}

export default function InvoicesListPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortField, setSortField] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");

  const { data, isLoading, refetch } = useList<Invoice>({
    resource: "invoices",
    pagination: { current: page, pageSize },
    sorters: [{ field: sortField, order: sortOrder }],
    filters: search
      ? [{ field: "invoice_number", operator: "contains", value: search }]
      : [],
  });

  const { mutate: deleteInvoice } = useDelete();

  const handleDelete = (invoice: Invoice) => {
    if (confirm(`Delete invoice ${invoice.invoice_number}?`)) {
      deleteInvoice(
        { resource: "invoices", id: invoice.id },
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

  const statusConfig: Record<
    string,
    { icon: React.ElementType; color: string; bg: string }
  > = {
    draft: { icon: FileText, color: "text-zinc-400", bg: "bg-zinc-500/10" },
    sent: { icon: Send, color: "text-blue-400", bg: "bg-blue-500/10" },
    pending: { icon: Clock, color: "text-yellow-400", bg: "bg-yellow-500/10" },
    paid: { icon: CheckCircle, color: "text-green-400", bg: "bg-green-500/10" },
    overdue: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/10" },
    cancelled: { icon: XCircle, color: "text-zinc-400", bg: "bg-zinc-500/10" },
  };

  const columns: Column<Invoice>[] = [
    {
      key: "invoice_number",
      header: "Invoice",
      sortable: true,
      render: (invoice) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <p className="font-medium text-white">{invoice.invoice_number}</p>
            <p className="text-xs text-zinc-500">
              {invoice.company_name || invoice.contact_name || "—"}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "total_amount",
      header: "Amount",
      sortable: true,
      render: (invoice) => (
        <span className="font-medium text-white">
          {formatCurrency(invoice.total_amount, invoice.currency)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (invoice) => {
        const config = statusConfig[invoice.status] || statusConfig.draft;
        const Icon = config.icon;
        return (
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.color}`}
          >
            <Icon className="w-3.5 h-3.5" />
            {invoice.status}
          </span>
        );
      },
    },
    {
      key: "issue_date",
      header: "Issue Date",
      sortable: true,
      render: (invoice) => (
        <span className="text-zinc-400 text-sm">
          {new Date(invoice.issue_date).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "due_date",
      header: "Due Date",
      sortable: true,
      render: (invoice) => {
        const isOverdue =
          invoice.status !== "paid" &&
          new Date(invoice.due_date) < new Date();
        return (
          <span
            className={`text-sm ${isOverdue ? "text-red-400" : "text-zinc-400"}`}
          >
            {new Date(invoice.due_date).toLocaleDateString()}
            {isOverdue && " (Overdue)"}
          </span>
        );
      },
    },
  ];

  const totalPending =
    data?.data
      ?.filter((i) => ["sent", "pending", "overdue"].includes(i.status))
      .reduce((sum, i) => sum + i.total_amount, 0) || 0;

  const totalPaid =
    data?.data
      ?.filter((i) => i.status === "paid")
      .reduce((sum, i) => sum + i.total_amount, 0) || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Invoices</h1>
          <p className="text-zinc-400 mt-1">Manage invoices and payments</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/invoicing/payments"
            className="flex items-center gap-2 px-4 py-2 border border-white/10 text-zinc-300 hover:text-white hover:bg-white/5 rounded-lg transition"
          >
            <DollarSign className="w-4 h-4" />
            Payments
          </Link>
          <Link
            href="/admin/invoicing/create"
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition"
          >
            <Plus className="w-4 h-4" />
            New Invoice
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#101018] border border-white/10 rounded-xl p-4">
          <p className="text-sm text-zinc-400">Total Invoices</p>
          <p className="text-2xl font-bold text-white mt-1">
            {data?.total || 0}
          </p>
        </div>
        <div className="bg-[#101018] border border-white/10 rounded-xl p-4">
          <p className="text-sm text-zinc-400">Pending Payment</p>
          <p className="text-2xl font-bold text-yellow-400 mt-1">
            {formatCurrency(totalPending)}
          </p>
        </div>
        <div className="bg-[#101018] border border-white/10 rounded-xl p-4">
          <p className="text-sm text-zinc-400">Paid</p>
          <p className="text-2xl font-bold text-green-400 mt-1">
            {formatCurrency(totalPaid)}
          </p>
        </div>
        <div className="bg-[#101018] border border-white/10 rounded-xl p-4">
          <p className="text-sm text-zinc-400">Overdue</p>
          <p className="text-2xl font-bold text-red-400 mt-1">
            {data?.data?.filter((i) => i.status === "overdue").length || 0}
          </p>
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
        searchPlaceholder="Search invoices..."
        isLoading={isLoading}
        actions={{
          show: (i) => `/admin/invoicing/show/${i.id}`,
          edit: (i) => `/admin/invoicing/edit/${i.id}`,
          delete: handleDelete,
          custom: [
            {
              label: "Download PDF",
              icon: <Download className="w-4 h-4" />,
              onClick: (invoice) => {
                window.open(`/api/erp/invoicing/${invoice.id}/pdf`, "_blank");
              },
            },
          ],
        }}
      />
    </div>
  );
}
