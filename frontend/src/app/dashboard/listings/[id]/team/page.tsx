"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Mail, ShieldCheck, Trash2, Users, X } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import {
  Alert,
  Badge,
  buttonClass,
  EmptyState,
  Field,
  inputClass,
  PageLoader,
  selectClass,
  Spinner,
  textareaClass,
} from "@/components/ui";
import { formatDate } from "@/lib/utils";
import type {
  Business,
  BusinessInvitation,
  BusinessTeamMember,
  BusinessTeamRole,
} from "@/lib/types";

const ROLE_LABELS: Record<BusinessTeamRole, string> = {
  corporate_admin: "Corporate admin",
  branch_manager: "Branch manager",
  staff: "Branch staff",
};

export default function BusinessTeamPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [business, setBusiness] = useState<Business | null>(null);
  const [members, setMembers] = useState<BusinessTeamMember[]>([]);
  const [invitations, setInvitations] = useState<BusinessInvitation[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<BusinessTeamRole>("branch_manager");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [fallbackToken, setFallbackToken] = useState("");

  const load = useCallback(async () => {
    try {
      const [businessData, memberData, invitationData] = await Promise.all([
        api<Business>(`/api/businesses/${id}`),
        api<BusinessTeamMember[]>(`/api/businesses/${id}/team`),
        api<BusinessInvitation[]>(`/api/businesses/${id}/invitations`),
      ]);
      setBusiness(businessData);
      setMembers(memberData);
      setInvitations(invitationData);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void load();
    });
    return () => {
      active = false;
    };
  }, [load]);

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    setFallbackToken("");
    try {
      const invitation = await api<BusinessInvitation>(
        `/api/businesses/${id}/invitations`,
        {
          method: "POST",
          body: {
            email: email.trim(),
            role,
            message: message.trim() || null,
          },
        },
      );
      setNotice(`Invitation created for ${invitation.email}.`);
      if (invitation.token) setFallbackToken(invitation.token);
      setEmail("");
      setMessage("");
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(memberId: number) {
    setBusy(true);
    setError("");
    try {
      await api(`/api/businesses/${id}/team/${memberId}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function revokeInvitation(invitationId: number) {
    setBusy(true);
    setError("");
    try {
      await api(`/api/invitations/${invitationId}/revoke`, { method: "POST" });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <PageLoader label="Loading team…" />;

  if (!business) {
    return (
      <EmptyState
        icon={<Users className="h-5 w-5" />}
        title="Team unavailable"
        description={error || "You do not have access to manage this team."}
      />
    );
  }

  const pending = invitations.filter((item) => item.status === "pending");

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/dashboard/listings"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-emerald-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to my listings
        </Link>
        <h2 className="mt-3 text-lg font-semibold text-slate-900">
          Manage team for {business.name}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Invite brand admins, branch managers, and branch staff. Each role can
          edit only the fields it needs.
        </p>
      </div>

      {error ? <Alert>{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {fallbackToken ? (
        <Alert tone="info">
          Email delivery is unavailable. Share this invitation link manually:
          <span className="mt-1 block break-all font-mono text-xs">
            /dashboard/invitations?token={fallbackToken}
          </span>
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-slate-900">
              Invite a team member
            </h3>
          </div>
          <form onSubmit={handleInvite} className="mt-4 space-y-4">
            <Field label="Email" htmlFor="invite-email">
              <input
                id="invite-email"
                type="email"
                className={inputClass}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="manager@example.com"
                required
              />
            </Field>
            <Field label="Role" htmlFor="invite-role">
              <select
                id="invite-role"
                className={selectClass}
                value={role}
                onChange={(event) =>
                  setRole(event.target.value as BusinessTeamRole)
                }
              >
                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Message" htmlFor="invite-message">
              <textarea
                id="invite-message"
                className={textareaClass}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Optional note for the invited person."
              />
            </Field>
            <button
              type="submit"
              className={buttonClass("primary", "sm", "w-full")}
              disabled={busy}
            >
              {busy ? <Spinner className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
              Send invitation
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-slate-900">
              Current team ({members.length})
            </h3>
          </div>
          {members.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              No additional team members yet. The listing owner has full access
              automatically.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {members.map((member) => (
                <li
                  key={member.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {member.user?.full_name ?? "Team member"}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {member.user?.email ?? ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="violet">{ROLE_LABELS[member.role]}</Badge>
                    <button
                      type="button"
                      className={buttonClass("ghost", "sm", "text-rose-600")}
                      disabled={busy}
                      onClick={() => removeMember(member.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <h3 className="text-sm font-semibold text-slate-900">
            Pending invitations ({pending.length})
          </h3>
        </div>
        {pending.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No pending invitations.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {pending.map((invitation) => (
              <li
                key={invitation.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 px-3 py-2.5"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {invitation.email}
                  </p>
                  <p className="text-xs text-slate-500">
                    {ROLE_LABELS[invitation.role]} · Expires{" "}
                    {formatDate(invitation.expires_at)}
                  </p>
                </div>
                <button
                  type="button"
                  className={buttonClass("secondary", "sm")}
                  disabled={busy}
                  onClick={() => revokeInvitation(invitation.id)}
                >
                  <X className="h-3.5 w-3.5" />
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
