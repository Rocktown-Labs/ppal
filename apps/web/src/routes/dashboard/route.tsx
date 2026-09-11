import {
  Link,
  Outlet,
  createFileRoute,
  isRedirect,
  redirect,
  useRouterState,
} from "@tanstack/react-router";
import {
  Activity,
  Bell,
  FileUp,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Ticket,
  User,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import { UserButton } from "@/components/auth/user/user-button";
import { api } from "@/lib/api";
import type { CurrentUserWithProfile } from "@/lib/api";
import { authClient } from "@/lib/auth-client";

interface NavItem {
  badge?: string;
  exact?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  to: string;
}

const isNavItemActive = (
  itemTo: string,
  currentPath: string,
  exact?: boolean
): boolean => {
  if (exact || itemTo === "/dashboard") {
    return currentPath === itemTo;
  }
  if (itemTo === "/dashboard/tickets") {
    return (
      currentPath === "/dashboard/tickets" ||
      (currentPath.startsWith("/dashboard/tickets/") &&
        !currentPath.startsWith("/dashboard/tickets/upload"))
    );
  }
  return currentPath === itemTo || currentPath.startsWith(`${itemTo}/`);
};

const handleSignOut = async () => {
  await authClient.signOut();
  window.location.href = "/";
};

const DashboardLayout = () => {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profile, setProfile] = useState<CurrentUserWithProfile | null>(null);

  useEffect(() => {
    let active = true;
    const fetchMe = async () => {
      try {
        const res = await api.community.getMe();
        if (active) {
          setProfile(res.user);
        }
      } catch {
        // profile might not exist yet
      }
    };
    fetchMe();
    return () => {
      active = false;
    };
  }, []);

  const isOnboarding = currentPath === "/dashboard/onboarding";

  if (isOnboarding) {
    return <Outlet />;
  }

  const navItems: NavItem[] = [
    {
      exact: true,
      icon: LayoutDashboard,
      label: "Dashboard",
      to: "/dashboard",
    },
    {
      icon: Ticket,
      label: "My Tickets",
      to: "/dashboard/tickets",
    },
    {
      badge: "AI",
      icon: FileUp,
      label: "Upload Slip",
      to: "/dashboard/tickets/upload",
    },
    {
      icon: Activity,
      label: "Analytics Hub",
      to: "/dashboard/analytics",
    },
    {
      icon: Bell,
      label: "Notifications",
      to: "/dashboard/notifications",
    },
    {
      icon: User,
      label: "My Profile",
      to: "/dashboard/profile",
    },
    {
      icon: Settings,
      label: "Settings",
      to: "/dashboard/settings",
    },
  ];

  const username = profile?.profile?.username;

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 flex-col border-r border-zinc-800/80 bg-zinc-900/50 p-4 lg:flex">
        <div className="flex h-12 items-center px-2">
          <Link to="/dashboard" className="flex items-center gap-2">
            <img
              src="/images/logo.png"
              alt="ParlayPal"
              className="h-9 w-auto max-w-none object-contain"
            />
          </Link>
        </div>

        <nav className="mt-6 flex-1 space-y-1">
          {navItems.map((item) => {
            const isActive = isNavItemActive(item.to, currentPath, item.exact);
            const Icon = item.icon;

            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                  isActive
                    ? "border border-emerald-500/20 bg-emerald-500/10 font-bold text-emerald-400"
                    : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="size-4" />
                  <span>{item.label}</span>
                </div>
                {item.badge ? (
                  <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        {/* Public profile quick link if set */}
        {username ? (
          <div className="mb-3 border-t border-zinc-800/80 pt-3">
            <Link
              to="/u/$username"
              params={{ username }}
              className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 p-2.5 text-xs text-zinc-300 transition hover:border-zinc-700 hover:text-white"
            >
              <span className="truncate">Public Record</span>
              <span className="font-mono text-[11px] text-emerald-400">
                @{username} ↗
              </span>
            </Link>
          </div>
        ) : null}

        {/* User Button */}
        <div className="border-t border-zinc-800/80 pt-3">
          <UserButton
            size="default"
            variant="ghost"
            className="w-full justify-between hover:bg-zinc-800/60"
          />
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile Top Header */}
        <header className="flex h-16 items-center justify-between border-b border-zinc-800/80 bg-zinc-950/80 px-4 backdrop-blur-md lg:hidden">
          <Link to="/dashboard">
            <img
              src="/images/logo.png"
              alt="ParlayPal"
              className="h-8 w-auto object-contain"
            />
          </Link>
          <div className="flex items-center gap-2">
            <UserButton size="icon" variant="ghost" />
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-zinc-400 hover:text-white"
            >
              {mobileMenuOpen ? (
                <X className="size-5" />
              ) : (
                <Menu className="size-5" />
              )}
            </button>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen ? (
          <div className="space-y-2 border-b border-zinc-800 bg-zinc-900/95 p-4 lg:hidden">
            {navItems.map((item) => {
              const isActive = isNavItemActive(
                item.to,
                currentPath,
                item.exact
              );
              const Icon = item.icon;

              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold ${
                    isActive
                      ? "bg-emerald-500/10 font-bold text-emerald-400"
                      : "text-zinc-400"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="size-4" />
                    <span>{item.label}</span>
                  </div>
                </Link>
              );
            })}
            <div className="border-t border-zinc-800 pt-3">
              <button
                type="button"
                onClick={handleSignOut}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-rose-400"
              >
                <LogOut className="size-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        ) : null}

        {/* Page View Slot */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const session = await authClient.getSession();
    if (!session.data) {
      throw redirect({
        to: "/login",
      });
    }

    const isOnboardingPath = location.pathname === "/dashboard/onboarding";

    try {
      const res = await api.community.getMe();
      const hasUsername = Boolean(res.user?.profile?.username?.trim());

      if (!hasUsername && !isOnboardingPath) {
        throw redirect({
          to: "/dashboard/onboarding",
        });
      }

      if (hasUsername && isOnboardingPath) {
        throw redirect({
          to: "/dashboard",
        });
      }

      return { profile: res.user?.profile ?? null, session };
    } catch (error) {
      if (isRedirect(error)) {
        throw error;
      }
      if (!isOnboardingPath) {
        throw redirect({
          to: "/dashboard/onboarding",
        });
      }
      return { profile: null, session };
    }
  },
  component: DashboardLayout,
});
