"use client";

import { useState } from "react";
import { useList, useDelete } from "@refinedev/core";
import Link from "next/link";
import { Plus, User, Mail, Shield, Calendar } from "lucide-react";
import { DataTable, Column } from "@/components/admin/DataTable";

interface UserRecord {
  id: number;
  email: string;
  display_name: string;
  role: string;
  is_active: boolean;
  last_login_at: string;
  created_at: string;
}

export default function UsersListPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortField, setSortField] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");

  const { data, isLoading, refetch } = useList<UserRecord>({
    resource: "users",
    pagination: { current: page, pageSize },
    sorters: [{ field: sortField, order: sortOrder }],
    filters: search
      ? [{ field: "email", operator: "contains", value: search }]
      : [],
  });

  const { mutate: deleteUser } = useDelete();

  const handleDelete = (user: UserRecord) => {
    if (confirm(`Deactivate user "${user.email}"?`)) {
      deleteUser(
        { resource: "users", id: user.id },
        { onSuccess: () => refetch() }
      );
    }
  };

  const roleColors: Record<string, string> = {
    admin: "bg-red-500/10 text-red-400",
    manager: "bg-purple-500/10 text-purple-400",
    user: "bg-blue-500/10 text-blue-400",
  };

  const columns: Column<UserRecord>[] = [
    {
      key: "name",
      header: "User",
      sortable: true,
      render: (user) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
            <span className="text-white font-medium text-sm">
              {user.display_name?.[0]?.toUpperCase() ||
                user.email[0].toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-medium text-white">
              {user.display_name || "Unnamed User"}
            </p>
            <p className="text-xs text-zinc-500">{user.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (user) => (
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
            roleColors[user.role] || roleColors.user
          }`}
        >
          <Shield className="w-3 h-3" />
          {user.role}
        </span>
      ),
    },
    {
      key: "is_active",
      header: "Status",
      render: (user) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            user.is_active
              ? "bg-green-500/10 text-green-400"
              : "bg-zinc-500/10 text-zinc-400"
          }`}
        >
          {user.is_active ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      key: "last_login_at",
      header: "Last Login",
      sortable: true,
      render: (user) => (
        <span className="text-zinc-400 text-sm">
          {user.last_login_at
            ? new Date(user.last_login_at).toLocaleDateString()
            : "Never"}
        </span>
      ),
    },
    {
      key: "created_at",
      header: "Created",
      sortable: true,
      render: (user) => (
        <span className="text-zinc-400 text-sm">
          {new Date(user.created_at).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Users</h1>
          <p className="text-zinc-400 mt-1">Manage user accounts and access</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/settings/roles"
            className="flex items-center gap-2 px-4 py-2 border border-white/10 text-zinc-300 hover:text-white hover:bg-white/5 rounded-lg transition"
          >
            <Shield className="w-4 h-4" />
            Manage Roles
          </Link>
          <Link
            href="/admin/settings/users/create"
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition"
          >
            <Plus className="w-4 h-4" />
            Add User
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#101018] border border-white/10 rounded-xl p-4">
          <p className="text-sm text-zinc-400">Total Users</p>
          <p className="text-2xl font-bold text-white mt-1">
            {data?.total || 0}
          </p>
        </div>
        <div className="bg-[#101018] border border-white/10 rounded-xl p-4">
          <p className="text-sm text-zinc-400">Active</p>
          <p className="text-2xl font-bold text-green-400 mt-1">
            {data?.data?.filter((u) => u.is_active).length || 0}
          </p>
        </div>
        <div className="bg-[#101018] border border-white/10 rounded-xl p-4">
          <p className="text-sm text-zinc-400">Admins</p>
          <p className="text-2xl font-bold text-red-400 mt-1">
            {data?.data?.filter((u) => u.role === "admin").length || 0}
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
        searchPlaceholder="Search users..."
        isLoading={isLoading}
        actions={{
          show: (u) => `/admin/settings/users/show/${u.id}`,
          edit: (u) => `/admin/settings/users/edit/${u.id}`,
          delete: handleDelete,
        }}
      />
    </div>
  );
}
