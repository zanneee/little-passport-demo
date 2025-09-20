import type { ERC20Token, ExplorerTokenItem, TokenMetadata, Network } from '../types/transfer';
import { getNetworkConfig, API_HEADERS, ERC20_SELECTORS } from './apiConfig';

/**
 * Fetch all tokens (including balances) for a user address using the Explorer API
 */
export async function fetchUserTokensFromExplorer(
    userAddress: string,
    network: Network
): Promise<ExplorerTokenItem[]> {
    const { explorerBaseUrl } = getNetworkConfig(network);

    const response = await fetch(
        `${explorerBaseUrl}/api/v2/addresses/${userAddress}/tokens`,
        { headers: API_HEADERS }
    );

    if (!response.ok) {
        throw new Error(`Explorer API failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.items || [];
}

/**
 * Filter ERC-20 tokens from explorer API response
 */
export function filterERC20Tokens(tokens: ExplorerTokenItem[]): ExplorerTokenItem[] {
    return tokens.filter(item =>
        item.token?.type === 'ERC-20' &&
        item.value &&
        BigInt(item.value) > 0n
    );
}

/**
 * Convert explorer token item to ERC20Token interface
 */
export function convertToERC20Token(item: ExplorerTokenItem): ERC20Token {
    const { token } = item;
    const rawBalance = BigInt(item.value);
    const decimals = parseInt(token.decimals) || 18;
    const formattedBalance = (Number(rawBalance) / Math.pow(10, decimals)).toFixed(6);

    return {
        contract_address: token.address_hash,
        name: token.name || 'Unknown Token',
        symbol: token.symbol || 'UNKNOWN',
        decimals,
        balance: rawBalance.toString(),
        formatted_balance: formattedBalance,
        logo: token.icon_url
    };
}

/**
 * Fetch token metadata directly from contract
 */
export async function fetchTokenMetadata(
    contractAddress: string,
    provider: any
): Promise<TokenMetadata | null> {
    if (!provider) {
        throw new Error('Provider is required for contract calls');
    }

    try {
        const [nameResponse, symbolResponse, decimalsResponse] = await Promise.all([
            provider.request({
                method: 'eth_call',
                params: [{ to: contractAddress, data: ERC20_SELECTORS.name }, 'latest']
            }).catch(() => null),
            provider.request({
                method: 'eth_call',
                params: [{ to: contractAddress, data: ERC20_SELECTORS.symbol }, 'latest']
            }).catch(() => null),
            provider.request({
                method: 'eth_call',
                params: [{ to: contractAddress, data: ERC20_SELECTORS.decimals }, 'latest']
            }).catch(() => null)
        ]);

        return {
            name: decodeStringResponse(nameResponse) || 'Unknown Token',
            symbol: decodeStringResponse(symbolResponse) || 'UNKNOWN',
            decimals: decodeDecimalsResponse(decimalsResponse)
        };
    } catch (error) {
        console.warn(`Failed to fetch metadata for token ${contractAddress}:`, error);
        return null;
    }
}

/**
 * Check token balance for a specific address
 */
export async function checkTokenBalance(
    tokenAddress: string,
    userAddress: string,
    provider: any
): Promise<bigint> {
    if (!provider) {
        throw new Error('Provider is required for balance check');
    }

    const paddedAddress = userAddress.replace('0x', '').padStart(64, '0');
    const data = ERC20_SELECTORS.balanceOf + paddedAddress;

    const response = await provider.request({
        method: 'eth_call',
        params: [{ to: tokenAddress, data }, 'latest']
    });

    return BigInt(response || '0');
}

/**
 * Decode string response from contract call (simplified ABI decoding)
 */
function decodeStringResponse(response: string | null): string | null {
    if (!response || response === '0x') return null;

    try {
        const hex = response.slice(2);
        if (hex.length >= 128) {
            const lengthHex = hex.slice(64, 128);
            const length = parseInt(lengthHex, 16);
            if (length > 0 && length < 100) {
                const stringBytes = hex.slice(128, 128 + length * 2);
                return Buffer.from(stringBytes, 'hex').toString('utf8').replace(/\0/g, '');
            }
        }
    } catch (error) {
        console.warn('Failed to decode string response:', error);
    }

    return null;
}

/**
 * Decode decimals response from contract call
 */
function decodeDecimalsResponse(response: string | null): number {
    if (!response || response === '0x') return 18;

    try {
        const decimals = parseInt(response, 16);
        return (isNaN(decimals) || decimals < 0 || decimals > 18) ? 18 : decimals;
    } catch (error) {
        console.warn('Failed to decode decimals response:', error);
        return 18;
    }
}
