"use client";

import { useState } from "react";
import { useList, useDelete } from "@refinedev/core";
import Link from "next/link";
import { Plus, User, Mail, Briefcase, Building } from "lucide-react";
import { DataTable, Column } from "@/components/admin/DataTable";

interface Employee {
  id: number;
  user_id: number;
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  department_name?: string;
  position_name?: string;
  hire_date: string;
  status: string;
  created_at: string;
}

export default function EmployeesListPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortField, setSortField] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");

  const { data, isLoading, refetch } = useList<Employee>({
    resource: "employees",
    pagination: { current: page, pageSize },
    sorters: [{ field: sortField, order: sortOrder }],
    filters: search
      ? [{ field: "name", operator: "contains", value: search }]
      : [],
  });

  const { mutate: deleteEmployee } = useDelete();

  const handleDelete = (employee: Employee) => {
    if (
      confirm(`Remove "${employee.first_name} ${employee.last_name}" from employees?`)
    ) {
      deleteEmployee(
        { resource: "employees", id: employee.id },
        { onSuccess: () => refetch() }
      );
    }
  };

  const columns: Column<Employee>[] = [
    {
      key: "name",
      header: "Employee",
      sortable: true,
      render: (employee) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
            <span className="text-white font-medium text-sm">
              {employee.first_name?.[0]}
              {employee.last_name?.[0]}
            </span>
          </div>
          <div>
            <p className="font-medium text-white">
              {employee.first_name} {employee.last_name}
            </p>
            <p className="text-xs text-zinc-500">{employee.employee_id}</p>
          </div>
        </div>
      ),
    },
    {
      key: "email",
      header: "Email",
      render: (employee) => (
        <a
          href={`mailto:${employee.email}`}
          className="flex items-center gap-1.5 text-orange-400 hover:text-orange-300"
        >
          <Mail className="w-3.5 h-3.5" />
          <span className="text-sm">{employee.email}</span>
        </a>
      ),
    },
    {
      key: "department_name",
      header: "Department",
      render: (employee) =>
        employee.department_name ? (
          <div className="flex items-center gap-1.5 text-zinc-300">
            <Building className="w-4 h-4 text-zinc-500" />
            {employee.department_name}
          </div>
        ) : (
          <span className="text-zinc-500">—</span>
        ),
    },
    {
      key: "position_name",
      header: "Position",
      render: (employee) =>
        employee.position_name ? (
          <div className="flex items-center gap-1.5 text-zinc-300">
            <Briefcase className="w-4 h-4 text-zinc-500" />
            {employee.position_name}
          </div>
        ) : (
          <span className="text-zinc-500">—</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      render: (employee) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            employee.status === "active"
              ? "bg-green-500/10 text-green-400"
              : employee.status === "on_leave"
              ? "bg-yellow-500/10 text-yellow-400"
              : "bg-zinc-500/10 text-zinc-400"
          }`}
        >
          {employee.status?.replace("_", " ") || "active"}
        </span>
      ),
    },
    {
      key: "hire_date",
      header: "Hire Date",
      sortable: true,
      render: (employee) => (
        <span className="text-zinc-400 text-sm">
          {employee.hire_date
            ? new Date(employee.hire_date).toLocaleDateString()
            : "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Employees</h1>
          <p className="text-zinc-400 mt-1">Manage your team members</p>
        </div>
        <Link
          href="/admin/hr/employees/create"
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition"
        >
          <Plus className="w-4 h-4" />
          Add Employee
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
        searchPlaceholder="Search employees..."
        isLoading={isLoading}
        actions={{
          show: (e) => `/admin/hr/employees/show/${e.id}`,
          edit: (e) => `/admin/hr/employees/edit/${e.id}`,
          delete: handleDelete,
        }}
      />
    </div>
  );
}
