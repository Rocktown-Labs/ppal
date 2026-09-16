import type { AdminAuthClient } from "@better-auth-ui/core/plugins/admin";
import { useSession } from "@better-auth-ui/react";
import {
  useAdminUsers,
  useBanAdminUser,
  useSetAdminUserRole,
  useUnbanAdminUser,
} from "@better-auth-ui/react/plugins/admin";
import { Button } from "@ppal/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ppal/ui/components/card";
import { createFileRoute } from "@tanstack/react-router";
import {
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  UserRound,
  UserRoundCheck,
  UserRoundX,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import type { StripeCatalog, StripeCatalogPrice } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { noIndexMeta } from "@/lib/seo";

const adminAuthClient = authClient as AdminAuthClient;

const formatDate = (value: Date | string): string =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(new Date(value));

const formatPrice = (price: StripeCatalogPrice): string => {
  if (price.amountCents === null || price.currency === null) {
    return "Not configured";
  }
  return new Intl.NumberFormat("en-US", {
    currency: price.currency.toUpperCase(),
    style: "currency",
  }).format(price.amountCents / 100);
};

const statusLabel = (status: StripeCatalogPrice["status"]): string => {
  if (status === "ready") {
    return "Ready";
  }
  if (status === "needs_sync") {
    return "Needs sync";
  }
  return "Missing";
};

const statusClass = (status: StripeCatalogPrice["status"]): string => {
  if (status === "ready") {
    return "text-emerald-300";
  }
  if (status === "needs_sync") {
    return "text-amber-300";
  }
  return "text-rose-300";
};

const StripeCatalogCard = () => {
  const [stripeCatalog, setStripeCatalog] = useState<StripeCatalog | null>(
    null
  );
  const [stripeCatalogError, setStripeCatalogError] = useState<string | null>(
    null
  );
  const [isStripeCatalogSyncing, setIsStripeCatalogSyncing] = useState(false);

  useEffect(() => {
    let active = true;
    const loadStripeCatalog = async () => {
      try {
        const catalog = await api.billing.getStripeCatalog();
        if (active) {
          setStripeCatalog(catalog);
          setStripeCatalogError(null);
        }
      } catch (error) {
        if (active) {
          setStripeCatalogError(
            error instanceof Error
              ? error.message
              : "Unable to read Stripe catalog"
          );
        }
      }
    };
    void loadStripeCatalog();
    return () => {
      active = false;
    };
  }, []);

  const handleStripeCatalogSync = async (): Promise<void> => {
    setIsStripeCatalogSyncing(true);
    try {
      const catalog = await api.billing.syncStripeCatalog();
      setStripeCatalog(catalog);
      setStripeCatalogError(null);
      toast.success("Stripe catalog synced");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Stripe catalog sync failed";
      setStripeCatalogError(message);
      toast.error(message);
      setIsStripeCatalogSyncing(false);
      return;
    }
    setIsStripeCatalogSyncing(false);
  };

  return (
    <Card className="border-white/10 bg-zinc-900/40">
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Stripe catalog</CardTitle>
            <CardDescription>
              Sync the live web subscription products and prices from the
              configured Stripe account. Existing matching prices are reused and
              missing catalog entries are created once.
            </CardDescription>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={isStripeCatalogSyncing}
            onClick={async () => {
              await handleStripeCatalogSync();
            }}
          >
            <RefreshCw
              className={isStripeCatalogSyncing ? "animate-spin" : ""}
            />
            {isStripeCatalogSyncing ? "Syncing…" : "Sync Stripe"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {stripeCatalogError ? (
          <div className="flex items-start gap-3 rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm text-rose-200">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            <p>{stripeCatalogError}</p>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          {stripeCatalog?.plans.map((catalogPlan) => (
            <div
              key={catalogPlan.plan}
              className="rounded-xl border border-white/10 bg-zinc-950/50 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-white capitalize">
                    {catalogPlan.plan}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {catalogPlan.product?.name ?? "Product not found"}
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold ${statusClass(catalogPlan.monthly.status)}`}
                >
                  {statusLabel(catalogPlan.monthly.status)}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                {[catalogPlan.monthly, catalogPlan.annual].map((price) => (
                  <div key={price.interval}>
                    <p className="text-zinc-500 capitalize">{price.interval}</p>
                    <p className="mt-1 font-semibold text-zinc-200">
                      {formatPrice(price)}
                    </p>
                    <p className={`mt-1 ${statusClass(price.status)}`}>
                      {statusLabel(price.status)}
                    </p>
                    {price.id ? (
                      <p className="mt-1 truncate font-mono text-[10px] text-zinc-600">
                        {price.id}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )) ?? (
            <p className="text-sm text-zinc-500">Checking Stripe catalog…</p>
          )}
        </div>

        {stripeCatalog ? (
          <div className="flex flex-col gap-2 border-t border-white/10 pt-4 text-xs text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Secret key:{" "}
              {stripeCatalog.secretConfigured ? "configured" : "missing"}
              {" · "}
              Webhook secret:{" "}
              {stripeCatalog.webhookConfigured ? "configured" : "missing"}
            </span>
            <span className="inline-flex items-center gap-1 font-mono text-[10px] text-zinc-500">
              <ExternalLink className="size-3" />
              {stripeCatalog.webhookUrl}
              {stripeCatalog.webhookConfigured ? (
                <CheckCircle2 className="ml-1 size-3 text-emerald-400" />
              ) : null}
            </span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

const AdminPage = () => {
  const { data: session, isPending: isSessionPending } = useSession(authClient);
  const usersQuery = useAdminUsers(adminAuthClient, {
    params: { limit: 50, sortBy: "createdAt", sortDirection: "desc" },
  });
  const setRoleMutation = useSetAdminUserRole(adminAuthClient);
  const banMutation = useBanAdminUser(adminAuthClient);
  const unbanMutation = useUnbanAdminUser(adminAuthClient);

  const isAdmin = session?.user.role === "admin";
  const users = usersQuery.data?.users ?? [];
  const usersAreLoading = usersQuery.isLoading;
  const usersHaveError = Boolean(usersQuery.error);

  const handleRoleChange = async (
    userId: string,
    role: "admin" | "user"
  ): Promise<void> => {
    try {
      await setRoleMutation.mutateAsync({ userId, role });
      toast.success(`Role updated to ${role}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Role update failed"
      );
    }
  };

  const handleBan = async (userId: string): Promise<void> => {
    try {
      await banMutation.mutateAsync({
        banReason: "Blocked by an administrator",
        userId,
      });
      toast.success("User banned");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ban failed");
    }
  };

  const handleUnban = async (userId: string): Promise<void> => {
    try {
      await unbanMutation.mutateAsync({ userId });
      toast.success("User unbanned");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unban failed");
    }
  };

  if (isSessionPending) {
    return <div className="text-sm text-zinc-500">Checking admin access…</div>;
  }

  if (!isAdmin) {
    return (
      <Card className="border-rose-500/20 bg-rose-500/5">
        <CardHeader>
          <CardTitle>Admin access required</CardTitle>
          <CardDescription>
            This area is protected by Better Auth and is only available to
            administrators.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header>
        <p className="text-xs font-bold tracking-[0.18em] text-emerald-400 uppercase">
          Control room
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
          Admin
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Manage access, roles, and account safety through Better Auth.
        </p>
      </header>

      <Card className="border-emerald-400/20 bg-emerald-400/[0.04]">
        <CardContent className="flex items-center gap-4 p-5">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <p className="font-semibold text-white">Administrator session</p>
            <p className="mt-1 text-sm text-zinc-400">
              {session.user.email} · full Better Auth admin permissions
            </p>
          </div>
        </CardContent>
      </Card>

      <StripeCatalogCard />

      <Card className="border-white/10 bg-zinc-900/40">
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            {usersQuery.data?.total ?? 0} total accounts · role changes apply
            immediately
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {usersAreLoading && (
            <div className="p-6 text-sm text-zinc-500">Loading users…</div>
          )}
          {usersHaveError && (
            <div className="p-6 text-sm text-rose-300">
              {usersQuery.error?.message || "Unable to load users"}
            </div>
          )}
          {!usersAreLoading && !usersHaveError && (
            <div className="divide-y divide-white/10">
              {users.map((user) => {
                const isBanned = user.banned === true;
                const isCurrentUser = user.id === session.user.id;
                return (
                  <div
                    key={user.id}
                    className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/5 text-zinc-400">
                        <UserRound className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-white">
                          {user.name}
                          {isCurrentUser ? " (you)" : ""}
                        </p>
                        <p className="truncate text-sm text-zinc-500">
                          {user.email} · joined {formatDate(user.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      <select
                        aria-label={`Role for ${user.email}`}
                        className="h-9 rounded-lg border border-white/10 bg-zinc-950 px-3 text-xs font-semibold text-zinc-200 outline-none focus:border-emerald-400"
                        disabled={setRoleMutation.isPending || isCurrentUser}
                        value={user.role ?? "user"}
                        onChange={async (event) => {
                          await handleRoleChange(
                            user.id,
                            event.target.value as "admin" | "user"
                          );
                        }}
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                      {isBanned ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={unbanMutation.isPending}
                          onClick={async () => {
                            await handleUnban(user.id);
                          }}
                        >
                          <UserRoundCheck />
                          Unban
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={banMutation.isPending || isCurrentUser}
                          onClick={async () => {
                            await handleBan(user.id);
                          }}
                        >
                          <UserRoundX />
                          Ban
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export const Route = createFileRoute("/dashboard/admin")({
  component: AdminPage,
  head: () => ({ meta: [noIndexMeta] }),
});
