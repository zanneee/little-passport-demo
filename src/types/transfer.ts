export interface Asset {
    token_id: string;
    token_address: string;
    contract_address: string;
    contract_type?: string;
    balance: string;
    quantity?: string;
    name?: string;
    description?: string;
    image_url?: string;
    external_link?: string;
    animation_url?: string;
    attributes?: Array<{
        trait_type: string;
        value: string;
    }>;
    metadata?: {
        schema: string;
    };
    collection?: {
        name: string;
    };
    account_address?: string;
    updated_at?: string;
}

export interface Collection {
    contract_address: string;
    name: string;
    description?: string;
    image?: string;
    total_supply?: number;
    asset_count: number;
    contract_type: string;
}

export interface ERC20Token {
    contract_address: string;
    name: string;
    symbol: string;
    decimals: number;
    balance: string;
    formatted_balance: string;
    logo?: string;
    price_usd?: number;
    value_usd?: number;
}

export interface TransferParams {
    fromAddress: string;
    toAddress: string;
    contractAddress: string;
    tokenId: string;
    amount: string;
    transferType: 'nft' | 'erc20';
    selectedAsset: Asset | null;
    selectedCollection: Collection | null;
    selectedToken: ERC20Token | null;
    userCollections: Collection[];
    userAssets: Asset[];
    userTokens: ERC20Token[];
    loadingCollections: boolean;
    loadingAssets: boolean;
    loadingTokens: boolean;
}

export interface TransferResult {
    method: string;
    description: string;
    request?: Record<string, unknown>;
    response?: Record<string, unknown>;
    formatted?: string;
    error?: string;
    success?: boolean;
}

// API Response Types
export interface ExplorerTokenItem {
    token: {
        address_hash: string;
        name: string;
        symbol: string;
        decimals: string;
        type: 'ERC-20' | 'ERC-721' | 'ERC-1155';
        icon_url?: string;
        holders_count?: string;
        total_supply?: string;
    };
    value: string;
    token_id?: string;
}

export interface ExplorerApiResponse {
    items: ExplorerTokenItem[];
    next_page_params?: Record<string, unknown>;
}

export interface NetworkConfig {
    chainName: string;
    apiBaseUrl: string;
    explorerBaseUrl: string;
}

export type Network = 'testnet' | 'mainnet';

export interface TokenMetadata {
    name: string;
    symbol: string;
    decimals: number;
}

export interface NFTOwnerResponse {
    result: Array<{
        chain: {
            id: string;
            name: string;
        };
        contract_address: string;
        contract_type: string;
        token_id: string;
        account_address: string;
        quantity: string;
        balance: string;
        updated_at: string;
    }>;
    page: {
        previous_cursor?: string;
        next_cursor?: string;
    };
}

export interface NFTMetadataResponse {
    result: Array<{
        chain: {
            id: string;
            name: string;
        };
        token_id: string;
        contract_address: string;
        contract_type: string;
        indexed_at: string;
        updated_at: string;
        metadata_synced_at: string;
        metadata_id?: string;
        name?: string;
        description?: string;
        image?: string;
        external_link?: string;
        animation_url?: string;
        youtube_url?: string;
        attributes?: Array<{
            trait_type: string;
            value: string;
        }>;
        total_supply?: string;
    }>;
    page: {
        previous_cursor?: string;
        next_cursor?: string;
    };
}
