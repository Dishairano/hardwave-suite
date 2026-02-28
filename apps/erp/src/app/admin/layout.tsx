"use client";

import dynamic from "next/dynamic";

const RefineWrapper = dynamic(
  () => import("@/components/admin/RefineWrapper").then((mod) => mod.RefineWrapper),
  { ssr: false }
);

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RefineWrapper>{children}</RefineWrapper>;
}
