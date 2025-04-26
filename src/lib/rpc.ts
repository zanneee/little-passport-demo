import { ethers } from 'ethers';

export async function getBalance(passportProvider: any, address: string, blockParam: string) {
  const requestPayload = {
    method: 'eth_getBalance',
    params: [address, blockParam]
  };
  const balance = await passportProvider.request(requestPayload);
  return {
    request: requestPayload,
    response: balance,
    formatted: `${ethers.formatEther(balance)} tIMX (${balance} Wei)`
  };
}

export async function getStorageAt(passportProvider: any, address: string, slot: string, blockParam: string) {
  const requestPayload = {
    method: 'eth_getStorageAt',
    params: [address, slot, blockParam]
  };
  const storageValue = await passportProvider.request(requestPayload);
  return {
    request: requestPayload,
    response: storageValue,
    formatted: `Storage Value at slot ${slot}: ${storageValue}`
  };
}

export async function estimateGas(passportProvider: any, tx: any, blockParam: string) {
  const requestPayload = {
    method: 'eth_estimateGas',
    params: [tx, blockParam]
  };
  const gasEstimate = await passportProvider.request(requestPayload);
  return {
    request: requestPayload,
    response: gasEstimate,
    formatted: `Estimated Gas: ${parseInt(gasEstimate, 16).toLocaleString()} units`
  };
}

export async function ethCall(passportProvider: any, tx: any, blockNumber: string) {
  const requestPayload = {
    method: 'eth_call',
    params: [tx, blockNumber]
  };
  return await passportProvider.request(requestPayload);
}

export async function getTransactionReceipt(passportProvider: any, hash: string) {
  const requestPayload = {
    method: 'eth_getTransactionReceipt',
    params: [hash]
  };
  return await passportProvider.request(requestPayload);
}

export async function getTransactionCount(passportProvider: any, address: string, blockNumber: string) {
  const requestPayload = {
    method: 'eth_getTransactionCount',
    params: [address, blockNumber]
  };
  return await passportProvider.request(requestPayload);
}

export async function getCode(passportProvider: any, address: string, blockNumber: string) {
  const requestPayload = {
    method: 'eth_getCode',
    params: [address, blockNumber]
  };
  return await passportProvider.request(requestPayload);
}

export async function getBlockByHash(passportProvider: any, blockHash: string, includeTransactions: boolean) {
  const requestPayload = {
    method: 'eth_getBlockByHash',
    params: [blockHash, includeTransactions]
  };
  return await passportProvider.request(requestPayload);
}

export async function getBlockByNumber(passportProvider: any, blockNumber: string, includeTransactions: boolean) {
  const requestPayload = {
    method: 'eth_getBlockByNumber',
    params: [blockNumber, includeTransactions]
  };
  return await passportProvider.request(requestPayload);
}

export async function getTransactionByHash(passportProvider: any, hash: string) {
  const requestPayload = {
    method: 'eth_getTransactionByHash',
    params: [hash]
  };
  return await passportProvider.request(requestPayload);
}

export async function sendTransaction(signer: any, tx: any) {
  return await signer.sendTransaction(tx);
}

export async function signTypedData(passportProvider: any, address: string, typedData: any) {
  const requestPayload = {
    method: 'eth_signTypedData_v4',
    params: [address, JSON.stringify(typedData)]
  };
  return await passportProvider.request(requestPayload);
}

export async function personalSign(passportProvider: any, message: string, address: string) {
  const requestPayload = {
    method: 'personal_sign',
    params: [message, address]
  };
  return await passportProvider.request(requestPayload);
}

export async function requestAccounts(passportProvider: any) {
  return await passportProvider.request({ method: 'eth_requestAccounts' });
}

export async function getAccounts(passportProvider: any) {
  return await passportProvider.request({ method: 'eth_accounts' });
}

export async function getChainId(passportProvider: any) {
  return await passportProvider.request({ method: 'eth_chainId' });
}

export async function getBlockNumber(passportProvider: any) {
  return await passportProvider.request({ method: 'eth_blockNumber' });
}

export async function getGasPrice(passportProvider: any) {
  return await passportProvider.request({ method: 'eth_gasPrice' });
}

// 추가적으로 executeStorageCall, executeEstimateGas 등도 이 파일에 분리 가능 