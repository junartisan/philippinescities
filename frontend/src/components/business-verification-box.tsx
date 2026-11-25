"use client";

import { useState, type FormEvent } from "react";
import { ShieldCheck } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import {
  Alert,
  Badge,
  buttonClass,
  Field,
  inputClass,
  selectClass,
  Spinner,
  textareaClass,
} from "@/components/ui";
import type {
  Business,
  BusinessVerification,
  BusinessVerificationMethod,
  BusinessVerificationStatus,
} from "@/lib/types";

const METHOD_LABELS: Record<BusinessVerificationMethod, string> = {
  registration: "Business registration",
  domain_email: "Official domain email",
  branch_staff: "Branch staff approval",
};

const STATUS_LABELS: Record<BusinessVerificationStatus, string> = {
  unverified: "Unverified",
  pending: "Pending review",
  verified: "Verified",
  rejected: "Rejected",
};

function statusTone(
  status: BusinessVerificationStatus,
): "stone" | "amber" | "emerald" | "rose" {
  if (status === "verified") return "emerald";
  if (status === "pending") return "amber";
  if (status === "rejected") return "rose";
  return "stone";
}

export function BusinessVerificationBox({
  business,
  onSubmitted,
}: {
  business: Business;
  onSubmitted: (status: BusinessVerificationStatus) => void;
}) {
  const [status, setStatus] = useState(business.verification_status);
  const [method, setMethod] = useState<BusinessVerificationMethod>("registration");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setSaving(true);
    try {
      const result = await api<BusinessVerification>(
        `/api/businesses/${business.id}/verification`,
        {
          method: "POST",
          body: {
            method,
            reference: reference.trim() || null,
            notes: notes.trim() || null,
          },
        },
      );
      setStatus(result.status);
      onSubmitted(result.status);
      setNotice(
        result.status === "verified"
          ? "Verification confirmed."
          : "Verification submitted for admin review.",
      );
      setReference("");
      setNotes("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <h2 className="text-sm font-semibold text-slate-900">Verification</h2>
        </div>
        <Badge tone={statusTone(status)}>{STATUS_LABELS[status]}</Badge>
      </div>

      <p className="mt-3 text-sm text-slate-500">
        Verify this listing with business registration, an official domain
        email, or an accepted branch staff invitation.
      </p>

      {error ? <div className="mt-3"><Alert>{error}</Alert></div> : null}
      {notice ? (
        <div className="mt-3"><Alert tone="success">{notice}</Alert></div>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <Field label="Verification method" htmlFor="verification-method">
          <select
            id="verification-method"
            className={selectClass}
            value={method}
            onChange={(event) =>
              setMethod(event.target.value as BusinessVerificationMethod)
            }
          >
            {Object.entries(METHOD_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        {method !== "branch_staff" ? (
          <Field
            label={
              method === "registration"
                ? "Registration number or document link"
                : "Email domain"
            }
            htmlFor="verification-reference"
            hint={
              method === "domain_email"
                ? "Use the domain from your official email address, such as example.ph."
                : "Registration details are reviewed by an admin."
            }
          >
            <input
              id="verification-reference"
              className={inputClass}
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder={
                method === "registration" ? "REG-123456" : "example.ph"
              }
              required={method === "registration"}
            />
          </Field>
        ) : (
          <Alert tone="info">
            Accepting a branch manager or staff invitation verifies a branch
            listing automatically.
          </Alert>
        )}

        <Field label="Notes" htmlFor="verification-notes">
          <textarea
            id="verification-notes"
            className={textareaClass}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Add supporting information for the reviewer."
          />
        </Field>

        <button
          type="submit"
          className={buttonClass("primary", "sm", "w-full")}
          disabled={saving}
        >
          {saving ? <Spinner className="h-4 w-4" /> : null}
          {method === "registration" ? "Submit for review" : "Verify listing"}
        </button>
      </form>
    </div>
  );
}
