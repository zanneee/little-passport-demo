// Ethereum RPC helper functions for PassportProvider

import { ethers } from 'ethers';
import type { PassportProvider, TransactionRequest, TypedData } from '../types';

export async function getBalance(passportProvider: PassportProvider, address: string) {
  return await passportProvider.request({ method: 'eth_getBalance', params: [address, 'latest'] });
}

export async function getStorageAt(passportProvider: PassportProvider, address: string, position: string) {
  return await passportProvider.request({ method: 'eth_getStorageAt', params: [address, position, 'latest'] });
}

export async function estimateGas(passportProvider: PassportProvider, tx: TransactionRequest) {
  return await passportProvider.request({ method: 'eth_estimateGas', params: [tx] });
}

export async function ethCall(passportProvider: PassportProvider, tx: TransactionRequest) {
  return await passportProvider.request({ method: 'eth_call', params: [tx, 'latest'] });
}

export async function getTransactionReceipt(passportProvider: PassportProvider, txHash: string) {
  return await passportProvider.request({ method: 'eth_getTransactionReceipt', params: [txHash] });
}

export async function getTransactionCount(passportProvider: PassportProvider, address: string) {
  return await passportProvider.request({ method: 'eth_getTransactionCount', params: [address, 'latest'] });
}

export async function getCode(passportProvider: PassportProvider, address: string) {
  return await passportProvider.request({ method: 'eth_getCode', params: [address, 'latest'] });
}

export async function getBlockByHash(passportProvider: PassportProvider, blockHash: string) {
  return await passportProvider.request({ method: 'eth_getBlockByHash', params: [blockHash, false] });
}

export async function getBlockByNumber(passportProvider: PassportProvider, blockNumber: string) {
  return await passportProvider.request({ method: 'eth_getBlockByNumber', params: [blockNumber, false] });
}

export async function getTransactionByHash(passportProvider: PassportProvider, txHash: string) {
  return await passportProvider.request({ method: 'eth_getTransactionByHash', params: [txHash] });
}

export async function sendTransaction(passportProvider: PassportProvider, tx: TransactionRequest) {
  return await passportProvider.request({ method: 'eth_sendTransaction', params: [tx] });
}

export async function signTypedData(passportProvider: PassportProvider, address: string, typedData: TypedData) {
  return await passportProvider.request({ method: 'eth_signTypedData_v4', params: [address, JSON.stringify(typedData)] });
}

export async function personalSign(passportProvider: PassportProvider, address: string, message: string) {
  return await passportProvider.request({ method: 'personal_sign', params: [message, address] });
}

export async function requestAccounts(passportProvider: PassportProvider) {
  return await passportProvider.request({ method: 'eth_requestAccounts' });
}

export async function getAccounts(passportProvider: PassportProvider) {
  return await passportProvider.request({ method: 'eth_accounts' });
}

export async function getChainId(passportProvider: PassportProvider) {
  return await passportProvider.request({ method: 'eth_chainId' });
}

export async function getBlockNumber(passportProvider: PassportProvider) {
  return await passportProvider.request({ method: 'eth_blockNumber' });
}

export async function getGasPrice(passportProvider: PassportProvider) {
  return await passportProvider.request({ method: 'eth_gasPrice' });
}

// 추가적으로 executeStorageCall, executeEstimateGas 등도 이 파일에 분리 가능 