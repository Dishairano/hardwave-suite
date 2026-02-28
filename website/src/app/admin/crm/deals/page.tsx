"use client";

import { useState, useEffect } from "react";
import { useList, useUpdate } from "@refinedev/core";
import Link from "next/link";
import { Plus, DollarSign, Building2, User, GripVertical } from "lucide-react";

interface Deal {
  id: number;
  title: string;
  value: number;
  currency: string;
  stage: string;
  probability: number;
  company_name?: string;
  contact_name?: string;
  expected_close_date: string;
  created_at: string;
}

interface Stage {
  id: string;
  name: string;
  color: string;
}

const stages: Stage[] = [
  { id: "lead", name: "Lead", color: "border-blue-500" },
  { id: "qualified", name: "Qualified", color: "border-purple-500" },
  { id: "proposal", name: "Proposal", color: "border-yellow-500" },
  { id: "negotiation", name: "Negotiation", color: "border-orange-500" },
  { id: "won", name: "Won", color: "border-green-500" },
  { id: "lost", name: "Lost", color: "border-red-500" },
];

export default function DealsPage() {
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [draggedDeal, setDraggedDeal] = useState<Deal | null>(null);

  const { data, isLoading, refetch } = useList<Deal>({
    resource: "deals",
    pagination: { pageSize: 100 },
  });

  const { mutate: updateDeal } = useUpdate();

  const formatCurrency = (amount: number, currency = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getDealsByStage = (stageId: string) => {
    return data?.data?.filter((deal) => deal.stage === stageId) || [];
  };

  const getStageTotal = (stageId: string) => {
    return getDealsByStage(stageId).reduce((sum, deal) => sum + deal.value, 0);
  };

  const handleDragStart = (e: React.DragEvent, deal: Deal) => {
    setDraggedDeal(deal);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetStage: string) => {
    e.preventDefault();
    if (draggedDeal && draggedDeal.stage !== targetStage) {
      updateDeal(
        {
          resource: "deals",
          id: draggedDeal.id,
          values: { stage: targetStage },
        },
        {
          onSuccess: () => refetch(),
        }
      );
    }
    setDraggedDeal(null);
  };

  const totalPipeline =
    data?.data
      ?.filter((d) => !["won", "lost"].includes(d.stage))
      .reduce((sum, d) => sum + d.value, 0) || 0;

  const totalWon =
    data?.data
      ?.filter((d) => d.stage === "won")
      .reduce((sum, d) => sum + d.value, 0) || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Deals Pipeline</h1>
          <p className="text-zinc-400 mt-1">Track and manage your sales deals</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-[#101018] border border-white/10 rounded-lg p-1">
            <button
              onClick={() => setViewMode("kanban")}
              className={`px-3 py-1.5 rounded-md text-sm transition ${
                viewMode === "kanban"
                  ? "bg-orange-500 text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Kanban
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 rounded-md text-sm transition ${
                viewMode === "list"
                  ? "bg-orange-500 text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              List
            </button>
          </div>
          <Link
            href="/admin/crm/deals/create"
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition"
          >
            <Plus className="w-4 h-4" />
            New Deal
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#101018] border border-white/10 rounded-xl p-4">
          <p className="text-sm text-zinc-400">Total Pipeline</p>
          <p className="text-2xl font-bold text-white mt-1">
            {formatCurrency(totalPipeline)}
          </p>
        </div>
        <div className="bg-[#101018] border border-white/10 rounded-xl p-4">
          <p className="text-sm text-zinc-400">Deals Won</p>
          <p className="text-2xl font-bold text-green-400 mt-1">
            {formatCurrency(totalWon)}
          </p>
        </div>
        <div className="bg-[#101018] border border-white/10 rounded-xl p-4">
          <p className="text-sm text-zinc-400">Active Deals</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">
            {data?.data?.filter((d) => !["won", "lost"].includes(d.stage)).length ||
              0}
          </p>
        </div>
        <div className="bg-[#101018] border border-white/10 rounded-xl p-4">
          <p className="text-sm text-zinc-400">Win Rate</p>
          <p className="text-2xl font-bold text-purple-400 mt-1">
            {data?.data?.length
              ? Math.round(
                  (data.data.filter((d) => d.stage === "won").length /
                    data.data.filter((d) =>
                      ["won", "lost"].includes(d.stage)
                    ).length) *
                    100
                ) || 0
              : 0}
            %
          </p>
        </div>
      </div>

      {/* Kanban Board */}
      {viewMode === "kanban" && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => (
            <div
              key={stage.id}
              className={`flex-shrink-0 w-72 bg-[#0c0c12] rounded-xl border-t-2 ${stage.color}`}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, stage.id)}
            >
              <div className="p-4 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-white">{stage.name}</h3>
                  <span className="px-2 py-0.5 bg-white/10 rounded-full text-xs text-zinc-400">
                    {getDealsByStage(stage.id).length}
                  </span>
                </div>
                <p className="text-sm text-zinc-500 mt-1">
                  {formatCurrency(getStageTotal(stage.id))}
                </p>
              </div>
              <div className="p-2 space-y-2 min-h-[200px] max-h-[calc(100vh-400px)] overflow-y-auto">
                {isLoading ? (
                  <div className="animate-pulse space-y-2">
                    {[1, 2].map((i) => (
                      <div
                        key={i}
                        className="h-24 bg-white/5 rounded-lg"
                      />
                    ))}
                  </div>
                ) : (
                  getDealsByStage(stage.id).map((deal) => (
                    <div
                      key={deal.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, deal)}
                      className={`p-3 bg-[#101018] border border-white/10 rounded-lg cursor-grab hover:border-white/20 transition ${
                        draggedDeal?.id === deal.id ? "opacity-50" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={`/admin/crm/deals/show/${deal.id}`}
                          className="font-medium text-white hover:text-orange-400 truncate flex-1"
                        >
                          {deal.title}
                        </Link>
                        <GripVertical className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                      </div>
                      <p className="text-lg font-bold text-green-400 mt-2">
                        {formatCurrency(deal.value, deal.currency)}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
                        {deal.company_name && (
                          <div className="flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            <span className="truncate max-w-[80px]">
                              {deal.company_name}
                            </span>
                          </div>
                        )}
                        {deal.contact_name && (
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            <span className="truncate max-w-[80px]">
                              {deal.contact_name}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-xs text-zinc-500">
                          {deal.probability}% probability
                        </span>
                        {deal.expected_close_date && (
                          <span className="text-xs text-zinc-500">
                            {new Date(deal.expected_close_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List View */}
      {viewMode === "list" && (
        <div className="bg-[#101018] border border-white/10 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">
                  Deal
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">
                  Value
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">
                  Stage
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">
                  Company
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">
                  Close Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <div className="flex items-center justify-center gap-3">
                      <div className="w-5 h-5 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
                      <span className="text-zinc-400">Loading...</span>
                    </div>
                  </td>
                </tr>
              ) : (
                data?.data?.map((deal) => (
                  <tr key={deal.id} className="hover:bg-white/5">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/crm/deals/show/${deal.id}`}
                        className="font-medium text-white hover:text-orange-400"
                      >
                        {deal.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-medium text-green-400">
                      {formatCurrency(deal.value, deal.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          stages.find((s) => s.id === deal.stage)?.color.replace(
                            "border",
                            "bg"
                          ) + "/10"
                        } ${
                          stages
                            .find((s) => s.id === deal.stage)
                            ?.color.replace("border", "text")
                        }`}
                      >
                        {stages.find((s) => s.id === deal.stage)?.name || deal.stage}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      {deal.company_name || "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      {deal.expected_close_date
                        ? new Date(deal.expected_close_date).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
