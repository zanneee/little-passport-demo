// Shared type definitions for the app

export interface UserProfile {
  email?: string;
  nickname?: string;
  sub: string;
}

export interface TokenState {
  idToken: string | null;
  accessToken: string | null;
  decodedIdToken: any | null;
  decodedAccessToken: any | null;
}

export interface TransactionState {
  params: {
    to: string;
    data: string;
    value: string;
  };
  hash: string | null;
  error: string | null;
  sending: boolean;
}

import type { Eip1193Provider } from 'ethers';
export interface PassportProvider extends Eip1193Provider {
  on: (event: string, callback: (accounts: string[]) => void) => void;
}

export interface TransactionRequest {
  from?: string;
  to?: string;
  gas?: string;
  gasPrice?: string;
  value?: string;
  data?: string;
  nonce?: string;
  // Add more fields as needed
}

export type TypedData = Record<string, any>; // For EIP-712, can be refined further if needed

export interface Transaction {
  hash: string;
  from: string;
  to?: string;
  value: string;
  gas: string;
}

export interface BlockTransaction {
  blockHash: string;
  blockNumber: string;
  from: string;
  gas: string;
  gasPrice: string;
  hash: string;
  input: string;
  nonce: string;
  to: string | null;
  transactionIndex: string;
  value: string;
  type: string;
  v: string;
  r: string;
  s: string;
} 