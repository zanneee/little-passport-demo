import type { Network, NetworkConfig } from '../types/transfer';

/**
 * Network configurations for Immutable zkEVM
 */
export const NETWORK_CONFIGS: Record<Network, NetworkConfig> = {
    testnet: {
        chainName: 'imtbl-zkevm-testnet',
        apiBaseUrl: 'https://api.sandbox.immutable.com',
        explorerBaseUrl: 'https://explorer.testnet.immutable.com'
    },
    mainnet: {
        chainName: 'imtbl-zkevm-mainnet',
        apiBaseUrl: 'https://api.immutable.com',
        explorerBaseUrl: 'https://explorer.immutable.com'
    }
};

/**
 * Get network configuration for the specified network
 */
export function getNetworkConfig(network: Network): NetworkConfig {
    return NETWORK_CONFIGS[network];
}

/**
 * Standard headers for API requests
 */
export const API_HEADERS = {
    'Content-Type': 'application/json'
} as const;

/**
 * ERC-20 function selectors for contract calls
 */
export const ERC20_SELECTORS = {
    balanceOf: '0x70a08231',
    name: '0x06fdde03',
    symbol: '0x95d89b41',
    decimals: '0x313ce567'
} as const;
