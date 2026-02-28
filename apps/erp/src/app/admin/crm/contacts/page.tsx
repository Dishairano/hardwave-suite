"use client";

import { useState } from "react";
import { useList, useDelete } from "@refinedev/core";
import Link from "next/link";
import { Plus, User, Mail, Phone, Building2 } from "lucide-react";
import { DataTable, Column } from "@/components/admin/DataTable";

interface Contact {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  position: string;
  company_id: number;
  company_name?: string;
  status: string;
  created_at: string;
}

export default function ContactsListPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortField, setSortField] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");

  const { data, isLoading, refetch } = useList<Contact>({
    resource: "contacts",
    pagination: { current: page, pageSize },
    sorters: [{ field: sortField, order: sortOrder }],
    filters: search
      ? [{ field: "name", operator: "contains", value: search }]
      : [],
  });

  const { mutate: deleteContact } = useDelete();

  const handleDelete = (contact: Contact) => {
    if (
      confirm(`Delete "${contact.first_name} ${contact.last_name}"?`)
    ) {
      deleteContact(
        { resource: "contacts", id: contact.id },
        { onSuccess: () => refetch() }
      );
    }
  };

  const columns: Column<Contact>[] = [
    {
      key: "name",
      header: "Contact",
      sortable: true,
      render: (contact) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
            <span className="text-white font-medium text-sm">
              {contact.first_name?.[0]}
              {contact.last_name?.[0]}
            </span>
          </div>
          <div>
            <p className="font-medium text-white">
              {contact.first_name} {contact.last_name}
            </p>
            <p className="text-xs text-zinc-500">{contact.position || "—"}</p>
          </div>
        </div>
      ),
    },
    {
      key: "company_name",
      header: "Company",
      render: (contact) =>
        contact.company_name ? (
          <div className="flex items-center gap-2 text-zinc-300">
            <Building2 className="w-4 h-4 text-zinc-500" />
            {contact.company_name}
          </div>
        ) : (
          <span className="text-zinc-500">—</span>
        ),
    },
    {
      key: "email",
      header: "Email",
      render: (contact) =>
        contact.email ? (
          <a
            href={`mailto:${contact.email}`}
            className="flex items-center gap-1.5 text-orange-400 hover:text-orange-300"
          >
            <Mail className="w-3.5 h-3.5" />
            <span className="text-sm">{contact.email}</span>
          </a>
        ) : (
          <span className="text-zinc-500">—</span>
        ),
    },
    {
      key: "phone",
      header: "Phone",
      render: (contact) =>
        contact.phone ? (
          <div className="flex items-center gap-1.5 text-zinc-400">
            <Phone className="w-3.5 h-3.5" />
            <span className="text-sm">{contact.phone}</span>
          </div>
        ) : (
          <span className="text-zinc-500">—</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      render: (contact) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            contact.status === "active"
              ? "bg-green-500/10 text-green-400"
              : contact.status === "lead"
              ? "bg-blue-500/10 text-blue-400"
              : "bg-zinc-500/10 text-zinc-400"
          }`}
        >
          {contact.status || "active"}
        </span>
      ),
    },
    {
      key: "created_at",
      header: "Created",
      sortable: true,
      render: (contact) => (
        <span className="text-zinc-400 text-sm">
          {new Date(contact.created_at).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Contacts</h1>
          <p className="text-zinc-400 mt-1">Manage your contact database</p>
        </div>
        <Link
          href="/admin/crm/contacts/create"
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition"
        >
          <Plus className="w-4 h-4" />
          Add Contact
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
        searchPlaceholder="Search contacts..."
        isLoading={isLoading}
        actions={{
          show: (c) => `/admin/crm/contacts/show/${c.id}`,
          edit: (c) => `/admin/crm/contacts/edit/${c.id}`,
          delete: handleDelete,
        }}
        bulkActions={[
          {
            label: "Delete",
            variant: "danger",
            onClick: (ids) => {
              if (confirm(`Delete ${ids.length} contacts?`)) {
                ids.forEach((id) =>
                  deleteContact(
                    { resource: "contacts", id },
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
