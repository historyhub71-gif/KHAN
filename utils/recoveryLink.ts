/**
 * Password recovery deep links — capture full URL early and establish Supabase session
 * before Expo Router navigation can strip hash/query params on Android.
 */

import * as Linking from 'expo-linking';
import { supabase } from './supabase';

let pendingRecoveryUrl: string | null = null;
let passwordRecoveryActive = false;
let sessionEstablished = false;

export function isResetPasswordPath(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.toLowerCase().includes('reset-password');
}

export function hasRecoveryTokens(url: string | null | undefined): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    lower.includes('access_token=') ||
    lower.includes('refresh_token=') ||
    lower.includes('code=') ||
    lower.includes('token_hash=') ||
    (lower.includes('token=') && lower.includes('type=recovery'))
  );
}

export function isRecoveryUrl(url: string | null | undefined): boolean {
  return isResetPasswordPath(url) || hasRecoveryTokens(url);
}

export function setPendingRecoveryUrl(url: string): void {
  if (!isRecoveryUrl(url)) return;
  pendingRecoveryUrl = url;
  passwordRecoveryActive = true;
}

export function peekPendingRecoveryUrl(): string | null {
  return pendingRecoveryUrl;
}

export function consumePendingRecoveryUrl(): string | null {
  const url = pendingRecoveryUrl;
  pendingRecoveryUrl = null;
  return url;
}

export function setPasswordRecoveryActive(active: boolean): void {
  passwordRecoveryActive = active;
  if (!active) sessionEstablished = false;
}

export function isPasswordRecoveryActive(): boolean {
  return passwordRecoveryActive;
}

export function isRecoverySessionEstablished(): boolean {
  return sessionEstablished;
}

export function markRecoverySessionReady(): void {
  sessionEstablished = true;
  passwordRecoveryActive = true;
}

export function parseAuthParamsFromUrl(url: string): Record<string, string> {
  const params: Record<string, string> = {};

  try {
    const parsed = Linking.parse(url);
    const queryParams = parsed.queryParams;
    if (queryParams) {
      for (const [key, value] of Object.entries(queryParams)) {
        if (typeof value === 'string') params[key] = value;
        else if (Array.isArray(value) && value[0]) params[key] = String(value[0]);
      }
    }
  } catch {
    // manual parsing below
  }

  const addPairs = (segment: string) => {
    if (!segment) return;
    for (const pair of segment.split('&')) {
      const eq = pair.indexOf('=');
      if (eq === -1) continue;
      const key = decodeURIComponent(pair.slice(0, eq));
      const value = decodeURIComponent(pair.slice(eq + 1));
      if (key && value) params[key] = value;
    }
  };

  const hashIndex = url.indexOf('#');
  if (hashIndex !== -1) {
    addPairs(url.substring(hashIndex + 1));
  }

  const queryIndex = url.indexOf('?');
  if (queryIndex !== -1) {
    const end =
      hashIndex !== -1 && hashIndex > queryIndex ? hashIndex : url.length;
    addPairs(url.substring(queryIndex + 1, end));
  }

  return params;
}

/**
 * Establish Supabase recovery session from deep link URL.
 * Call as early as possible (root layout) before router navigation.
 */
export async function establishRecoverySessionFromUrl(
  url: string
): Promise<{ ok: boolean; error?: string }> {
  if (!url) return { ok: false, error: 'No URL provided' };

  setPendingRecoveryUrl(url);
  const params = parseAuthParamsFromUrl(url);

  try {
    if (params.error) {
      throw new Error(
        params.error_description || `Link verification failed: ${params.error}`
      );
    }

    if (params.access_token && params.refresh_token) {
      const { error } = await supabase.auth.setSession({
        access_token: params.access_token,
        refresh_token: params.refresh_token,
      });
      if (error) throw error;
      sessionEstablished = true;
      passwordRecoveryActive = true;
      return { ok: true };
    }

    if (params.code) {
      const { error } = await supabase.auth.exchangeCodeForSession(params.code);
      if (error) throw error;
      sessionEstablished = true;
      passwordRecoveryActive = true;
      return { ok: true };
    }

    if (params.token_hash) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: params.token_hash,
        type: 'recovery',
      });
      if (error) throw error;
      sessionEstablished = true;
      passwordRecoveryActive = true;
      return { ok: true };
    }

    if (params.token && params.type === 'recovery') {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: params.token,
        type: 'recovery',
      });
      if (error) throw error;
      sessionEstablished = true;
      passwordRecoveryActive = true;
      return { ok: true };
    }

    if (!hasRecoveryTokens(url)) {
      return { ok: false, error: 'no_tokens' };
    }

    return {
      ok: false,
      error: 'Reset link is missing authentication data. Request a new email.',
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Failed to verify reset link.';
    return { ok: false, error: message };
  }
}

export async function handleIncomingRecoveryUrl(
  url: string | null
): Promise<{ shouldOpenResetScreen: boolean; error?: string }> {
  if (!url || !isRecoveryUrl(url)) {
    return { shouldOpenResetScreen: false };
  }

  setPendingRecoveryUrl(url);

  if (hasRecoveryTokens(url)) {
    const result = await establishRecoverySessionFromUrl(url);
    if (result.ok) {
      return { shouldOpenResetScreen: true };
    }
    return { shouldOpenResetScreen: true, error: result.error };
  }

  // Path-only deep link — open screen; it will wait for tokens / PASSWORD_RECOVERY
  if (isResetPasswordPath(url)) {
    return { shouldOpenResetScreen: true };
  }

  return { shouldOpenResetScreen: false };
}
