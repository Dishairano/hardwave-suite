"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AdminSidebar } from "./AdminSidebar";
import { AdminHeader } from "./AdminHeader";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("auth_token");

      if (!token) {
        if (pathname !== "/admin/login") {
          router.push("/admin/login");
        }
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/erp/auth/permissions", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          setIsAuthenticated(true);
          if (pathname === "/admin/login") {
            router.push("/admin");
          }
        } else {
          localStorage.removeItem("auth_token");
          localStorage.removeItem("user");
          if (pathname !== "/admin/login") {
            router.push("/admin/login");
          }
        }
      } catch {
        if (pathname !== "/admin/login") {
          router.push("/admin/login");
        }
      }

      setIsLoading(false);
    };

    checkAuth();
  }, [pathname, router]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#08080c] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
          <p className="text-zinc-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login page without layout
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  // Show authenticated layout
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#08080c] flex">
      <AdminSidebar />
      <div className="flex-1 flex flex-col">
        <AdminHeader />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

export default AdminLayout;
