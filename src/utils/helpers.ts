// Helper functions for result and error handling in the app

export function setResult(setter: (v: any) => void, value: any, type: string, setDisplayOrder: (v: string[]) => void) {
  setter(value);
  setDisplayOrder([type]);
}

export function setError(setter: (v: any) => void, error: any, type: string, setDisplayOrder: (v: string[]) => void, description?: string) {
  setter({
    method: type,
    description,
    error: error.message || error || 'Unknown error occurred'
  });
  setDisplayOrder([type]);
}

export function resetDisplayOrder(setDisplayOrder: (v: string[]) => void) {
  setDisplayOrder([]);
}

// Utility helper functions for formatting, parameter conversion, etc.

export function formatTransactions(transactions: any[] | null): string {
  if (!transactions || !Array.isArray(transactions)) return 'No transactions';
  if (transactions.length === 0) return 'No transactions in this block';
  if (typeof transactions[0] === 'string') {
    return `${transactions.length} transactions\n` +
      transactions.map((hash: string) => `  - ${hash}`).join('\n');
  } else {
    return `${transactions.length} transactions\n` +
      transactions.map((tx: any) => `  - Hash: ${tx.hash}`).join('\n\n');
  }
}

export function getBlockParameter(param: string, customNumber: string): string {
  let blockParameter = param;
  if (blockParameter === 'number') {
    if (!customNumber) throw new Error('Block number is required');
    if (customNumber.startsWith('0x')) {
      blockParameter = customNumber;
    } else if (/^\d+$/.test(customNumber)) {
      blockParameter = '0x' + Number(customNumber).toString(16);
    } else {
      throw new Error('Invalid block number format. Use decimal or hex (0x) format');
    }
  }
  return blockParameter;
} 