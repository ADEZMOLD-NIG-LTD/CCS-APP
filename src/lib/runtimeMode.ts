/**
 * Runtime mode is decided once per page load.
 *
 * Demo (training) mode runs entirely against a local, in-browser data store and never
 * talks to the production Firestore or Firebase Auth. Switching mode reloads the page so
 * that every module is wired to exactly one backend for the lifetime of the page.
 */

const DEMO_FLAG_KEY = 'ccs_demo_mode';

function readFlag(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(DEMO_FLAG_KEY) === 'true';
  } catch {
    return false;
  }
}

export const isDemoRuntime: boolean = readFlag();

export function enterDemoMode(): void {
  try {
    window.localStorage.setItem(DEMO_FLAG_KEY, 'true');
  } catch {
    // Storage unavailable (private mode): demo cannot persist, stay in live mode.
    return;
  }
  window.location.reload();
}

export function exitDemoMode(): void {
  try {
    window.localStorage.removeItem(DEMO_FLAG_KEY);
  } catch {
    // ignore
  }
  window.location.reload();
}
