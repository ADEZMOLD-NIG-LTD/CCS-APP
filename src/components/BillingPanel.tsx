/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Subscription and payment screen for a company admin. Prices come from platform_config/billing,
 * payments go through Paystack, and only the API server may extend a subscription.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, CreditCard, Loader2, Receipt, Settings2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, getDocs, limit, orderBy, query, where } from '../lib/fs';
import { BILLING_PLAN_IDS, daysUntilExpiry, koboToNaira, nairaToKobo, normalizeBillingConfig, type BillingConfig } from '../lib/billing';
import { checkPaymentStatus, startSubscriptionPayment } from '../services/billingService';
import { formatFirestoreError, OperationType, reportFirestoreError } from '../lib/firestore';
import { commitWrites } from '../lib/writes';
import { cn, formatCurrency } from '../lib/utils';
import type { BillingPayment, BillingPlanId } from '../types';

const STATE_STYLES: Record<string, { label: string; tone: string }> = {
  UNLIMITED: { label: 'No subscription required', tone: 'bg-slate-100 text-slate-700' },
  ACTIVE: { label: 'Active', tone: 'bg-emerald-100 text-emerald-700' },
  GRACE: { label: 'Grace period', tone: 'bg-amber-100 text-amber-700' },
  EXPIRED: { label: 'Expired — read only', tone: 'bg-rose-100 text-rose-700' },
};

function formatDate(date: Date | null): string {
  return date ? date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}

function toDate(value: BillingPayment['createdAt']): Date | null {
  if (!value) return null;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return typeof value.toDate === 'function' ? value.toDate() : null;
}

export default function BillingPanel() {
  const { company, profile, user, isAdmin, isSuperAdmin, billingConfig, subscriptionState, subscriptionExpiresAt, setErrorMessage, setSuccessMessage } = useAuth();
  const [payments, setPayments] = useState<BillingPayment[]>([]);
  const [busyPlan, setBusyPlan] = useState<BillingPlanId | null>(null);
  const [checking, setChecking] = useState(false);
  const [savingPrices, setSavingPrices] = useState(false);

  const savePrices = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const plans = {} as BillingConfig['plans'];
    for (const id of BILLING_PLAN_IDS) {
      plans[id] = {
        amountKobo: nairaToKobo(Number(form.get(`${id}_price`) ?? 0)),
        months: Number(form.get(`${id}_months`) ?? 1),
      };
    }
    const config = normalizeBillingConfig({
      currency: 'NGN',
      graceDays: Number(form.get('graceDays') ?? 0),
      plans,
      updatedAt: new Date().toISOString(),
      updatedBy: profile?.email || user?.email || '',
    });
    setSavingPrices(true);
    try {
      await commitWrites([{ kind: 'set', collection: 'platform_config', id: 'billing', data: { ...config } }]);
      setSuccessMessage('Plan prices updated.');
    } catch (error) {
      setErrorMessage(formatFirestoreError(error));
    } finally {
      setSavingPrices(false);
    }
  };

  const loadPayments = useCallback(async () => {
    if (!profile?.companyId || !isAdmin) return;
    try {
      const snapshot = await getDocs(query(
        collection(db, 'billing_payments'),
        where('companyId', '==', profile.companyId),
        orderBy('createdAt', 'desc'),
        limit(10)
      ));
      setPayments(snapshot.docs.map(d => ({ ...(d.data() as BillingPayment), id: d.id })));
    } catch (error) {
      setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'billing_payments'));
    }
  }, [profile?.companyId, isAdmin, setErrorMessage]);

  useEffect(() => {
    void loadPayments();
  }, [loadPayments]);

  // Paystack sends the browser back with ?billing=<reference>.
  useEffect(() => {
    const reference = new URLSearchParams(window.location.search).get('billing');
    if (!reference || !isAdmin) return;
    setChecking(true);
    checkPaymentStatus(reference)
      .then(result => {
        if (result.error) setErrorMessage(result.error);
        else if (result.status === 'PAID') setSuccessMessage(`Payment received. Your subscription now runs to ${formatDate(result.expiresAt ? new Date(result.expiresAt) : null)}.`);
        else if (result.status === 'PENDING') setErrorMessage('The payment has not been confirmed yet. Refresh in a moment.');
        else setErrorMessage('That payment did not go through. You have not been charged for it.');
      })
      .finally(() => {
        setChecking(false);
        window.history.replaceState({}, '', window.location.pathname);
        void loadPayments();
      });
  }, [isAdmin, loadPayments, setErrorMessage, setSuccessMessage]);

  const pay = async (plan: BillingPlanId) => {
    setBusyPlan(plan);
    const result = await startSubscriptionPayment(plan);
    setBusyPlan(null);
    if (!result.ok || !result.authorizationUrl) {
      setErrorMessage(result.error || 'Could not start the payment.');
      return;
    }
    window.location.href = result.authorizationUrl;
  };

  const state = STATE_STYLES[subscriptionState] ?? STATE_STYLES.UNLIMITED;
  const daysLeft = daysUntilExpiry(subscriptionExpiresAt);
  const forSale = BILLING_PLAN_IDS.filter(id => billingConfig.plans[id].amountKobo > 0);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><ShieldCheck size={20} className="text-indigo-600" /> Subscription</h2>
            <p className="text-xs text-slate-500 mt-1">{company?.name}</p>
          </div>
          <span className={cn('text-[10px] font-black px-3 py-1 rounded-full uppercase', state.tone)}>{state.label}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Current plan</p>
            <p className="text-sm font-bold text-slate-900">{company?.subscriptionPlan || 'Not set'}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Paid until</p>
            <p className="text-sm font-bold text-slate-900">{formatDate(subscriptionExpiresAt)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Days remaining</p>
            <p className="text-sm font-bold text-slate-900">{daysLeft === null ? '—' : daysLeft}</p>
          </div>
        </div>

        {subscriptionState === 'EXPIRED' && (
          <p className="mt-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl p-3 flex gap-2" role="alert">
            <AlertTriangle size={16} className="shrink-0" />
            This subscription has lapsed, so the company is read only: everyone can still open and export their records, but nothing new can be saved until a payment goes through.
          </p>
        )}
        {subscriptionState === 'GRACE' && (
          <p className="mt-4 bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold rounded-xl p-3 flex gap-2">
            <AlertTriangle size={16} className="shrink-0" />
            The subscription ran out on {formatDate(subscriptionExpiresAt)}. Work continues during a short grace period; please renew now.
          </p>
        )}
        {checking && <p className="mt-4 text-xs text-slate-500 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Confirming your payment…</p>}
      </div>

      {!isAdmin ? (
        <p className="text-xs text-slate-500">Only a company admin can make a payment.</p>
      ) : forSale.length === 0 ? (
        <div className="bg-white p-6 rounded-2xl border border-dashed border-slate-300 text-center text-sm text-slate-500">
          No plans are on sale yet. Please contact the administrator.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {forSale.map(id => {
            const plan = billingConfig.plans[id];
            return (
              <div key={id} className={cn('bg-white p-5 rounded-2xl border shadow-sm flex flex-col', company?.subscriptionPlan === id ? 'border-indigo-300 ring-1 ring-indigo-200' : 'border-slate-200')}>
                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{plan.label || id}</p>
                <p className="text-2xl font-black text-slate-900 mt-2">{formatCurrency(koboToNaira(plan.amountKobo))}</p>
                <p className="text-[11px] text-slate-500">for {plan.months} month{plan.months === 1 ? '' : 's'}</p>
                <button
                  onClick={() => pay(id)}
                  disabled={busyPlan !== null}
                  className="mt-4 w-full bg-indigo-600 text-white py-2.5 rounded-xl text-xs font-bold shadow disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {busyPlan === id ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
                  {busyPlan === id ? 'Starting…' : 'Pay with Paystack'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {isAdmin && payments.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <h3 className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <Receipt size={14} /> Recent payments
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <tbody className="divide-y divide-slate-100">
                {payments.map(payment => (
                  <tr key={payment.id}>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDate(toDate(payment.createdAt))}</td>
                    <td className="px-4 py-3 text-xs font-bold text-slate-900">{payment.plan}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{payment.months} month{payment.months === 1 ? '' : 's'}</td>
                    <td className="px-4 py-3 text-xs font-bold text-slate-900 text-right">{formatCurrency(koboToNaira(payment.amountKobo))}</td>
                    <td className="px-4 py-3">
                      <span className={cn('text-[9px] font-black px-2 py-0.5 rounded-full uppercase flex items-center gap-1 w-fit',
                        payment.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : payment.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600')}>
                        {payment.status === 'PAID' && <CheckCircle2 size={10} />}{payment.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isSuperAdmin && (
        <div className="bg-white p-6 rounded-2xl border border-indigo-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Settings2 size={16} className="text-indigo-600" /> Plan prices
          </h3>
          <p className="text-[11px] text-slate-500 mt-1 mb-4">
            Platform admin only. These prices are shown to every company admin; a plan priced at zero is not offered for sale.
          </p>
          <form onSubmit={savePrices} className="space-y-3">
            {BILLING_PLAN_IDS.map(id => (
              <div key={id} className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-end">
                <span className="text-xs font-bold text-slate-700 uppercase sm:col-span-1">{id}</span>
                <label className="block text-[10px] font-bold text-slate-400 uppercase">
                  Price (₦)
                  <input
                    name={`${id}_price`} type="number" min="0" step="1"
                    defaultValue={koboToNaira(billingConfig.plans[id].amountKobo)}
                    className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                  />
                </label>
                <label className="block text-[10px] font-bold text-slate-400 uppercase">
                  Months
                  <input
                    name={`${id}_months`} type="number" min="1" max="24" step="1"
                    defaultValue={billingConfig.plans[id].months}
                    className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                  />
                </label>
              </div>
            ))}
            <label className="block text-[10px] font-bold text-slate-400 uppercase max-w-[12rem]">
              Grace days after expiry
              <input
                name="graceDays" type="number" min="0" max="30" step="1"
                defaultValue={billingConfig.graceDays}
                className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
              />
            </label>
            <button type="submit" disabled={savingPrices} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow disabled:opacity-50">
              {savingPrices ? 'Saving…' : 'Save prices'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
