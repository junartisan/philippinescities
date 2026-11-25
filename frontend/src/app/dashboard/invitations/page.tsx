"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { Check, Inbox, Mail, X } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import {
  Alert,
  Badge,
  buttonClass,
  EmptyState,
  PageLoader,
  Spinner,
} from "@/components/ui";
import { formatDate } from "@/lib/utils";
import type { BusinessInvitation } from "@/lib/types";

function roleLabel(role: BusinessInvitation["role"]) {
  if (role === "corporate_admin") return "Corporate admin";
  if (role === "branch_manager") return "Branch manager";
  return "Branch staff";
}

function InvitationCard({
  invitation,
  busy,
  onAccept,
  onDecline,
}: {
  invitation: BusinessInvitation;
  busy: boolean;
  onAccept: (invitationId: number) => void;
  onDecline: (invitationId: number) => void;
}) {
  return (
    <li className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <Mail className="h-5 w-5" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900">
                {invitation.business?.name ?? "Business invitation"}
              </h3>
              <Badge tone="violet">{roleLabel(invitation.role)}</Badge>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Sent to {invitation.email} · Expires{" "}
              {formatDate(invitation.expires_at)}
            </p>
            {invitation.message ? (
              <p className="mt-2 whitespace-pre-line text-sm text-slate-600">
                {invitation.message}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={buttonClass("primary", "sm")}
            disabled={busy}
            onClick={() => onAccept(invitation.id)}
          >
            {busy ? <Spinner className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
            Accept
          </button>
          <button
            type="button"
            className={buttonClass("secondary", "sm")}
            disabled={busy}
            onClick={() => onDecline(invitation.id)}
          >
            <X className="h-3.5 w-3.5" />
            Decline
          </button>
        </div>
      </div>
    </li>
  );
}

function InvitationsPanel() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [invitations, setInvitations] = useState<BusinessInvitation[]>([]);
  const [preview, setPreview] = useState<BusinessInvitation | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api<BusinessInvitation[]>("/api/invitations/mine");
      setInvitations(data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void load();
    });
    return () => {
      active = false;
    };
  }, [load]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    api<BusinessInvitation>(
      `/api/invitations/token/${encodeURIComponent(token)}`,
    )
      .then((data) => {
        if (active) {
          setPreview(data);
          setPreviewError("");
        }
      })
      .catch((err) => {
        if (active) setPreviewError(errorMessage(err));
      });
    return () => {
      active = false;
    };
  }, [token]);

  async function submitDecision(
    path: string,
    body?: { token: string },
  ) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api<BusinessInvitation>(path, {
        method: "POST",
        body,
      });
      setNotice(
        result.status === "accepted"
          ? "Invitation accepted. Your access is active now."
          : "Invitation declined.",
      );
      setPreview(null);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function decideToken(action: "accept" | "decline", value: string) {
    return submitDecision(`/api/invitations/${action}`, { token: value });
  }

  function decideId(action: "accept" | "decline", invitationId: number) {
    return submitDecision(`/api/invitations/${invitationId}/${action}`);
  }

  const pending = invitations.filter((item) => item.status === "pending");

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Invitations</h2>
        <p className="mt-1 text-sm text-slate-500">
          Accept brand or branch access invitations from listing owners.
        </p>
      </div>

      {previewError ? <Alert>{previewError}</Alert> : null}
      {error ? <Alert>{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      {preview && preview.status === "pending" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <h3 className="text-sm font-semibold text-emerald-900">
            Invitation from {preview.business?.name ?? "a Philippines Cities business"}
          </h3>
          <p className="mt-1 text-sm text-emerald-700">
            Role: {roleLabel(preview.role)} · Sent to {preview.email}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className={buttonClass("primary", "sm")}
              disabled={busy}
              onClick={() => preview.token && decideToken("accept", preview.token)}
            >
              Accept invitation
            </button>
            <button
              type="button"
              className={buttonClass("secondary", "sm")}
              disabled={busy}
              onClick={() => preview.token && decideToken("decline", preview.token)}
            >
              Decline
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <PageLoader label="Loading invitations…" />
      ) : pending.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-5 w-5" />}
          title="No pending invitations"
          description="Brand owners and corporate admins can invite you to manage a listing or branch."
          action={
            <Link href="/dashboard/listings" className={buttonClass("secondary", "sm")}>
              View my listings
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {pending.map((invitation) => (
            <InvitationCard
              key={invitation.id}
              invitation={invitation}
              busy={busy}
              onAccept={(invitationId) => decideId("accept", invitationId)}
              onDecline={(invitationId) => decideId("decline", invitationId)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

export default function InvitationsPage() {
  return (
    <Suspense fallback={<PageLoader label="Loading invitations…" />}>
      <InvitationsPanel />
    </Suspense>
  );
}
