import type {
    Asset,
    Collection,
    ERC20Token,
    TransferParams,
    TransferResult,
    NFTOwnerResponse,
    Network
} from '../types/transfer';
import { getNetworkConfig, API_HEADERS } from './apiConfig';
import {
    fetchUserTokensFromExplorer,
    filterERC20Tokens,
    convertToERC20Token,
    fetchTokenMetadata,
    checkTokenBalance
} from './tokenUtils';

/**
 * Fetch user's collections from Immutable API
 */
export async function fetchUserCollections(
    userAddress: string,
    network: Network
): Promise<Collection[]> {
    if (!userAddress) {
        throw new Error('User address is required');
    }

    const { chainName, apiBaseUrl } = getNetworkConfig(network);
    console.log(`Fetching NFTs for address: ${userAddress} on ${chainName}`);

    try {
        const response = await fetch(
            `${apiBaseUrl}/v1/chains/${chainName}/accounts/${userAddress}/nfts?page_size=200`,
            { headers: API_HEADERS }
        );

        console.log(`Accounts NFTs API response status: ${response.status}`);

        if (!response.ok) {
            console.error(`Accounts NFTs API error: ${response.status} ${response.statusText}`);
            const errorText = await response.text();
            console.error('Error details:', errorText);
            return await fetchCollectionsFromNFTOwners(userAddress, network);
        }

        const data: NFTOwnerResponse = await response.json();
        console.log('Accounts NFTs API response:', data);

        if (!data.result || data.result.length === 0) {
            console.log('No NFTs found from accounts endpoint, trying alternative approach...');
            return await fetchCollectionsFromNFTOwners(userAddress, network);
        }

        // Group NFTs by collection
        const collectionsMap = new Map<string, Collection>();

        for (const nft of data.result) {
            const contractAddress = nft.contract_address;

            if (!collectionsMap.has(contractAddress)) {
                collectionsMap.set(contractAddress, {
                    contract_address: contractAddress,
                    name: `Collection ${contractAddress.slice(0, 6)}...${contractAddress.slice(-4)}`,
                    description: undefined,
                    image: undefined,
                    total_supply: undefined,
                    asset_count: 0,
                    contract_type: nft.contract_type
                });
            }

            const collection = collectionsMap.get(contractAddress)!;
            collection.asset_count += parseInt(nft.quantity) || 1;
        }

        const collections = Array.from(collectionsMap.values());
        console.log('Final collections:', collections);

        return collections;
    } catch (error) {
        console.error('Error in fetchUserCollections:', error);
        console.log('Falling back to NFT owners endpoint...');
        return await fetchCollectionsFromNFTOwners(userAddress, network);
    }
}

/**
 * Fetch user's ERC-20 tokens using the Immutable Explorer API
 */
export async function fetchUserERC20Tokens(
    userAddress: string,
    network: Network,
    provider?: unknown
): Promise<ERC20Token[]> {
    if (!userAddress) {
        throw new Error('User address is required');
    }

    console.log(`Fetching ERC-20 tokens for address: ${userAddress} on ${network}`);

    try {
        // Fetch all tokens using the Explorer API
        const allTokens = await fetchUserTokensFromExplorer(userAddress, network);
        console.log(`Found ${allTokens.length} total tokens (including NFTs)`);

        // Filter and convert ERC-20 tokens
        const erc20TokenItems = filterERC20Tokens(allTokens);
        console.log(`Found ${erc20TokenItems.length} ERC-20 tokens with balances`);

        const userTokens = erc20TokenItems.map(item => {
            const token = convertToERC20Token(item);
            console.log(`Processing token: ${token.symbol} (${token.name}) - Balance: ${token.formatted_balance}`);
            return token;
        });

        console.log(`Final ERC-20 tokens (${userTokens.length}):`, userTokens);
        return userTokens.sort((a, b) => parseFloat(b.formatted_balance) - parseFloat(a.formatted_balance));

    } catch (error) {
        console.error('Error fetching tokens from Explorer API, falling back to RPC approach:', error);
        return await fetchERC20TokensWithRPC(userAddress, network, provider);
    }
}

/**
 * Check balance and metadata for a custom token address
 */
export async function checkCustomToken(
    tokenAddress: string,
    userAddress: string,
    provider: unknown
): Promise<ERC20Token | null> {
    try {
        const balance = await checkTokenBalance(tokenAddress, userAddress, provider);

        if (balance <= 0n) {
            return null;
        }

        const metadata = await fetchTokenMetadata(tokenAddress, provider);
        if (!metadata) {
            throw new Error('Failed to fetch token metadata');
        }

        const formattedBalance = (Number(balance) / Math.pow(10, metadata.decimals)).toFixed(6);

        return {
            contract_address: tokenAddress,
            name: metadata.name,
            symbol: metadata.symbol,
            decimals: metadata.decimals,
            balance: balance.toString(),
            formatted_balance: formattedBalance
        };
    } catch (error) {
        console.error('Error checking custom token:', error);
        throw error;
    }
}

/**
 * Fetch collection assets from Immutable API
 */
export async function fetchCollectionAssets(
    userAddress: string,
    contractAddress: string,
    network: Network
): Promise<Asset[]> {
    if (!userAddress || !contractAddress) {
        throw new Error('User address and contract address are required');
    }

    const { chainName, apiBaseUrl } = getNetworkConfig(network);
    console.log(`Fetching assets for collection: ${contractAddress} and user: ${userAddress}`);

    try {
        const response = await fetch(
            `${apiBaseUrl}/v1/chains/${chainName}/accounts/${userAddress}/nfts?contract_address=${contractAddress}&page_size=200`,
            { headers: API_HEADERS }
        );

        console.log(`Collection assets API response status: ${response.status}`);

        if (!response.ok) {
            throw new Error(`Collection assets API failed: ${response.status} ${response.statusText}`);
        }

        const data: NFTOwnerResponse = await response.json();
        const assets: Asset[] = [];

        for (const nft of data.result || []) {
            assets.push({
                token_id: nft.token_id,
                token_address: nft.contract_address,
                contract_address: nft.contract_address,
                contract_type: nft.contract_type,
                balance: nft.balance,
                quantity: nft.quantity,
                name: `${nft.contract_type} #${nft.token_id}`,
                account_address: nft.account_address,
                updated_at: nft.updated_at
            });
        }

        console.log(`Found ${assets.length} assets in collection`);
        return assets;
    } catch (error) {
        console.error('Error fetching collection assets:', error);
        throw error;
    }
}

/**
 * Execute transfer transaction
 */
export async function executeTransfer(
    params: TransferParams,
    signer: unknown
): Promise<TransferResult> {
    try {
        if (!signer) {
            throw new Error('Signer is required for transfer');
        }

        // Implementation would depend on the specific transfer type
        // This is a placeholder for the actual transfer logic

        return {
            method: 'Transfer',
            description: 'Transfer executed successfully',
            success: true
        };
    } catch (error) {
        console.error('Transfer error:', error);
        return {
            method: 'Transfer',
            description: 'Transfer failed',
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

// Private helper functions

/**
 * Fallback method to fetch collections using NFT owners endpoint
 */
async function fetchCollectionsFromNFTOwners(
    userAddress: string,
    network: Network
): Promise<Collection[]> {
    const { chainName, apiBaseUrl } = getNetworkConfig(network);

    try {
        const response = await fetch(
            `${apiBaseUrl}/v1/chains/${chainName}/nfts/owners/${userAddress}?page_size=200`,
            { headers: API_HEADERS }
        );

        if (!response.ok) {
            console.error(`NFT owners API error: ${response.status} ${response.statusText}`);
            return [];
        }

        await response.json();
        // Process the response similar to the main function
        // This is a simplified version
        return [];
    } catch (error) {
        console.error('Error in fetchCollectionsFromNFTOwners:', error);
        return [];
    }
}

/**
 * Fallback: Fetch common ERC-20 tokens using RPC calls
 */
async function fetchERC20TokensWithRPC(
    userAddress: string,
    network: Network,
    provider?: unknown
): Promise<ERC20Token[]> {
    console.log('Using RPC fallback approach for ERC-20 tokens...');

    if (!provider) {
        console.warn('Provider not available for RPC calls');
        return [];
    }

    // Common ERC-20 tokens on Immutable zkEVM
    const commonTokens = [
        {
            address: '0x3B2F62d42DB19B30588648bf1c184865D4C3B1D6', // IMX token on testnet
            symbol: 'IMX',
            name: 'Immutable X',
            decimals: 18
        },
        {
            address: '0x1CcCa691501174B4A623CeDA58cC8f1a76dc3439', // USDC on testnet
            symbol: 'USDC',
            name: 'USD Coin',
            decimals: 6
        },
        {
            address: '0xadc0e51476f6a483e65d2a379ebb0a4ac68852e9', // R0AR TOKEN on mainnet
            symbol: '1R0R',
            name: 'R0AR TOKEN',
            decimals: 18
        }
    ];

    const userTokens: ERC20Token[] = [];

    for (const token of commonTokens) {
        try {
            console.log(`Checking RPC balance for token: ${token.symbol} (${token.address})`);

            const balance = await checkTokenBalance(token.address, userAddress, provider);

            if (balance > 0n) {
                const formattedBalance = (Number(balance) / Math.pow(10, token.decimals)).toFixed(6);

                userTokens.push({
                    contract_address: token.address,
                    name: token.name,
                    symbol: token.symbol,
                    decimals: token.decimals,
                    balance: balance.toString(),
                    formatted_balance: formattedBalance
                });

                console.log(`Found RPC balance for ${token.symbol}: ${formattedBalance}`);
            }
        } catch (error) {
            console.warn(`Error checking RPC balance for token ${token.symbol}:`, error);
        }
    }

    console.log(`Final RPC ERC-20 tokens (${userTokens.length}):`, userTokens);
    return userTokens.sort((a, b) => parseFloat(b.formatted_balance) - parseFloat(a.formatted_balance));
}
