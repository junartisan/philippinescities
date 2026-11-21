"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Search, Users } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import {
  Alert,
  Avatar,
  buttonClass,
  EmptyState,
  inputClass,
  PageLoader,
  selectClass,
} from "@/components/ui";
import { cn, formatDate } from "@/lib/utils";
import type { Role, User } from "@/lib/types";

const roles: Role[] = ["user", "owner", "editor", "supervisor", "admin"];

export default function AdminUsersPage() {
  const { user: currentUser, updateUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (appliedSearch) params.set("search", appliedSearch);
      const query = params.toString();
      const data = await api<User[]>(
        `/api/admin/users${query ? `?${query}` : ""}`,
      );
      setUsers(data);
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [appliedSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedSearch(search.trim());
  }

  async function changeRole(target: User, role: Role) {
    setBusyId(target.id);
    setNotice("");
    try {
      const updated = await api<User>(`/api/admin/users/${target.id}/role`, {
        method: "PATCH",
        body: { role },
      });
      setUsers((previous) =>
        previous.map((user) => (user.id === updated.id ? updated : user)),
      );
      if (currentUser?.id === updated.id) {
        updateUser(updated);
      }
      setNotice(`${updated.full_name} is now ${role}.`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Users</h2>
        <p className="mt-1 text-sm text-slate-500">
          Promote trusted users to owners, editors, supervisors, or admins. You
          cannot change your own role.
        </p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className={cn(inputClass, "pl-9")}
            placeholder="Search by name or email"
          />
        </div>
        <button type="submit" className={buttonClass("secondary")}>
          Search
        </button>
      </form>

      {error ? <Alert>{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      {loading ? (
        <PageLoader label="Loading users…" />
      ) : users.length === 0 ? (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title="No users found"
          description="Try a different search term."
        />
      ) : (
        <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white shadow-sm">
          {users.map((user) => {
            const isSelf = currentUser?.id === user.id;
            return (
              <li
                key={user.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={user.full_name} seed={user.id} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {user.full_name}
                      {isSelf ? (
                        <span className="ml-2 text-xs font-normal text-emerald-700">
                          You
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {user.email} · Joined {formatDate(user.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Role</span>
                  <select
                    className={cn(selectClass, "w-32 py-2")}
                    value={user.role}
                    disabled={isSelf || busyId === user.id}
                    onChange={(event) =>
                      changeRole(user, event.target.value as Role)
                    }
                  >
                    {roles.map((role) => (
                      <option key={role} value={role}>
                        {role.charAt(0).toUpperCase() + role.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
