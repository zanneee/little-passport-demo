import { writable } from 'svelte/store';
import type { TokenState, TransactionState, UserProfile } from '../types';

export const tokenState = writable<TokenState>({
  idToken: null,
  accessToken: null,
  decodedIdToken: null,
  decodedAccessToken: null
});

export const transactionState = writable<TransactionState>({
  params: { to: '', data: '', value: '' },
  hash: null,
  error: null,
  sending: false
});

export const userProfile = writable<UserProfile | null>(null); 