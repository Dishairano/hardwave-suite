"use client";

import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Filter,
  MoreHorizontal,
  Trash2,
  Edit,
  Eye,
} from "lucide-react";
import Link from "next/link";

export interface Column<T> {
  key: keyof T | string;
  header: string;
  sortable?: boolean;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onSort?: (field: string, order: "asc" | "desc") => void;
  sortField?: string;
  sortOrder?: "asc" | "desc";
  onSearch?: (search: string) => void;
  searchPlaceholder?: string;
  isLoading?: boolean;
  actions?: {
    show?: (item: T) => string;
    edit?: (item: T) => string;
    delete?: (item: T) => void;
    custom?: { label: string; icon?: React.ReactNode; onClick: (item: T) => void }[];
  };
  bulkActions?: {
    label: string;
    icon?: React.ReactNode;
    onClick: (selectedIds: any[]) => void;
    variant?: "default" | "danger";
  }[];
  idField?: keyof T;
}

export function DataTable<T extends { id?: any }>({
  data,
  columns,
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onSort,
  sortField,
  sortOrder,
  onSearch,
  searchPlaceholder = "Search...",
  isLoading,
  actions,
  bulkActions,
  idField = "id" as keyof T,
}: DataTableProps<T>) {
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [searchValue, setSearchValue] = useState("");

  const totalPages = Math.ceil(total / pageSize);

  const handleSelectAll = () => {
    if (selectedItems.length === data.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(data.map((item) => item[idField]));
    }
  };

  const handleSelectItem = (id: any) => {
    if (selectedItems.includes(id)) {
      setSelectedItems(selectedItems.filter((i) => i !== id));
    } else {
      setSelectedItems([...selectedItems, id]);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.(searchValue);
  };

  const getValue = (item: T, key: string): any => {
    const keys = key.split(".");
    let value: any = item;
    for (const k of keys) {
      value = value?.[k];
    }
    return value;
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        {onSearch && (
          <form onSubmit={handleSearch} className="flex-1 max-w-sm">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-9 pr-4 py-2 bg-[#0c0c12] border border-white/10 rounded-lg text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-orange-500/50"
              />
            </div>
          </form>
        )}

        {bulkActions && selectedItems.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-400">
              {selectedItems.length} selected
            </span>
            {bulkActions.map((action, i) => (
              <button
                key={i}
                onClick={() => action.onClick(selectedItems)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition ${
                  action.variant === "danger"
                    ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                    : "bg-white/5 text-zinc-300 hover:bg-white/10"
                }`}
              >
                {action.icon}
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-[#101018] border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                {bulkActions && (
                  <th className="w-12 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedItems.length === data.length && data.length > 0}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded border-white/20 bg-transparent text-orange-500 focus:ring-orange-500/50"
                    />
                  </th>
                )}
                {columns.map((column) => (
                  <th
                    key={String(column.key)}
                    className={`px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider ${column.className || ""}`}
                  >
                    {column.sortable && onSort ? (
                      <button
                        onClick={() =>
                          onSort(
                            String(column.key),
                            sortField === column.key && sortOrder === "asc"
                              ? "desc"
                              : "asc"
                          )
                        }
                        className="flex items-center gap-1 hover:text-white transition"
                      >
                        {column.header}
                        {sortField === column.key ? (
                          sortOrder === "asc" ? (
                            <ArrowUp className="w-3 h-3" />
                          ) : (
                            <ArrowDown className="w-3 h-3" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-50" />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                ))}
                {actions && <th className="w-20 px-4 py-3"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={columns.length + (bulkActions ? 1 : 0) + (actions ? 1 : 0)}
                    className="px-4 py-12 text-center"
                  >
                    <div className="flex items-center justify-center gap-3">
                      <div className="w-5 h-5 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
                      <span className="text-zinc-400">Loading...</span>
                    </div>
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + (bulkActions ? 1 : 0) + (actions ? 1 : 0)}
                    className="px-4 py-12 text-center text-zinc-500"
                  >
                    No data found
                  </td>
                </tr>
              ) : (
                data.map((item, index) => (
                  <tr
                    key={item[idField] || index}
                    className="hover:bg-white/5 transition"
                  >
                    {bulkActions && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedItems.includes(item[idField])}
                          onChange={() => handleSelectItem(item[idField])}
                          className="w-4 h-4 rounded border-white/20 bg-transparent text-orange-500 focus:ring-orange-500/50"
                        />
                      </td>
                    )}
                    {columns.map((column) => (
                      <td
                        key={String(column.key)}
                        className={`px-4 py-3 text-sm text-zinc-300 ${column.className || ""}`}
                      >
                        {column.render
                          ? column.render(item)
                          : getValue(item, String(column.key))}
                      </td>
                    ))}
                    {actions && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {actions.show && (
                            <Link
                              href={actions.show(item)}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition"
                              title="View"
                            >
                              <Eye className="w-4 h-4" />
                            </Link>
                          )}
                          {actions.edit && (
                            <Link
                              href={actions.edit(item)}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </Link>
                          )}
                          {actions.delete && (
                            <button
                              onClick={() => actions.delete?.(item)}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-400">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="px-2 py-1 bg-[#0c0c12] border border-white/10 rounded-lg text-sm text-white focus:outline-none"
            >
              {[10, 20, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-400">
              {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total}
            </span>
            <div className="flex items-center">
              <button
                onClick={() => onPageChange(1)}
                disabled={page === 1}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => onPageChange(page - 1)}
                disabled={page === 1}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => onPageChange(page + 1)}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => onPageChange(totalPages)}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DataTable;
