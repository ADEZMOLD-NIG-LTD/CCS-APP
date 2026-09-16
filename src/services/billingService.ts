/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Client side of subscription billing. The browser never decides what a plan costs or when a
 * subscription ends: it asks the API server to start a payment, Paystack collects it, and the
 * server extends the company only after verifying the transaction with Paystack.
 */

import { auth } from '../firebase';
import { isDemoRuntime } from '../lib/runtimeMode';
import type { BillingPaymentStatus, BillingPlanId } from '../types';

export interface StartPaymentResult {
  ok: boolean;
  authorizationUrl?: string;
  reference?: string;
  /** Message to show the user when ok is false. */
  error?: string;
}

export interface PaymentStatusResult {
  status?: BillingPaymentStatus;
  plan?: BillingPlanId;
  expiresAt?: string | null;
  error?: string;
}

const UNAVAILABLE = 'Online payment is not available on this deployment yet. Please contact the administrator.';

async function call<T>(path: string, init?: RequestInit): Promise<T | { error: string }> {
  if (isDemoRuntime || !auth?.currentUser) return { error: UNAVAILABLE };
  try {
    const token = await auth.currentUser.getIdToken();
    const response = await fetch(path, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
    });
    // Static hosting without the API server returns the SPA's HTML for unknown paths.
    if (!response.headers.get('content-type')?.includes('application/json')) return { error: UNAVAILABLE };
    const body = (await response.json()) as T & { error?: string };
    if (!response.ok) return { error: body.error || 'The payment service refused the request.' };
    return body;
  } catch {
    return { error: 'Could not reach the payment service. Check your connection and try again.' };
  }
}

/** Starts a payment and returns the Paystack checkout URL to send the browser to. */
export async function startSubscriptionPayment(plan: BillingPlanId): Promise<StartPaymentResult> {
  const result = await call<{ authorizationUrl: string; reference: string }>('/api/billing/initialize', {
    method: 'POST',
    body: JSON.stringify({ plan }),
  });
  if ('error' in result) return { ok: false, error: result.error };
  return { ok: true, authorizationUrl: result.authorizationUrl, reference: result.reference };
}

/** Checks a payment after Paystack redirects back; also applies it if the webhook has not arrived. */
export async function checkPaymentStatus(reference: string): Promise<PaymentStatusResult> {
  const result = await call<PaymentStatusResult>(`/api/billing/status/${encodeURIComponent(reference)}`);
  return 'error' in result ? { error: result.error } : result;
}
