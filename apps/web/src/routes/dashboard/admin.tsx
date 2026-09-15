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
  ShieldCheck,
  UserRound,
  UserRoundCheck,
  UserRoundX,
} from "lucide-react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { noIndexMeta } from "@/lib/seo";

const adminAuthClient = authClient as AdminAuthClient;

const formatDate = (value: Date | string): string =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(new Date(value));

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
