/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface OnboardingEmailParams {
  email: string;
  name: string;
  password: string;
  companyName?: string;
}

export async function sendOnboardingEmail(params: OnboardingEmailParams) {
  try {
    const response = await fetch('/api/send-onboarding-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send onboarding email');
    }

    return await response.json();
  } catch (error) {
    console.error('Error calling send-onboarding-email API:', error);
    throw error;
  }
}
