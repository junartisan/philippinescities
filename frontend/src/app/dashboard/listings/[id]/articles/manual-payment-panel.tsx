"use client";

import { useState, type FormEvent } from "react";
import {
  Banknote,
  CheckCircle2,
  Clock3,
  Landmark,
  XCircle,
} from "lucide-react";
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
import { PAYMENT_METHOD_LABELS, manualPaymentTone } from "@/lib/payments";
import { formatDate } from "@/lib/utils";
import type {
  BillingStatus,
  BusinessStatus,
  ManualPayment,
  ManualPaymentPayload,
  PaymentMethod,
} from "@/lib/types";

export function ManualPaymentPanel({
  businessId,
  businessStatus,
  billing,
  onSubmitted,
}: {
  businessId: number;
  businessStatus: BusinessStatus;
  billing: BillingStatus;
  onSubmitted: (message: string) => Promise<void>;
}) {
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (businessStatus !== "approved" || billing.is_paid) {
    return null;
  }

  const latest = billing.latest_manual_payment;
  const pending = latest?.status === "pending";
  const rejected = latest?.status === "rejected";
  const expired = latest?.status === "approved";
  const disapproved = billing.article_access_override === "rejected";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (method === "bank_transfer" && !reference.trim()) {
      setError("Enter the bank transfer reference number.");
      return;
    }
    setBusy(true);
    try {
      const payload: ManualPaymentPayload = {
        method,
        reference: reference.trim() || null,
        notes: notes.trim() || null,
      };
      await api<ManualPayment>(
        `/api/billing/businesses/${businessId}/manual-payments`,
        { method: "POST", body: payload },
      );
      setReference("");
      setNotes("");
      await onSubmitted(
        "Payment request submitted. An admin will review it before access is unlocked.",
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <Banknote className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Pay by cash or bank transfer
            </h3>
            <p className="mt-0.5 text-sm text-slate-500">
              Submit payment details for admin approval. Article publishing
              unlocks after approval.
            </p>
          </div>
        </div>
        {disapproved ? (
          <Badge tone="rose">Disapproved</Badge>
        ) : latest ? (
          <Badge tone={expired ? "amber" : manualPaymentTone(latest.status)}>
            {pending
              ? "Pending approval"
              : expired
                ? "Expired"
                : "Rejected"}
          </Badge>
        ) : null}
      </div>

      {error ? (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      {disapproved ? (
        <div className="mt-4">
          <Alert tone="warning">
            <p className="flex items-center gap-2 font-semibold">
              <XCircle className="h-4 w-4" />
              Article subscription access was disapproved by an admin.
            </p>
            {billing.article_access_notes ? (
              <p className="mt-1">Admin note: {billing.article_access_notes}</p>
            ) : null}
            <p className="mt-1">
              Contact support if you believe this listing should be reviewed
              again.
            </p>
          </Alert>
        </div>
      ) : pending && latest ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="flex items-center gap-2 font-semibold">
            <Clock3 className="h-4 w-4" />
            Your payment is awaiting admin approval.
          </p>
          <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-amber-700">Method</dt>
              <dd className="font-medium">
                {PAYMENT_METHOD_LABELS[latest.method]}
              </dd>
            </div>
            <div>
              <dt className="text-amber-700">Reference</dt>
              <dd className="font-medium">{latest.reference || "—"}</dd>
            </div>
            <div>
              <dt className="text-amber-700">Submitted</dt>
              <dd className="font-medium">{formatDate(latest.created_at)}</dd>
            </div>
            <div>
              <dt className="text-amber-700">Status</dt>
              <dd className="font-medium">Pending</dd>
            </div>
          </dl>
          {latest.notes ? (
            <p className="mt-3 text-xs text-amber-800">
              Your notes: {latest.notes}
            </p>
          ) : null}
        </div>
      ) : (
        <>
          {expired && latest ? (
            <div className="mt-4">
              <Alert tone="warning">
                <p className="flex items-center gap-2 font-semibold">
                  <Clock3 className="h-4 w-4" />
                  Your manual payment access expired on{" "}
                  {formatDate(latest.paid_until)}.
                </p>
                <p className="mt-1">
                  Submit a new payment request to restore article publishing.
                </p>
              </Alert>
            </div>
          ) : null}

          {rejected && latest ? (
            <div className="mt-4">
              <Alert tone="warning">
                <p className="flex items-center gap-2 font-semibold">
                  <XCircle className="h-4 w-4" />
                  Your previous payment request was rejected.
                </p>
                {latest.admin_notes ? (
                  <p className="mt-1">Admin note: {latest.admin_notes}</p>
                ) : null}
                <p className="mt-1">
                  You can correct the details and submit a new request.
                </p>
              </Alert>
            </div>
          ) : null}

          <form onSubmit={submit} className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Payment method" htmlFor="manual-method">
                <select
                  id="manual-method"
                  className={selectClass}
                  value={method}
                  onChange={(event) =>
                    setMethod(event.target.value as PaymentMethod)
                  }
                >
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank transfer</option>
                </select>
              </Field>
              <Field
                label={
                  method === "bank_transfer"
                    ? "Bank reference number"
                    : "Receipt or reference"
                }
                htmlFor="manual-reference"
                hint={
                  method === "bank_transfer"
                    ? "Required so the admin can match your transfer."
                    : "Optional. Add a receipt number if available."
                }
              >
                <input
                  id="manual-reference"
                  className={inputClass}
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  maxLength={255}
                  required={method === "bank_transfer"}
                  placeholder={
                    method === "bank_transfer"
                      ? "e.g. BPI-2026-00123"
                      : "e.g. OR-1042"
                  }
                />
              </Field>
            </div>

            <Field
              label="Payment notes"
              htmlFor="manual-notes"
              hint="Optional. Include the amount, date paid, or other details."
            >
              <textarea
                id="manual-notes"
                className={textareaClass}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                maxLength={2000}
                placeholder="Paid PHP 1,000 in cash at the office on Nov 15."
              />
            </Field>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-stone-50 px-4 py-3">
              <p className="flex items-center gap-2 text-xs text-slate-500">
                {method === "cash" ? (
                  <Banknote className="h-4 w-4 text-slate-400" />
                ) : (
                  <Landmark className="h-4 w-4 text-slate-400" />
                )}
                Payment is confirmed manually by an admin.
              </p>
              <button
                type="submit"
                disabled={busy}
                className={buttonClass("primary", "sm")}
              >
                {busy ? (
                  <Spinner className="h-4 w-4" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Submit for approval
              </button>
            </div>
          </form>
        </>
      )}
    </section>
  );
}
