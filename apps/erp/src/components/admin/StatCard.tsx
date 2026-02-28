"use client";

import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    label: string;
  };
  icon?: LucideIcon;
  color?: "orange" | "green" | "blue" | "purple" | "red";
  isLoading?: boolean;
}

const colorClasses = {
  orange: {
    bg: "bg-orange-500/10",
    text: "text-orange-400",
    icon: "text-orange-400",
  },
  green: {
    bg: "bg-green-500/10",
    text: "text-green-400",
    icon: "text-green-400",
  },
  blue: {
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    icon: "text-blue-400",
  },
  purple: {
    bg: "bg-purple-500/10",
    text: "text-purple-400",
    icon: "text-purple-400",
  },
  red: {
    bg: "bg-red-500/10",
    text: "text-red-400",
    icon: "text-red-400",
  },
};

export function StatCard({
  title,
  value,
  change,
  icon: Icon,
  color = "orange",
  isLoading,
}: StatCardProps) {
  const colors = colorClasses[color];

  if (isLoading) {
    return (
      <div className="bg-[#101018] border border-white/10 rounded-xl p-6 animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className="h-4 w-24 bg-white/10 rounded" />
          <div className="w-10 h-10 bg-white/10 rounded-lg" />
        </div>
        <div className="h-8 w-32 bg-white/10 rounded mb-2" />
        <div className="h-3 w-20 bg-white/10 rounded" />
      </div>
    );
  }

  return (
    <div className="bg-[#101018] border border-white/10 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-zinc-400">{title}</h3>
        {Icon && (
          <div className={`p-2.5 rounded-lg ${colors.bg}`}>
            <Icon className={`w-5 h-5 ${colors.icon}`} />
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-white mb-1">{value}</p>
      {change && (
        <p className="text-sm">
          <span
            className={
              change.value >= 0 ? "text-green-400" : "text-red-400"
            }
          >
            {change.value >= 0 ? "+" : ""}
            {change.value}%
          </span>{" "}
          <span className="text-zinc-500">{change.label}</span>
        </p>
      )}
    </div>
  );
}

export default StatCard;
