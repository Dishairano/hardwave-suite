"use client";

import { useState, useEffect } from "react";
import { useList, useDelete } from "@refinedev/core";
import Link from "next/link";
import { Plus, Building2, Globe, Mail, Phone } from "lucide-react";
import { DataTable, Column } from "@/components/admin/DataTable";

interface Company {
  id: number;
  name: string;
  industry: string;
  website: string;
  email: string;
  phone: string;
  status: string;
  created_at: string;
}

export default function CompaniesListPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortField, setSortField] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");

  const { data, isLoading, refetch } = useList<Company>({
    resource: "companies",
    pagination: { current: page, pageSize },
    sorters: [{ field: sortField, order: sortOrder }],
    filters: search ? [{ field: "name", operator: "contains", value: search }] : [],
  });

  const { mutate: deleteCompany } = useDelete();

  const handleDelete = (company: Company) => {
    if (confirm(`Delete "${company.name}"?`)) {
      deleteCompany(
        { resource: "companies", id: company.id },
        { onSuccess: () => refetch() }
      );
    }
  };

  const columns: Column<Company>[] = [
    {
      key: "name",
      header: "Company",
      sortable: true,
      render: (company) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <p className="font-medium text-white">{company.name}</p>
            <p className="text-xs text-zinc-500">{company.industry || "—"}</p>
          </div>
        </div>
      ),
    },
    {
      key: "email",
      header: "Contact",
      render: (company) => (
        <div className="space-y-1">
          {company.email && (
            <div className="flex items-center gap-1.5 text-zinc-400">
              <Mail className="w-3.5 h-3.5" />
              <span className="text-sm">{company.email}</span>
            </div>
          )}
          {company.phone && (
            <div className="flex items-center gap-1.5 text-zinc-400">
              <Phone className="w-3.5 h-3.5" />
              <span className="text-sm">{company.phone}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      key: "website",
      header: "Website",
      render: (company) =>
        company.website ? (
          <a
            href={company.website}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-orange-400 hover:text-orange-300"
          >
            <Globe className="w-3.5 h-3.5" />
            <span className="text-sm truncate max-w-[150px]">
              {company.website.replace(/^https?:\/\//, "")}
            </span>
          </a>
        ) : (
          <span className="text-zinc-500">—</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      render: (company) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            company.status === "active"
              ? "bg-green-500/10 text-green-400"
              : company.status === "lead"
              ? "bg-blue-500/10 text-blue-400"
              : "bg-zinc-500/10 text-zinc-400"
          }`}
        >
          {company.status || "active"}
        </span>
      ),
    },
    {
      key: "created_at",
      header: "Created",
      sortable: true,
      render: (company) => (
        <span className="text-zinc-400 text-sm">
          {new Date(company.created_at).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Companies</h1>
          <p className="text-zinc-400 mt-1">
            Manage your company contacts and accounts
          </p>
        </div>
        <Link
          href="/admin/crm/companies/create"
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition"
        >
          <Plus className="w-4 h-4" />
          Add Company
        </Link>
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
        searchPlaceholder="Search companies..."
        isLoading={isLoading}
        actions={{
          show: (c) => `/admin/crm/companies/show/${c.id}`,
          edit: (c) => `/admin/crm/companies/edit/${c.id}`,
          delete: handleDelete,
        }}
        bulkActions={[
          {
            label: "Delete",
            variant: "danger",
            onClick: (ids) => {
              if (confirm(`Delete ${ids.length} companies?`)) {
                ids.forEach((id) =>
                  deleteCompany(
                    { resource: "companies", id },
                    { onSuccess: () => refetch() }
                  )
                );
              }
            },
          },
        ]}
      />
    </div>
  );
}
