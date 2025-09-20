<script lang="ts">
  import { onMount } from 'svelte';
  import InputField from './InputField.svelte';
  import ResultPanel from './ResultPanel.svelte';
  import {
    fetchUserCollections,
    fetchCollectionAssets,
    fetchUserERC20Tokens,
    executeTransfer,
    checkCustomToken
  } from '../utils/transferHelpers';
  import type { TransferParams, Asset, Collection, ERC20Token } from '../types/transfer';

  export let userAddress: string | null = null;
  export let currentNetwork: 'testnet' | 'mainnet' = 'testnet';
  export let signer: any = null;
  export let provider: any = null;
  export let isConnected: boolean = false;

  let transferParams: TransferParams = {
    fromAddress: '',
    toAddress: '',
    contractAddress: '',
    tokenId: '',
    amount: '1',
    transferType: 'nft',
    selectedAsset: null,
    selectedCollection: null,
    selectedToken: null,
    userCollections: [],
    userAssets: [],
    userTokens: [],
    loadingCollections: false,
    loadingAssets: false,
    loadingTokens: false
  };

  let result: any = null;

  function switchTransferType(type: 'nft' | 'erc20') {
    transferParams.transferType = type;
    transferParams.selectedAsset = null;
    transferParams.selectedCollection = null;
    transferParams.selectedToken = null;
    transferParams.userAssets = [];
    transferParams.amount = '1';

    if (type === 'nft' && transferParams.userCollections.length === 0) {
      handleFetchCollections();
    } else if (type === 'erc20' && transferParams.userTokens.length === 0) {
      handleFetchTokens();
    }
  }

  function selectCollection(collection: Collection) {
    transferParams.selectedCollection = collection;
    transferParams.selectedAsset = null;
    transferParams.userAssets = [];
    handleFetchCollectionAssets();
  }

  function selectAsset(asset: Asset) {
    transferParams.selectedAsset = asset;
    transferParams.contractAddress = asset.token_address;
    transferParams.tokenId = asset.token_id;

    if (asset.metadata?.schema === 'ERC1155') {
      transferParams.amount = asset.balance || '1';
    } else {
      transferParams.amount = '1';
    }
  }

  function selectToken(token: ERC20Token) {
    transferParams.selectedToken = token;
    transferParams.contractAddress = token.contract_address;
    transferParams.amount = '1';
  }

  function goBackToCollections() {
    transferParams.selectedCollection = null;
    transferParams.selectedAsset = null;
    transferParams.userAssets = [];
  }

  function goBackToTokens() {
    transferParams.selectedToken = null;
  }

  async function handleFetchCollections() {
    if (!userAddress) return;

    try {
      transferParams.loadingCollections = true;
      transferParams.userCollections = [];

      const collections = await fetchUserCollections(userAddress, currentNetwork);
      transferParams.userCollections = collections;
      transferParams.loadingCollections = false;
    } catch (error) {
      console.error('Error fetching collections:', error);
      transferParams.loadingCollections = false;
      result = {
        method: 'Transfer assets',
        description: 'Transfer NFTs or tokens between addresses.',
        error: `Failed to load collections: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  let customTokenAddress = '';

  async function handleFetchTokens() {
    if (!userAddress) return;

    try {
      transferParams.loadingTokens = true;
      transferParams.userTokens = [];

      const tokens = await fetchUserERC20Tokens(userAddress, currentNetwork, provider);
      transferParams.userTokens = tokens;
      transferParams.loadingTokens = false;
    } catch (error) {
      console.error('Error fetching tokens:', error);
      transferParams.loadingTokens = false;
      result = {
        method: 'Transfer assets',
        description: 'Transfer NFTs or tokens between addresses.',
        error: `Failed to load tokens: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async function handleCheckCustomToken() {
    if (!customTokenAddress || !userAddress || !provider) return;

    try {
      transferParams.loadingTokens = true;

      const customToken = await checkCustomToken(customTokenAddress, userAddress, provider);

      if (customToken) {
        // Add to existing tokens or create new list
        const existingTokens = transferParams.userTokens || [];
        const existingIndex = existingTokens.findIndex(
          (t) => t.contract_address.toLowerCase() === customTokenAddress.toLowerCase()
        );

        if (existingIndex >= 0) {
          existingTokens[existingIndex] = customToken;
        } else {
          existingTokens.push(customToken);
        }

        transferParams.userTokens = existingTokens.sort(
          (a, b) => parseFloat(b.formatted_balance) - parseFloat(a.formatted_balance)
        );

        result = {
          method: 'Custom Token Check',
          description: `Found token: ${customToken.symbol} with balance ${customToken.formatted_balance}`,
          success: true
        };
      } else {
        result = {
          method: 'Custom Token Check',
          description: `No balance found for token at ${customTokenAddress}`,
          error: 'Zero balance'
        };
      }

      transferParams.loadingTokens = false;
    } catch (error) {
      console.error('Error checking custom token:', error);
      transferParams.loadingTokens = false;
      result = {
        method: 'Custom Token Check',
        description: 'Failed to check custom token',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async function handleFetchCollectionAssets() {
    if (!userAddress || !transferParams.selectedCollection) return;

    try {
      transferParams.loadingAssets = true;
      transferParams.userAssets = [];

      const assets = await fetchCollectionAssets(
        userAddress,
        transferParams.selectedCollection.contract_address,
        currentNetwork
      );
      transferParams.userAssets = assets;
      transferParams.loadingAssets = false;
    } catch (error) {
      console.error('Error fetching collection assets:', error);
      transferParams.loadingAssets = false;
      result = {
        method: 'Transfer assets',
        description: 'Transfer NFTs or tokens between addresses.',
        error: `Failed to load assets: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async function handleTransfer() {
    if (!signer) {
      result = {
        method: 'Transfer assets',
        description: 'Transfer NFTs or tokens between addresses.',
        error: 'Please connect your wallet first'
      };
      return;
    }

    try {
      result = await executeTransfer(transferParams, signer);
    } catch (error) {
      console.error('Transfer failed:', error);
      result = {
        method: 'Transfer assets',
        description: 'Transfer NFTs or tokens between addresses.',
        error: error instanceof Error ? error.message : 'Failed to transfer asset'
      };
    }
  }

  onMount(() => {
    transferParams.fromAddress = userAddress || '';

    if (userAddress && isConnected) {
      // Start with NFTs by default
      handleFetchCollections();
    }
  });

  $: if (userAddress) {
    transferParams.fromAddress = userAddress;
  }
</script>

<div class="space-y-6 mb-4">
  <!-- Transfer Type Selection -->
  <div class="border-b pb-4">
    <h4 class="text-lg font-medium text-gray-900 mb-4">Select Transfer Type</h4>
    <div class="flex gap-2">
      <button
        class="flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors {transferParams.transferType ===
        'nft'
          ? 'bg-indigo-100 text-indigo-700'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
        on:click={() => switchTransferType('nft')}
      >
        NFTs
      </button>
      <button
        class="flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors {transferParams.transferType ===
        'erc20'
          ? 'bg-indigo-100 text-indigo-700'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
        on:click={() => switchTransferType('erc20')}
      >
        ERC-20 Tokens
      </button>
    </div>
  </div>

  {#if transferParams.transferType === 'nft'}
    <!-- NFT Transfer Flow -->
    {#if !transferParams.selectedCollection}
      <!-- Collection Selection Section -->
      <div class="border-b pb-6">
        <h4 class="text-lg font-medium text-gray-900 mb-4">Select Collection</h4>

        {#if transferParams.loadingCollections}
          <div class="flex items-center justify-center py-8">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <span class="ml-3 text-gray-600">Loading your collections...</span>
          </div>
        {:else if transferParams.userCollections.length === 0}
          <div class="text-center py-8">
            <p class="text-gray-500">No collections found in your wallet.</p>
            <button
              class="mt-2 text-indigo-600 hover:text-indigo-800 text-sm font-medium"
              on:click={handleFetchCollections}
            >
              Refresh Collections
            </button>
          </div>
        {:else}
          <div
            class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto"
          >
            {#each transferParams.userCollections as collection}
              <div
                class="border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md border-gray-200 hover:border-gray-300"
                on:click={() => selectCollection(collection)}
                role="button"
                tabindex="0"
                on:keydown={(e) => e.key === 'Enter' && selectCollection(collection)}
              >
                <div class="flex items-start space-x-3">
                  {#if collection.image}
                    <img
                      src={collection.image}
                      alt={collection.name}
                      class="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                      loading="lazy"
                    />
                  {:else}
                    <div
                      class="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0"
                    >
                      <span class="text-gray-400 text-xs">No Image</span>
                    </div>
                  {/if}

                  <div class="flex-1 min-w-0">
                    <h5 class="text-sm font-medium text-gray-900 truncate">
                      {collection.name}
                    </h5>
                    {#if collection.description}
                      <p class="text-xs text-gray-500 truncate mt-1">
                        {collection.description}
                      </p>
                    {/if}
                    <div class="flex items-center justify-between mt-2">
                      <span class="text-xs text-indigo-600 font-medium">
                        {collection.asset_count} asset{collection.asset_count !== 1 ? 's' : ''}
                      </span>
                      <span class="text-xs text-gray-400">
                        {collection.contract_type}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {:else}
      <!-- Asset Selection Section -->
      <div class="border-b pb-6">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h4 class="text-lg font-medium text-gray-900">
              Select Asset from {transferParams.selectedCollection.name}
            </h4>
            <p class="text-sm text-gray-500">
              {transferParams.selectedCollection.asset_count} asset{transferParams
                .selectedCollection.asset_count !== 1
                ? 's'
                : ''} available
            </p>
          </div>
          <button
            class="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
            on:click={goBackToCollections}
          >
            ← Back to Collections
          </button>
        </div>

        {#if transferParams.loadingAssets}
          <div class="flex items-center justify-center py-8">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <span class="ml-3 text-gray-600">Loading assets...</span>
          </div>
        {:else if transferParams.userAssets.length === 0}
          <div class="text-center py-8">
            <p class="text-gray-500">No assets found in this collection.</p>
            <button
              class="mt-2 text-indigo-600 hover:text-indigo-800 text-sm font-medium"
              on:click={handleFetchCollectionAssets}
            >
              Refresh Assets
            </button>
          </div>
        {:else}
          <div
            class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto"
          >
            {#each transferParams.userAssets as asset}
              <div
                class="border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md {transferParams
                  .selectedAsset?.token_id === asset.token_id &&
                transferParams.selectedAsset?.token_address === asset.token_address
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-gray-200 hover:border-gray-300'}"
                on:click={() => selectAsset(asset)}
                role="button"
                tabindex="0"
                on:keydown={(e) => e.key === 'Enter' && selectAsset(asset)}
              >
                <div class="flex items-start space-x-3">
                  {#if asset.image_url}
                    <img
                      src={asset.image_url}
                      alt={asset.name || `Token #${asset.token_id}`}
                      class="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                      loading="lazy"
                    />
                  {:else}
                    <div
                      class="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0"
                    >
                      <span class="text-gray-400 text-xs">No Image</span>
                    </div>
                  {/if}

                  <div class="flex-1 min-w-0">
                    <h5 class="text-sm font-medium text-gray-900 truncate">
                      {asset.name || `Token #${asset.token_id}`}
                    </h5>
                    <p class="text-xs text-gray-400 font-mono">
                      #{asset.token_id}
                    </p>
                    {#if asset.balance && asset.balance !== '1'}
                      <p class="text-xs text-indigo-600">
                        Balance: {asset.balance}
                      </p>
                    {/if}
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  {:else}
    <!-- ERC-20 Token Selection -->
    <div class="border-b pb-6">
      <h4 class="text-lg font-medium text-gray-900 mb-4">Select Token</h4>

      {#if transferParams.loadingTokens}
        <div class="flex items-center justify-center py-8">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <span class="ml-3 text-gray-600">Loading your tokens...</span>
        </div>
      {:else if transferParams.userTokens.length === 0}
        <div class="text-center py-8">
          <p class="text-gray-500">No ERC-20 tokens found in your wallet.</p>
          <button
            class="mt-2 text-indigo-600 hover:text-indigo-800 text-sm font-medium"
            on:click={handleFetchTokens}
          >
            Refresh Tokens
          </button>

          <!-- Custom Token Input -->
          <div class="mt-6 max-w-md mx-auto">
            <p class="text-sm text-gray-600 mb-2">Or check a specific token address:</p>
            <div class="flex gap-2">
              <input
                type="text"
                bind:value={customTokenAddress}
                placeholder="Enter token contract address (0x...)"
                class="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <button
                on:click={handleCheckCustomToken}
                disabled={!customTokenAddress || transferParams.loadingTokens}
                class="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Check
              </button>
            </div>
            <p class="text-xs text-gray-500 mt-1">
              This will check if you have a balance for the specified token contract.
            </p>
          </div>
        </div>
      {:else}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
          {#each transferParams.userTokens as token}
            <div
              class="border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md {transferParams
                .selectedToken?.contract_address === token.contract_address
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-200 hover:border-gray-300'}"
              on:click={() => selectToken(token)}
              role="button"
              tabindex="0"
              on:keydown={(e) => e.key === 'Enter' && selectToken(token)}
            >
              <div class="flex items-start space-x-3">
                {#if token.logo}
                  <img
                    src={token.logo}
                    alt={token.name}
                    class="w-12 h-12 object-cover rounded-full flex-shrink-0"
                    loading="lazy"
                  />
                {:else}
                  <div
                    class="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0"
                  >
                    <span class="text-gray-400 text-xs font-mono">{token.symbol.slice(0, 3)}</span>
                  </div>
                {/if}

                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between">
                    <h5 class="text-sm font-medium text-gray-900 truncate">
                      {token.name}
                    </h5>
                    <span class="text-xs text-gray-500 font-mono">{token.symbol}</span>
                  </div>
                  <p class="text-sm text-gray-600 mt-1">
                    Balance: {token.formatted_balance}
                  </p>
                  {#if token.value_usd}
                    <p class="text-xs text-green-600 mt-1">
                      ≈ ${token.value_usd.toFixed(2)} USD
                    </p>
                  {/if}
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  <!-- Transfer Form Section -->
  {#if (transferParams.transferType === 'nft' && transferParams.selectedAsset) || (transferParams.transferType === 'erc20' && transferParams.selectedToken)}
    <div class="space-y-4">
      <h4 class="text-lg font-medium text-gray-900">Transfer Details</h4>

      <!-- Selected Asset/Token Display -->
      <div class="bg-gray-50 rounded-lg p-4">
        <h5 class="text-sm font-medium text-gray-900 mb-2">
          Selected {transferParams.transferType === 'nft' ? 'Asset' : 'Token'}:
        </h5>
        <div class="flex items-center space-x-3">
          {#if transferParams.transferType === 'nft' && transferParams.selectedAsset}
            {#if transferParams.selectedAsset.image_url}
              <img
                src={transferParams.selectedAsset.image_url}
                alt={transferParams.selectedAsset.name ||
                  `Token #${transferParams.selectedAsset.token_id}`}
                class="w-12 h-12 object-cover rounded-lg"
              />
            {:else}
              <div class="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                <span class="text-gray-400 text-xs">No Image</span>
              </div>
            {/if}
            <div>
              <p class="text-sm font-medium">
                {transferParams.selectedAsset.name ||
                  `Token #${transferParams.selectedAsset.token_id}`}
              </p>
              <p class="text-xs text-gray-500">
                {transferParams.selectedCollection?.name || 'Unknown Collection'}
              </p>
              <p class="text-xs text-gray-400 font-mono">
                Token ID: {transferParams.selectedAsset.token_id}
              </p>
            </div>
          {:else if transferParams.transferType === 'erc20' && transferParams.selectedToken}
            {#if transferParams.selectedToken.logo}
              <img
                src={transferParams.selectedToken.logo}
                alt={transferParams.selectedToken.name}
                class="w-12 h-12 object-cover rounded-full"
              />
            {:else}
              <div class="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                <span class="text-gray-400 text-xs font-mono"
                  >{transferParams.selectedToken.symbol.slice(0, 3)}</span
                >
              </div>
            {/if}
            <div>
              <p class="text-sm font-medium">
                {transferParams.selectedToken.name} ({transferParams.selectedToken.symbol})
              </p>
              <p class="text-xs text-gray-500">
                Balance: {transferParams.selectedToken.formatted_balance}
              </p>
              <p class="text-xs text-gray-400 font-mono">
                {transferParams.selectedToken.contract_address.slice(0, 10)}...
              </p>
            </div>
          {/if}
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InputField
          id="transfer-from"
          bind:value={transferParams.fromAddress}
          label="From Address"
          placeholder={userAddress || '0x...'}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50"
          required={true}
          description="Address sending the asset (your address)."
          readonly={true}
        />

        <InputField
          id="transfer-to"
          bind:value={transferParams.toAddress}
          label="To Address"
          placeholder="0x..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          required={true}
          description="Address receiving the asset."
        />
      </div>

      {#if transferParams.transferType === 'nft'}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputField
            id="transfer-contract"
            bind:value={transferParams.contractAddress}
            label="Contract Address"
            placeholder="0x..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50"
            required={true}
            description="The NFT contract address (auto-filled)."
            readonly={true}
          />

          <InputField
            id="transfer-token-id"
            bind:value={transferParams.tokenId}
            label="Token ID"
            placeholder="1"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50"
            required={true}
            description="The token ID to transfer (auto-filled)."
            readonly={true}
          />
        </div>

        {#if transferParams.selectedAsset?.balance && transferParams.selectedAsset.balance !== '1'}
          <InputField
            id="transfer-amount"
            bind:value={transferParams.amount}
            label="Amount"
            placeholder="1"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            description="Amount to transfer (max: {transferParams.selectedAsset.balance})."
          />
        {/if}
      {:else}
        <InputField
          id="transfer-amount"
          bind:value={transferParams.amount}
          label="Amount"
          placeholder="1.0"
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          required={true}
          description="Amount to transfer (max: {transferParams.selectedToken?.formatted_balance ||
            '0'})."
        />
      {/if}

      <button class="btn-primary" on:click={handleTransfer}>
        Transfer Selected {transferParams.transferType === 'nft' ? 'Asset' : 'Token'}
      </button>
    </div>
  {:else}
    <div class="text-center py-4">
      <p class="text-gray-500">
        {#if transferParams.transferType === 'nft'}
          {transferParams.selectedCollection
            ? 'Select an asset above to continue with the transfer.'
            : 'Select a collection above to view available assets.'}
        {:else}
          Select a token above to continue with the transfer.
        {/if}
      </p>
    </div>
  {/if}
</div>

<!-- Result Display -->
{#if result}
  <ResultPanel result={result} />
{/if}
