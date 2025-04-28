// Transaction state Svelte store for global transaction feedback

import { writable } from 'svelte/store';
import type { TransactionState } from '../types';

export const transactionState = writable<TransactionState>({
  params: { to: '', data: '', value: '' },
  hash: null,
  error: null,
  sending: false
}); 