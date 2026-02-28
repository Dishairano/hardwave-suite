"use client";

import { useState } from "react";
import { useList, useDelete } from "@refinedev/core";
import Link from "next/link";
import { Plus, FolderKanban, Calendar, Users, Clock } from "lucide-react";
import { DataTable, Column } from "@/components/admin/DataTable";

interface Project {
  id: number;
  name: string;
  description: string;
  status: string;
  priority: string;
  start_date: string;
  end_date: string;
  budget: number;
  team_count?: number;
  progress?: number;
  created_at: string;
}

export default function ProjectsListPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortField, setSortField] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");

  const { data, isLoading, refetch } = useList<Project>({
    resource: "projects",
    pagination: { current: page, pageSize },
    sorters: [{ field: sortField, order: sortOrder }],
    filters: search
      ? [{ field: "name", operator: "contains", value: search }]
      : [],
  });

  const { mutate: deleteProject } = useDelete();

  const handleDelete = (project: Project) => {
    if (confirm(`Delete "${project.name}"?`)) {
      deleteProject(
        { resource: "projects", id: project.id },
        { onSuccess: () => refetch() }
      );
    }
  };

  const statusColors: Record<string, string> = {
    planning: "bg-blue-500/10 text-blue-400",
    active: "bg-green-500/10 text-green-400",
    on_hold: "bg-yellow-500/10 text-yellow-400",
    completed: "bg-purple-500/10 text-purple-400",
    cancelled: "bg-red-500/10 text-red-400",
  };

  const priorityColors: Record<string, string> = {
    low: "bg-zinc-500/10 text-zinc-400",
    medium: "bg-blue-500/10 text-blue-400",
    high: "bg-orange-500/10 text-orange-400",
    urgent: "bg-red-500/10 text-red-400",
  };

  const columns: Column<Project>[] = [
    {
      key: "name",
      header: "Project",
      sortable: true,
      render: (project) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
            <FolderKanban className="w-5 h-5 text-purple-400" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-white truncate">{project.name}</p>
            <p className="text-xs text-zinc-500 truncate max-w-[200px]">
              {project.description || "No description"}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (project) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            statusColors[project.status] || statusColors.planning
          }`}
        >
          {project.status?.replace("_", " ") || "planning"}
        </span>
      ),
    },
    {
      key: "priority",
      header: "Priority",
      render: (project) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            priorityColors[project.priority] || priorityColors.medium
          }`}
        >
          {project.priority || "medium"}
        </span>
      ),
    },
    {
      key: "progress",
      header: "Progress",
      render: (project) => (
        <div className="w-24">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-zinc-400">{project.progress || 0}%</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-orange-400 rounded-full"
              style={{ width: `${project.progress || 0}%` }}
            />
          </div>
        </div>
      ),
    },
    {
      key: "dates",
      header: "Timeline",
      render: (project) => (
        <div className="text-sm">
          <div className="flex items-center gap-1.5 text-zinc-400">
            <Calendar className="w-3.5 h-3.5" />
            <span>
              {project.start_date
                ? new Date(project.start_date).toLocaleDateString()
                : "—"}
            </span>
          </div>
          {project.end_date && (
            <div className="text-xs text-zinc-500 mt-0.5">
              Due: {new Date(project.end_date).toLocaleDateString()}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "budget",
      header: "Budget",
      sortable: true,
      render: (project) => (
        <span className="text-zinc-300">
          {project.budget
            ? new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
                minimumFractionDigits: 0,
              }).format(project.budget)
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
          <h1 className="text-2xl font-bold text-white">Projects</h1>
          <p className="text-zinc-400 mt-1">Manage your projects and tasks</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/projects/tasks"
            className="flex items-center gap-2 px-4 py-2 border border-white/10 text-zinc-300 hover:text-white hover:bg-white/5 rounded-lg transition"
          >
            <Clock className="w-4 h-4" />
            View Tasks
          </Link>
          <Link
            href="/admin/projects/create"
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition"
          >
            <Plus className="w-4 h-4" />
            New Project
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#101018] border border-white/10 rounded-xl p-4">
          <p className="text-sm text-zinc-400">Total Projects</p>
          <p className="text-2xl font-bold text-white mt-1">
            {data?.total || 0}
          </p>
        </div>
        <div className="bg-[#101018] border border-white/10 rounded-xl p-4">
          <p className="text-sm text-zinc-400">Active</p>
          <p className="text-2xl font-bold text-green-400 mt-1">
            {data?.data?.filter((p) => p.status === "active").length || 0}
          </p>
        </div>
        <div className="bg-[#101018] border border-white/10 rounded-xl p-4">
          <p className="text-sm text-zinc-400">On Hold</p>
          <p className="text-2xl font-bold text-yellow-400 mt-1">
            {data?.data?.filter((p) => p.status === "on_hold").length || 0}
          </p>
        </div>
        <div className="bg-[#101018] border border-white/10 rounded-xl p-4">
          <p className="text-sm text-zinc-400">Completed</p>
          <p className="text-2xl font-bold text-purple-400 mt-1">
            {data?.data?.filter((p) => p.status === "completed").length || 0}
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
        searchPlaceholder="Search projects..."
        isLoading={isLoading}
        actions={{
          show: (p) => `/admin/projects/show/${p.id}`,
          edit: (p) => `/admin/projects/edit/${p.id}`,
          delete: handleDelete,
        }}
      />
    </div>
  );
}
