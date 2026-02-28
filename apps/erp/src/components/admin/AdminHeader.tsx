"use client";

import { useState, useEffect } from "react";
import { useGetIdentity, useLogout } from "@refinedev/core";
import { Bell, Search, User, ChevronDown, LogOut, Settings } from "lucide-react";
import Link from "next/link";

interface UserIdentity {
  id: number;
  name: string;
  email: string;
  avatar?: string;
  role?: string;
}

export function AdminHeader() {
  const { data: user } = useGetIdentity<UserIdentity>();
  const { mutate: logout } = useLogout();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Fetch notifications
    const fetchNotifications = async () => {
      try {
        const token = localStorage.getItem("auth_token");
        const response = await fetch("/api/erp/notifications?is_read=false&limit=5", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setNotifications(data.items || []);
          setUnreadCount(data.pagination?.total || 0);
        }
      } catch (error) {
        console.error("Failed to fetch notifications:", error);
      }
    };
    fetchNotifications();
  }, []);

  const handleLogout = () => {
    logout();
    setShowUserMenu(false);
  };

  return (
    <header className="h-16 bg-[#0c0c12] border-b border-white/10 flex items-center justify-between px-6 sticky top-0 z-40">
      {/* Search */}
      <div className="flex-1 max-w-xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
          <input
            type="text"
            placeholder="Search..."
            className="w-full pl-10 pr-4 py-2 bg-[#08080c] border border-white/10 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500/50 text-sm"
          />
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-4">
        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 rounded-full text-xs text-white flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-[#101018] border border-white/10 rounded-xl shadow-xl overflow-hidden">
              <div className="p-3 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-white font-medium">Notifications</h3>
                <Link
                  href="/admin/settings/notifications"
                  className="text-xs text-orange-400 hover:text-orange-300"
                >
                  View all
                </Link>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-zinc-500 text-sm">
                    No new notifications
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className="p-3 border-b border-white/5 hover:bg-white/5 cursor-pointer"
                    >
                      <p className="text-sm text-white">{notification.title}</p>
                      <p className="text-xs text-zinc-500 mt-1">
                        {notification.message}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <User className="w-4 h-4 text-white" />
              )}
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-sm text-white font-medium">
                {user?.name || "Admin"}
              </p>
              <p className="text-xs text-zinc-500">{user?.role || "User"}</p>
            </div>
            <ChevronDown className="w-4 h-4 text-zinc-500" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-[#101018] border border-white/10 rounded-xl shadow-xl overflow-hidden">
              <Link
                href="/admin/settings/users"
                className="flex items-center gap-3 px-4 py-3 text-zinc-400 hover:text-white hover:bg-white/5 transition"
              >
                <Settings className="w-4 h-4" />
                <span className="text-sm">Settings</span>
              </Link>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm">Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default AdminHeader;
