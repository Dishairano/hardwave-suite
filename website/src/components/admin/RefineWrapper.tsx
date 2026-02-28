"use client";

import { Refine } from "@refinedev/core";
import routerProvider from "@refinedev/nextjs-router";
import { erpDataProvider } from "@/lib/refine-data-provider";
import { erpAuthProvider } from "@/lib/refine-auth-provider";
import { erpAccessControlProvider } from "@/lib/refine-access-control";
import { erpResources } from "@/lib/refine-resources";
import { AdminLayout } from "./AdminLayout";

interface RefineWrapperProps {
  children: React.ReactNode;
}

export function RefineWrapper({ children }: RefineWrapperProps) {
  return (
    <Refine
      dataProvider={erpDataProvider}
      authProvider={erpAuthProvider}
      accessControlProvider={erpAccessControlProvider}
      routerProvider={routerProvider}
      resources={erpResources}
      options={{
        syncWithLocation: true,
        warnWhenUnsavedChanges: true,
        useNewQueryKeys: true,
        projectId: "hardwave-erp",
        title: {
          text: "Hardwave ERP",
          icon: "🎵",
        },
      }}
    >
      <AdminLayout>{children}</AdminLayout>
    </Refine>
  );
}

export default RefineWrapper;
