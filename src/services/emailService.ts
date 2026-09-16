/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Optional welcome email sent through the API server (server.ts). The server verifies the
 * caller's Firebase ID token and only emails people who hold a pending invite from the
 * caller's company. When the API is not deployed (static hosting), this is skipped quietly:
 * the Firebase password-setup email is the primary onboarding message.
 */

import { auth } from '../firebase';
import { isDemoRuntime } from '../lib/runtimeMode';

export type WelcomeEmailResult = 'sent' | 'skipped' | 'unavailable';

export async function sendWelcomeEmail(params: { email: string; name: string; companyId: string }): Promise<WelcomeEmailResult> {
  if (isDemoRuntime || !auth?.currentUser) return 'unavailable';
  try {
    const token = await auth.currentUser.getIdToken();
    const response = await fetch('/api/send-onboarding-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(params),
    });
    const isJson = response.headers.get('content-type')?.includes('application/json');
    if (!response.ok || !isJson) return 'unavailable';
    const body = (await response.json()) as { sent?: boolean };
    return body.sent ? 'sent' : 'skipped';
  } catch {
    return 'unavailable';
  }
}
