// Network configuration and error messages for the app

export const NETWORK_CONFIG = {
  testnet: {
    name: 'Testnet',
    chainId: Number(import.meta.env.VITE_PASSPORT_TESTNET_CHAIN_ID) || 13473,
    explorerUrl: import.meta.env.VITE_PASSPORT_TESTNET_EXPLORER_URL || 'https://explorer.testnet.immutable.com',
    apiUrl: import.meta.env.VITE_PASSPORT_TESTNET_API_URL || 'https://api.testnet.passport.com'
  },
  mainnet: {
    name: 'Mainnet',
    chainId: Number(import.meta.env.VITE_PASSPORT_MAINNET_CHAIN_ID) || 13371,
    explorerUrl: import.meta.env.VITE_PASSPORT_MAINNET_EXPLORER_URL || 'https://explorer.immutable.com',
    apiUrl: import.meta.env.VITE_PASSPORT_MAINNET_API_URL || 'https://api.passport.com'
  }
};

export const ERROR_MESSAGES = {
  NOT_LOGGED_IN: 'User must be logged in to perform this action',
  UNAUTHORIZED: 'Unauthorized - Please connect your wallet first',
  INVALID_PARAMS: 'Invalid parameters - "to" field is required',
  TRANSACTION_FAILED: 'Transaction failed'
};

export const DEFAULT_TRANSACTION = {
  to: '0xacbe301e5b46f4dd532b74e209adac0c06d42f8c',
  value: '1000000000000000'
}; 