// Network configuration and error messages for the app

export const NETWORK_CONFIG = {
  testnet: {
    name: 'Testnet',
    chainId: 13473,
    explorerUrl: 'https://explorer.testnet.immutable.com'
  },
  mainnet: {
    name: 'Mainnet',
    chainId: 13371,
    explorerUrl: 'https://explorer.immutable.com'
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