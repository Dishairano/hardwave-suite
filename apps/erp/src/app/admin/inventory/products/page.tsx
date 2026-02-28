"use client";

import { useState } from "react";
import { useList, useDelete } from "@refinedev/core";
import Link from "next/link";
import { Plus, Package, AlertTriangle, DollarSign } from "lucide-react";
import { DataTable, Column } from "@/components/admin/DataTable";

interface Product {
  id: number;
  sku: string;
  name: string;
  description: string;
  category_name?: string;
  unit_price: number;
  cost_price: number;
  stock_quantity?: number;
  min_stock_level: number;
  status: string;
  created_at: string;
}

export default function ProductsListPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortField, setSortField] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");

  const { data, isLoading, refetch } = useList<Product>({
    resource: "products",
    pagination: { current: page, pageSize },
    sorters: [{ field: sortField, order: sortOrder }],
    filters: search
      ? [{ field: "name", operator: "contains", value: search }]
      : [],
  });

  const { mutate: deleteProduct } = useDelete();

  const handleDelete = (product: Product) => {
    if (confirm(`Delete "${product.name}"?`)) {
      deleteProduct(
        { resource: "products", id: product.id },
        { onSuccess: () => refetch() }
      );
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const columns: Column<Product>[] = [
    {
      key: "name",
      header: "Product",
      sortable: true,
      render: (product) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
            <Package className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <p className="font-medium text-white">{product.name}</p>
            <p className="text-xs text-zinc-500">SKU: {product.sku}</p>
          </div>
        </div>
      ),
    },
    {
      key: "category_name",
      header: "Category",
      render: (product) => (
        <span className="text-zinc-300">
          {product.category_name || "Uncategorized"}
        </span>
      ),
    },
    {
      key: "unit_price",
      header: "Price",
      sortable: true,
      render: (product) => (
        <span className="font-medium text-white">
          {formatCurrency(product.unit_price)}
        </span>
      ),
    },
    {
      key: "cost_price",
      header: "Cost",
      render: (product) => (
        <span className="text-zinc-400">
          {formatCurrency(product.cost_price)}
        </span>
      ),
    },
    {
      key: "stock_quantity",
      header: "Stock",
      render: (product) => {
        const isLow =
          (product.stock_quantity || 0) < (product.min_stock_level || 10);
        return (
          <div className="flex items-center gap-2">
            <span
              className={`font-medium ${
                isLow ? "text-red-400" : "text-zinc-300"
              }`}
            >
              {product.stock_quantity ?? "—"}
            </span>
            {isLow && (
              <AlertTriangle className="w-4 h-4 text-red-400" title="Low stock" />
            )}
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (product) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            product.status === "active"
              ? "bg-green-500/10 text-green-400"
              : product.status === "discontinued"
              ? "bg-red-500/10 text-red-400"
              : "bg-zinc-500/10 text-zinc-400"
          }`}
        >
          {product.status || "active"}
        </span>
      ),
    },
  ];

  const lowStockCount =
    data?.data?.filter(
      (p) => (p.stock_quantity || 0) < (p.min_stock_level || 10)
    ).length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Products</h1>
          <p className="text-zinc-400 mt-1">Manage your product catalog</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/inventory/stock"
            className="flex items-center gap-2 px-4 py-2 border border-white/10 text-zinc-300 hover:text-white hover:bg-white/5 rounded-lg transition"
          >
            View Stock Levels
          </Link>
          <Link
            href="/admin/inventory/products/create"
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#101018] border border-white/10 rounded-xl p-4">
          <p className="text-sm text-zinc-400">Total Products</p>
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
          <p className="text-sm text-zinc-400">Low Stock</p>
          <p className="text-2xl font-bold text-red-400 mt-1">{lowStockCount}</p>
        </div>
        <div className="bg-[#101018] border border-white/10 rounded-xl p-4">
          <p className="text-sm text-zinc-400">Total Value</p>
          <p className="text-2xl font-bold text-orange-400 mt-1">
            {formatCurrency(
              data?.data?.reduce(
                (sum, p) => sum + (p.unit_price * (p.stock_quantity || 0)),
                0
              ) || 0
            )}
          </p>
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStockCount > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <div>
            <p className="text-white font-medium">Low Stock Alert</p>
            <p className="text-sm text-zinc-400">
              {lowStockCount} products are below minimum stock level
            </p>
          </div>
          <Link
            href="/admin/inventory/stock?filter=low"
            className="ml-auto px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-sm hover:bg-red-500/30 transition"
          >
            View Items
          </Link>
        </div>
      )}

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
        searchPlaceholder="Search products..."
        isLoading={isLoading}
        actions={{
          show: (p) => `/admin/inventory/products/show/${p.id}`,
          edit: (p) => `/admin/inventory/products/edit/${p.id}`,
          delete: handleDelete,
        }}
      />
    </div>
  );
}
