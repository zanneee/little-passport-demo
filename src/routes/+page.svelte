<script lang="ts">
  import { onMount } from 'svelte';
  import { passport, config } from '@imtbl/sdk';
  import SignTypedDataForm from '../components/SignTypedDataForm.svelte';
  import InputField from '../components/InputField.svelte';
  import ResultPanel from '../components/ResultPanel.svelte';
  import AddressList from '../components/AddressList.svelte';
  import AccordionMenu from '../components/AccordionMenu.svelte';
  import TransferAssets from '../components/TransferAssets.svelte';
  import { jwtDecode } from 'jwt-decode';
  import { BrowserProvider, Contract, ethers } from 'ethers';
  import type { Eip1193Provider } from 'ethers';
  import { NETWORK_CONFIG, ERROR_MESSAGES, DEFAULT_TRANSACTION } from '../constants/network';
  import {
    calculateKeccak256Hash,
    encodeFunctionCall,
    decodeTransaction as decodeTransactionUtil,
    parseParameters
  } from '../utils/encodingUtils';
  import type {
    UserProfile,
    TokenState,
    TransactionState,
    PassportProvider,
    Transaction,
    BlockTransaction
  } from '../types';
  import { setResult, setError, resetDisplayOrder } from '../utils/helpers';

  // Types
  interface UserProfile {
    email?: string;
    nickname?: string;
    sub: string;
  }

  interface TokenState {
    idToken: string | null;
    accessToken: string | null;
    decodedIdToken: any | null;
    decodedAccessToken: any | null;
  }

  interface TransactionState {
    params: {
      to: string;
      data: string;
      value: string;
    };
    hash: string | null;
    error: string | null;
    sending: boolean;
  }

  interface PassportProvider extends Eip1193Provider {
    on: (event: string, callback: (accounts: string[]) => void) => void;
  }

  interface Transaction {
    hash: string;
    from: string;
    to?: string;
    value: string;
    gas: string;
  }

  interface BlockTransaction {
    blockHash: string;
    blockNumber: string;
    from: string;
    gas: string;
    gasPrice: string;
    hash: string;
    input: string;
    nonce: string;
    to: string | null;
    transactionIndex: string;
    value: string;
    type: string;
    v: string;
    r: string;
    s: string;
  }

  // State
  let passportInstance: passport.Passport | null;
  let passportProvider: PassportProvider;
  let browserProvider: BrowserProvider | null = null;
  let isConnected = false;
  let userAddress: string | null = null;
  let userInfo: UserProfile | null = null;
  let linkedAddresses: string[] | null = null;
  let displayOrder: string[] = [];
  let balance: string | null = null;
  let signer: ethers.JsonRpcSigner | null = null;
  let result: any = null;

  // Keccak-256 variables
  let keccakInput = '';
  let keccakInputType = 'utf8';
  let keccakResult = '';
  let functionSelector = '';

  // Transaction encoding variables
  let encodeFunctionSignature = '';
  let encodeParameters = '';
  let encodeResult = '';
  let decodeTransactionData = '';
  let decodeABI = '';
  let decodeResult = '';

  // Placeholder text for ABI input
  const abiPlaceholder =
    '[{"name":"transfer","type":"function","inputs":[{"name":"to","type":"address"},{"name":"amount","type":"uint256"}]}]';

  // Placeholder text for encode parameters
  const encodeParamsPlaceholder =
    '["0x742d35Cc6635C0532925a3b8D4C9db96C3a8b4B", "1000000000000000000"]';
  let currentNetwork: 'testnet' | 'mainnet' = 'testnet';
  let showTransactionForm = false;
  let showBlockByHashForm = false;
  let showTransactionByHashForm = false;
  let showSignTypedDataForm = false;
  let showPersonalSignForm = false;

  let tokenState: TokenState = {
    idToken: null,
    accessToken: null,
    decodedIdToken: null,
    decodedAccessToken: null
  };

  let transactionState: TransactionState = {
    params: {
      to: '',
      data: '',
      value: ''
    },
    hash: null,
    error: null,
    sending: false
  };

  // 1. signTypedDataParams, personalSignParams를 먼저 선언
  let signTypedDataParams = {
    typedData: {
      domain: {
        name: 'Ether Mail',
        version: '1',
        chainId: 13473,
        verifyingContract: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826'
      },
      message: {
        from: {
          name: 'Cow',
          wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826'
        },
        to: {
          name: 'Bob',
          wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB'
        },
        contents: 'Hello, Bob!'
      },
      primaryType: 'Mail',
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' }
        ],
        Person: [
          { name: 'name', type: 'string' },
          { name: 'wallet', type: 'address' }
        ],
        Mail: [
          { name: 'from', type: 'Person' },
          { name: 'to', type: 'Person' },
          { name: 'contents', type: 'string' }
        ]
      }
    }
  };

  let personalSignParams = {
    message: 'Hello, Immutable zkEVM',
    fromAddress: ''
  };

  // 2. 그 다음에 params 객체 선언
  let params = {
    transaction: {
      to: '',
      value: '',
      data: '',
      gasLimit: '',
      maxFeePerGas: '',
      maxPriorityFeePerGas: ''
    },
    storage: {
      address: '',
      slot: '0x0',
      blockParam: 'latest',
      customBlockNumber: ''
    },
    estimateGas: {
      to: '',
      data: '0x',
      value: '0x0',
      blockParam: 'latest',
      customBlockNumber: ''
    },
    call: {
      to: '',
      data: '0x',
      value: '0x0',
      blockNumber: 'latest'
    },
    blockByHash: {
      blockHash: '',
      includeTransactions: false
    },
    blockByNumber: {
      blockNumber: 'latest',
      includeTransactions: false,
      customBlockNumber: ''
    },
    transactionByHash: {
      hash: ''
    },
    transactionCount: {
      address: '',
      blockNumber: 'latest',
      customBlockNumber: ''
    },
    getCode: {
      address: '',
      blockNumber: 'latest',
      customBlockNumber: ''
    },
    signTypedData: signTypedDataParams,
    personalSign: personalSignParams,
    balance: {
      address: '',
      blockParam: 'latest',
      customBlockNumber: ''
    },
    transactionReceipt: {
      hash: ''
    },
    mintRequest: {
      chainName: '',
      contractAddress: '',
      contractType: 'ERC721',
      mintType: 'mintBatch',
      ownerAddress: '',
      referenceId: '',
      tokenId: '',
      amount: '1',
      quantity: '1',
      includeMetadata: true,
      metadata: {
        name: '',
        description: '',
        image: '',
        externalUrl: '',
        animationUrl: '',
        youtubeUrl: '',
        attributes: [] as Array<{ trait_type: string; value: string }>
      }
    }
  };

  let formVisibility = {
    transaction: false,
    blockByHash: false,
    transactionByHash: false,
    signTypedData: false,
    personalSign: false,
    mintRequest: false
  };

  let menuState = {
    actions: false,
    rpcMethods: false
  };

  let estimateGasParams = {
    to: '',
    data: '0x',
    value: '0x0',
    blockParam: 'latest',
    customBlockNumber: ''
  };

  let callParams = {
    to: '',
    data: '0x',
    value: '0x0',
    blockNumber: 'latest'
  };

  let blockByHashParams = {
    blockHash: '',
    includeTransactions: false
  };

  let blockByNumberParams = {
    blockNumber: 'latest',
    includeTransactions: false,
    customBlockNumber: ''
  };

  let transactionByHashParams = {
    hash: ''
  };

  let transactionCountParams = {
    address: '',
    blockNumber: 'latest',
    customBlockNumber: ''
  };

  let getCodeParams = {
    address: '',
    blockNumber: 'latest',
    customBlockNumber: ''
  };

  let balanceParams = {
    address: '',
    blockParam: 'latest',
    customBlockNumber: ''
  };

  let transactionReceiptParams = {
    hash: ''
  };

  const identityMenuItems = [
    { label: 'Get ID Token', onClick: () => handleGetIdToken() },
    { label: 'Get Access Token', onClick: () => handleGetAccessToken() },
    { label: 'Get User Info', onClick: () => handleGetUserInfo() },
    { label: 'Get User Info (REST API)', onClick: () => handleGetUserInfoRestApi() },
    { label: 'Get Linked Addresses', onClick: () => handleGetLinkedAddresses() }
  ];

  const rpcMenuItems = [
    { label: 'Request Accounts', onClick: () => handleRpcCall('eth_requestAccounts') },
    { label: 'Send Transaction', onClick: () => handleRpcCall('eth_sendTransaction') },
    { label: 'Get Accounts', onClick: () => handleRpcCall('eth_accounts') },
    { label: 'Get Gas Price', onClick: () => handleRpcCall('eth_gasPrice') },
    { label: 'Get Balance', onClick: () => handleRpcCall('eth_getBalance') },
    { label: 'Get Storage', onClick: () => handleRpcCall('eth_getStorageAt') },
    { label: 'Get Estimate Gas', onClick: () => handleRpcCall('eth_estimateGas') },
    { label: 'Call', onClick: () => handleRpcCall('eth_call') },
    { label: 'Get Chain ID', onClick: () => handleRpcCall('eth_chainId') },
    { label: 'Get Block Number', onClick: () => handleRpcCall('eth_blockNumber') },
    { label: 'Get Block By Hash', onClick: () => handleRpcCall('eth_getBlockByHash') },
    { label: 'Get Block By Number', onClick: () => handleRpcCall('eth_getBlockByNumber') },
    { label: 'Get Transaction By Hash', onClick: () => handleRpcCall('eth_getTransactionByHash') },
    { label: 'Get Transaction Receipt', onClick: () => handleRpcCall('eth_getTransactionReceipt') },
    { label: 'Get Transaction Count', onClick: () => handleRpcCall('eth_getTransactionCount') },
    { label: 'Get Code', onClick: () => handleRpcCall('eth_getCode') },
    { label: 'Sign Typed Data v4', onClick: () => handleRpcCall('eth_signTypedData_v4') },
    { label: 'Personal Sign', onClick: () => handleRpcCall('personal_sign') }
  ];

  const gameMenuItems = [
    { label: 'Create in-game assets', onClick: () => handleGameBuild() },
    { label: 'Transfer assets', onClick: () => handleTransferAssets() },
    { label: 'Transaction data encoding', onClick: () => handleTransactionDataEncoding() }
  ];

  function getChainNameForNetwork(network: 'testnet' | 'mainnet'): string {
    return network === 'mainnet' ? 'imtbl-zkevm-mainnet' : 'imtbl-zkevm-testnet';
  }

  function getApiBaseUrlForNetwork(network: 'testnet' | 'mainnet'): string {
    return network === 'mainnet'
      ? 'https://api.immutable.com'
      : 'https://api.sandbox.immutable.com';
  }

  function getApiKeyForNetwork(network: 'testnet' | 'mainnet'): string {
    const prefix = network === 'mainnet' ? 'MAINNET' : 'TESTNET';
    return import.meta.env[`VITE_IMMUTABLE_${prefix}_API_KEY`] || '';
  }

  function getNetworkConfig(network: 'testnet' | 'mainnet') {
    return {
      chainName: getChainNameForNetwork(network),
      baseUrl: getApiBaseUrlForNetwork(network),
      apiKey: getApiKeyForNetwork(network)
    };
  }

  function handleGameBuild() {
    // Reset states
    result = null;
    displayOrder = [];

    // Reset form visibility
    formVisibility = {
      transaction: false,
      blockByHash: false,
      transactionByHash: false,
      signTypedData: false,
      personalSign: false,
      mintRequest: false
    };

    // Show mint form
    formVisibility.mintRequest = true;

    // Initialize mint parameters
    params.mintRequest = {
      chainName: getChainNameForNetwork(currentNetwork),
      contractAddress: '',
      contractType: 'ERC721',
      mintType: 'mintBatch',
      ownerAddress: userAddress || '',
      referenceId: '',
      tokenId: '',
      amount: '1',
      quantity: '1',
      includeMetadata: true,
      metadata: {
        name: '',
        description: '',
        image: '',
        externalUrl: '',
        animationUrl: '',
        youtubeUrl: '',
        attributes: [] as Array<{ trait_type: string; value: string }>
      }
    };

    result = {
      method: 'Mint tokens',
      description: 'Create a mint request using Minting API.',
      request: null,
      response: null,
      formatted: null
    };
    displayOrder = ['createMintRequest'];
  }

  function handleTransferAssets() {
    // Reset states
    result = null;
    displayOrder = [];

    // Reset form visibility
    formVisibility = {
      transaction: false,
      blockByHash: false,
      transactionByHash: false,
      signTypedData: false,
      personalSign: false,
      mintRequest: false
    };

    result = {
      method: 'Transfer assets',
      description: 'Transfer NFTs or tokens between addresses. Select from your assets below.',
      request: null,
      response: null,
      formatted: null
    };
    displayOrder = ['transferAssets'];
  }

  function handleTransactionDataEncoding() {
    // Reset states
    result = null;
    displayOrder = [];

    // Reset form visibility
    formVisibility = {
      transaction: false,
      blockByHash: false,
      transactionByHash: false,
      signTypedData: false,
      personalSign: false,
      mintRequest: false
    };

    result = {
      method: 'Transaction data encoding',
      description: 'Encode and decode transaction data for smart contract interactions.',
      request: null,
      response: null,
      formatted: null
    };
    displayOrder = ['transactionDataEncoding'];
  }

  function calculateKeccak256() {
    const result = calculateKeccak256Hash(keccakInput, keccakInputType as 'utf8' | 'hex');
    
    if ('error' in result) {
      keccakResult = 'Error: ' + result.error;
      functionSelector = '';
    } else {
      keccakResult = result.hash;
      functionSelector = result.selector;
      
      console.log('Keccak-256 calculation:', {
        input: keccakInput,
        inputType: keccakInputType,
        hash: result.hash,
        selector: result.selector
      });
    }
  }

  function encodeFunction() {
    // Parse parameters
    const parametersResult = parseParameters(encodeParameters);
    if ('error' in parametersResult) {
      encodeResult = 'Error: ' + parametersResult.error;
      return;
    }

    // Encode function call
    const result = encodeFunctionCall(encodeFunctionSignature, parametersResult);
    
    if ('error' in result) {
      encodeResult = 'Error: ' + result.error;
    } else {
      encodeResult = result.encodedData;
      
      console.log('Function encoding:', {
        signature: encodeFunctionSignature,
        parameters: parametersResult,
        encoded: result.encodedData
      });
    }
  }

  function decodeTransaction() {
    const result = decodeTransactionUtil(decodeTransactionData, decodeABI);
    
    if ('error' in result) {
      decodeResult = 'Error: ' + result.error;
    } else {
      decodeResult = JSON.stringify(result.decodedData, null, 2);
      
      console.log('Transaction decoding:', {
        input: decodeTransactionData,
        decoded: result.decodedData
      });
    }
  }
  async function executeMintRequest() {
    try {
      if (!params.mintRequest.contractAddress) {
        throw new Error('Contract address is required');
      }
      if (!params.mintRequest.ownerAddress) {
        throw new Error('Owner address is required');
      }
      if (!params.mintRequest.referenceId) {
        throw new Error('Reference ID is required');
      }

      const apiKey = getApiKeyForNetwork(currentNetwork);
      if (!apiKey) {
        throw new Error(
          `API Key for ${currentNetwork} is required. Please set VITE_IMMUTABLE_${currentNetwork.toUpperCase()}_API_KEY in your environment.`
        );
      }

      // Validate token ID for specific mint types
      if (
        (params.mintRequest.mintType === 'mintBatch' ||
          params.mintRequest.contractType === 'ERC1155') &&
        !params.mintRequest.tokenId
      ) {
        throw new Error('Token ID is required for this mint type');
      }

      // Validate quantity for mintBatchByQuantity
      if (
        params.mintRequest.mintType === 'mintBatchByQuantity' &&
        params.mintRequest.contractType === 'ERC721'
      ) {
        const quantity = parseInt(params.mintRequest.quantity);
        if (!params.mintRequest.quantity || isNaN(quantity) || quantity <= 0) {
          throw new Error(
            'Quantity is required and must be a positive number for mintBatchByQuantity'
          );
        }
      }

      // Validate amount for ERC1155
      if (
        params.mintRequest.contractType === 'ERC1155' &&
        (!params.mintRequest.amount || parseInt(params.mintRequest.amount) <= 0)
      ) {
        throw new Error('Amount must be greater than 0 for ERC1155');
      }

      // Handle different mint types and build assets array
      let assets: any[] = [];

      if (
        params.mintRequest.mintType === 'mintBatchByQuantity' &&
        params.mintRequest.contractType === 'ERC721'
      ) {
        // For mintBatchByQuantity, create multiple assets with unique reference IDs
        const quantity = parseInt(params.mintRequest.quantity) || 1;

        if (quantity <= 0 || quantity > 100) {
          throw new Error('Quantity must be between 1 and 100');
        }

        for (let i = 0; i < quantity; i++) {
          const mintAsset: any = {
            owner_address: params.mintRequest.ownerAddress,
            reference_id: `${params.mintRequest.referenceId}-${i + 1}`
          };

          // Add metadata if enabled and provided
          if (
            params.mintRequest.includeMetadata &&
            (params.mintRequest.metadata.name ||
              params.mintRequest.metadata.description ||
              params.mintRequest.metadata.image)
          ) {
            const metadata: any = {};

            if (params.mintRequest.metadata.name) {
              metadata.name =
                quantity > 1
                  ? `${params.mintRequest.metadata.name} #${i + 1}`
                  : params.mintRequest.metadata.name;
            }
            if (params.mintRequest.metadata.description)
              metadata.description = params.mintRequest.metadata.description;
            if (params.mintRequest.metadata.image)
              metadata.image = params.mintRequest.metadata.image;
            if (params.mintRequest.metadata.externalUrl)
              metadata.external_url = params.mintRequest.metadata.externalUrl;
            if (params.mintRequest.metadata.animationUrl)
              metadata.animation_url = params.mintRequest.metadata.animationUrl;
            if (params.mintRequest.metadata.youtubeUrl)
              metadata.youtube_url = params.mintRequest.metadata.youtubeUrl;

            // Add attributes if they exist
            if (
              params.mintRequest.metadata.attributes &&
              params.mintRequest.metadata.attributes.length > 0
            ) {
              metadata.attributes = params.mintRequest.metadata.attributes.filter(
                (attr) => attr.trait_type && attr.value
              );
            }

            mintAsset.metadata = metadata;
          }

          assets.push(mintAsset);
        }
      } else {
        // For mintBatch and ERC1155, create a single asset
        const mintAsset: any = {
          owner_address: params.mintRequest.ownerAddress,
          reference_id: params.mintRequest.referenceId
        };

        // Add token_id if specified (for mintBatch or ERC1155)
        if (
          params.mintRequest.tokenId &&
          (params.mintRequest.mintType === 'mintBatch' ||
            params.mintRequest.contractType === 'ERC1155')
        ) {
          mintAsset.token_id = params.mintRequest.tokenId;
        }

        // Add amount for ERC1155
        if (params.mintRequest.contractType === 'ERC1155') {
          mintAsset.amount = params.mintRequest.amount;
        }

        // Add metadata if enabled and provided
        if (
          params.mintRequest.includeMetadata &&
          (params.mintRequest.metadata.name ||
            params.mintRequest.metadata.description ||
            params.mintRequest.metadata.image)
        ) {
          const metadata: any = {};

          if (params.mintRequest.metadata.name) metadata.name = params.mintRequest.metadata.name;
          if (params.mintRequest.metadata.description)
            metadata.description = params.mintRequest.metadata.description;
          if (params.mintRequest.metadata.image) metadata.image = params.mintRequest.metadata.image;
          if (params.mintRequest.metadata.externalUrl)
            metadata.external_url = params.mintRequest.metadata.externalUrl;
          if (params.mintRequest.metadata.animationUrl)
            metadata.animation_url = params.mintRequest.metadata.animationUrl;
          if (params.mintRequest.metadata.youtubeUrl)
            metadata.youtube_url = params.mintRequest.metadata.youtubeUrl;

          // Add attributes if they exist
          if (
            params.mintRequest.metadata.attributes &&
            params.mintRequest.metadata.attributes.length > 0
          ) {
            metadata.attributes = params.mintRequest.metadata.attributes.filter(
              (attr) => attr.trait_type && attr.value
            );
          }

          mintAsset.metadata = metadata;
        }

        assets.push(mintAsset);
      }

      const requestPayload = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-immutable-api-key': apiKey
        },
        body: JSON.stringify({
          assets: assets
        })
      };

      const baseUrl = getApiBaseUrlForNetwork(currentNetwork);

      const url = `${baseUrl}/v1/chains/${params.mintRequest.chainName}/collections/${params.mintRequest.contractAddress}/nfts/mint-requests`;

      console.log('Making mint request to:', url);
      console.log('Request payload:', requestPayload);

      // Show loading state
      result = {
        method: 'Mint tokens',
        description: 'Create a mint request using Minting API.',
        request: requestPayload,
        response: 'Creating mint request...',
        formatted: 'Creating mint request...'
      };

      const response = await fetch(url, requestPayload);
      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}: ${responseData.message || responseData.error || 'Unknown error'}`
        );
      }

      result = {
        method: 'Mint tokens',
        description: 'Create a mint request using Minting API.',
        request: {
          url,
          ...requestPayload,
          body: JSON.parse(requestPayload.body)
        },
        response: responseData,
        formatted: `✅ Mint request created successfully!

${
  params.mintRequest.mintType === 'mintBatchByQuantity' &&
  params.mintRequest.contractType === 'ERC721'
    ? `Quantity: ${params.mintRequest.quantity} NFTs requested\nReference ID Pattern: ${params.mintRequest.referenceId}-1 to ${params.mintRequest.referenceId}-${params.mintRequest.quantity}`
    : `Reference ID: ${params.mintRequest.referenceId}`
}
Rate Limit Info:
- Remaining requests: ${responseData.imx_remaining_mint_requests || 'N/A'}
- Rate limit: ${responseData.imx_mint_requests_limit || 'N/A'}
- Reset time: ${responseData.imx_mint_requests_limit_reset || 'N/A'}

Note: Use the Reference ID${params.mintRequest.mintType === 'mintBatchByQuantity' && params.mintRequest.contractType === 'ERC721' ? 's' : ''} to track the mint status via the mint-requests endpoint or webhooks.`
      };
    } catch (error: any) {
      console.error('Mint request failed:', error);
      result = {
        method: 'Mint tokens',
        description: 'Create a mint request using Minting API.',
        error: error.message || 'Failed to create mint request'
      };
    }
  }

  function addAttribute() {
    params.mintRequest.metadata.attributes = [
      ...params.mintRequest.metadata.attributes,
      { trait_type: '', value: '' }
    ];
  }

  function removeAttribute(index: number) {
    params.mintRequest.metadata.attributes = params.mintRequest.metadata.attributes.filter(
      (_, i) => i !== index
    );
  }

  function handleMenuStateChange(isOpen: boolean) {
    // Reset results when menu state changes
    result = null;
    displayOrder = [];
    // Reset form visibility
    formVisibility = {
      transaction: false,
      blockByHash: false,
      transactionByHash: false,
      signTypedData: false,
      personalSign: false,
      mintRequest: false
    };
  }

  // Update chainId function
  function updateChainId() {
    if (signTypedDataParams?.typedData?.domain) {
      signTypedDataParams.typedData.domain.chainId = NETWORK_CONFIG[currentNetwork].chainId;
    }
  }

  // Initialize Passport instance with environment variables
  function initializePassportInstance(isMainnet: boolean) {
    const prefix = isMainnet ? 'MAINNET' : 'TESTNET';
    const envVars = {
      clientId: import.meta.env[`VITE_IMMUTABLE_${prefix}_CLIENT_ID`],
      publishableKey: import.meta.env[`VITE_IMMUTABLE_${prefix}_PUBLISHABLE_KEY`],
      redirectUri: import.meta.env[`VITE_IMMUTABLE_${prefix}_REDIRECT_URI`],
      logoutUri: import.meta.env[`VITE_IMMUTABLE_${prefix}_LOGOUT_URI`]
    };

    // Check for missing environment variables
    const missingVars = Object.entries(envVars)
      .filter(([_, value]) => !value)
      .map(([key]) => `VITE_IMMUTABLE_${prefix}_${key.toUpperCase()}`);

    if (missingVars.length > 0) {
      console.error('Missing required environment variables:', missingVars.join(', '));
      result = {
        error: `Missing required environment variables: ${missingVars.join(', ')}. Please check your .env file.`
      };
      return null;
    }

    // Log environment variables for debugging (remove in production)
    console.log(`Initializing Passport for ${prefix}:`, {
      environment: isMainnet ? config.Environment.PRODUCTION : config.Environment.SANDBOX,
      clientId: envVars.clientId,
      redirectUri: envVars.redirectUri,
      logoutUri: envVars.logoutUri
    });

    try {
      const logoutMode = import.meta.env.VITE_IMMUTABLE_LOGOUT_MODE;
      const passportConfig: {
        baseConfig: {
          environment: config.Environment;
          publishableKey: string;
        };
        clientId: string;
        redirectUri: string;
        audience: string;
        scope: string;
        logoutMode?: 'silent';
        logoutRedirectUri?: string;
      } = {
        baseConfig: {
          environment: isMainnet ? config.Environment.PRODUCTION : config.Environment.SANDBOX,
          publishableKey: envVars.publishableKey
        },
        clientId: envVars.clientId,
        redirectUri: envVars.redirectUri,
        audience: 'platform_api',
        scope: 'openid offline_access email transact'
      };

      if (logoutMode === 'silent') {
        passportConfig.logoutMode = 'silent';
        passportConfig.logoutRedirectUri = envVars.logoutUri;
      }

      return new passport.Passport(passportConfig);
    } catch (error) {
      console.error('Failed to initialize Passport:', error);
      result = {
        error: `Failed to initialize Passport: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
      return null;
    }
  }

  onMount(() => {
    // Initialize with testnet by default
    currentNetwork = 'testnet';
    const isMainnet = false;

    passportInstance = initializePassportInstance(isMainnet);
    if (passportInstance) {
      initializeProviders();
    }
  });

  // Network switching function
  async function switchNetwork(network: 'testnet' | 'mainnet') {
    try {
      currentNetwork = network;
      updateChainId();

      const isMainnet = network === 'mainnet';
      passportInstance = initializePassportInstance(isMainnet);

      if (!passportInstance) return;

      // Reset states but don't logout
      isConnected = false;
      userAddress = null;
      balance = null;
      signer = null;
      browserProvider = null;
      userInfo = null;
      linkedAddresses = null;
      displayOrder = [];
      result = null;

      // Initialize providers for new network
      await initializeProviders();

      // Update mint request chain name if mint form is open
      if (formVisibility.mintRequest) {
        params.mintRequest.chainName = getChainNameForNetwork(network);
      }
    } catch (error: any) {
      console.error('Failed to switch network:', error);
      result = {
        error: error.message || 'Failed to switch network'
      };
    }
  }

  // Update environment variables
  function updateEnvVars() {
    // ... existing code ...
  }

  // Reinitialize Passport instance
  async function reinitializePassport() {
    // ... existing code ...
  }

  // Reset connection
  async function resetConnection() {
    // ... existing code ...
  }

  // Display result message
  function showResult() {
    // ... existing code ...
  }

  async function initializeProviders() {
    try {
      if (!passportInstance) return;
      passportProvider = await passportInstance!.connectEvm();
      browserProvider = new BrowserProvider(passportProvider);

      // Check if user is already connected
      const accounts = await passportProvider.request({ method: 'eth_accounts' });
      if (accounts && accounts.length > 0) {
        userAddress = accounts[0];
        isConnected = true;
        signer = await browserProvider.getSigner();
        checkBalance();
      }

      passportProvider.on('accountsChanged', (accounts: string[]) => {
        if (accounts.length > 0) {
          userAddress = accounts[0];
          isConnected = true;
        } else {
          userAddress = null;
          isConnected = false;
          balance = null;
        }
      });
    } catch (error) {
      console.error('Failed to initialize providers:', error);
    }
  }

  async function checkBalance() {
    if (!browserProvider || !userAddress) return;

    try {
      const balanceWei = await browserProvider.getBalance(userAddress);
      balance = balanceWei.toString();
    } catch (error) {
      console.error('Failed to get balance:', error);
      balance = null;
    }
  }

  async function handleLogin() {
    try {
      console.log('Starting login process...');

      // Passport 연결 시도
      console.log('Connecting to Passport...');
      passportProvider = await passportInstance!.connectEvm();

      // eth_requestAccounts 호출
      console.log('Requesting accounts...');
      const accounts = await passportProvider.request({ method: 'eth_requestAccounts' });
      console.log('Accounts received:', accounts);

      if (accounts && accounts.length > 0) {
        console.log('Account found, initializing connection...');
        isConnected = true;
        userAddress = accounts[0];

        // BrowserProvider 초기화
        browserProvider = new BrowserProvider(passportProvider);
        signer = await browserProvider.getSigner();
        await checkBalance();
        console.log('Login successful');
      } else {
        console.error('No accounts received');
        isConnected = false;
        userAddress = null;
        balance = null;
        signer = null;
      }
    } catch (error: unknown) {
      console.error('Login failed with error:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack
        });
      }
      isConnected = false;
      userAddress = null;
      balance = null;
      signer = null;

      let errorMessage = 'Login failed: ';
      if (error instanceof Error) {
        if (error.message.includes('Popup closed')) {
          errorMessage +=
            'Please try again and keep the popup open until the connection is established.';
        } else {
          errorMessage += error.message;
        }
      } else {
        errorMessage += 'Unknown error occurred';
      }

      result = { error: errorMessage };
    }
  }

  function addToDisplayOrder(type: string) {
    // Reset form visibility flags except for the current form
    formVisibility.transaction = type === 'sendTransaction';
    formVisibility.blockByHash = type === 'blockByHash';
    formVisibility.transactionByHash = type === 'transactionByHash';
    formVisibility.signTypedData = type === 'signTypedData';
    formVisibility.personalSign = type === 'personalSign';

    // Add new type to displayOrder if it doesn't exist
    if (!displayOrder.includes(type)) {
      displayOrder = [...displayOrder, type];
    }
  }

  async function handleGetIdToken() {
    try {
      // Reset states
      tokenState.accessToken = null;
      tokenState.decodedAccessToken = null;
      result = null;
      displayOrder = [];

      const token = await passportInstance!.getIdToken();
      if (token) {
        tokenState.idToken = token;
        tokenState.decodedIdToken = jwtDecode(token);
        displayOrder = ['idToken'];
      }
    } catch (error: unknown) {
      console.error('Failed to get ID token:', error);
      tokenState.idToken = null;
      tokenState.decodedIdToken = null;
      displayOrder = [];
    }
  }

  async function handleGetAccessToken() {
    try {
      // Reset states
      tokenState.idToken = null;
      tokenState.decodedIdToken = null;
      result = null;
      displayOrder = [];

      const token = await passportInstance!.getAccessToken();
      if (token) {
        tokenState.accessToken = token;
        tokenState.decodedAccessToken = jwtDecode(token);
        displayOrder = ['accessToken'];
      }
    } catch (error: unknown) {
      console.error('Failed to get access token:', error);
      tokenState.accessToken = null;
      tokenState.decodedAccessToken = null;
      displayOrder = [];
    }
  }

  async function handleGetUserInfo() {
    try {
      // Reset states
      linkedAddresses = null;
      result = null;
      displayOrder = [];

      const info = await passportInstance!.getUserInfo();
      if (info) {
        userInfo = info;
        displayOrder = ['userInfo'];
      }
    } catch (error: unknown) {
      console.error('Failed to get user info:', error);
      if ((error as Error).message === 'NOT_LOGGED_IN_ERROR') {
        console.error('User must be logged in to get user info');
      }
      userInfo = null;
      displayOrder = [];
    }
  }

  async function handleGetUserInfoRestApi() {
    try {
      // Reset states
      linkedAddresses = null;
      result = null;
      displayOrder = [];

      const accessToken = await passportInstance!.getAccessToken();
      if (!accessToken) {
        throw new Error('Access token required for REST API call');
      }

      const baseUrl = getApiBaseUrlForNetwork(currentNetwork);
      const response = await fetch(`${baseUrl}/passport-profile/v1/user/info`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const info = await response.json();
      userInfo = info;
      displayOrder = ['userInfo'];
    } catch (error: unknown) {
      console.error('Failed to get user info via REST API:', error);
      userInfo = null;
      displayOrder = [];
    }
  }

  async function handleGetLinkedAddresses() {
    try {
      // Reset states
      userInfo = null;
      result = null;
      displayOrder = [];

      const addresses = await passportInstance!.getLinkedAddresses();
      linkedAddresses = addresses;
      displayOrder = ['linkedAddresses'];
    } catch (error: unknown) {
      console.error('Failed to get linked addresses:', error);
      if ((error as Error).message === 'NOT_LOGGED_IN_ERROR') {
        console.error('User must be logged in to get linked addresses');
      }
      linkedAddresses = null;
      displayOrder = [];
    }
  }

  async function handleLogout() {
    try {
      if (!passportInstance) return;

      // Call logout
      await passportInstance!.logout();

      // Reset all states
      isConnected = false;
      userAddress = null;
      balance = null;
      signer = null;
      browserProvider = null;

      // Reset token states
      tokenState = {
        idToken: null,
        accessToken: null,
        decodedIdToken: null,
        decodedAccessToken: null
      };

      // Reset user info
      userInfo = null;
      linkedAddresses = null;

      // Clear display
      displayOrder = [];
      result = null;

      // Reinitialize providers
      await initializeProviders();
    } catch (error: unknown) {
      console.error('Logout failed:', error);
      result = {
        error: `Logout failed: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
      };
    }
  }

  function getBlockParameter(param: string, customNumber: string): string {
    let blockParameter = param;
    if (blockParameter === 'number') {
      if (!customNumber) {
        throw new Error('Block number is required when "Block number" is selected');
      }
      // Hexadecimal or decimal input processing
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

  async function executeStorageCall() {
    try {
      if (!params.storage.address) {
        throw new Error('Address is required');
      }
      if (!params.storage.slot) {
        throw new Error('Storage slot is required');
      }
      if (!passportProvider) {
        throw new Error('Provider not initialized');
      }
      const blockParam = getBlockParameter(
        params.storage.blockParam,
        params.storage.customBlockNumber
      );
      const requestPayload = {
        method: 'eth_getStorageAt',
        params: [params.storage.address, params.storage.slot, blockParam]
      };
      const storageValue = await passportProvider.request(requestPayload);
      result = {
        method: 'eth_getStorageAt',
        description: 'Returns the value from a storage position at a given address.',
        request: requestPayload,
        response: storageValue,
        formatted: `Storage Value at slot ${params.storage.slot}: ${storageValue}`
      };
      displayOrder = ['eth_getStorageAt'];
    } catch (error: any) {
      result = {
        method: 'eth_getStorageAt',
        description: 'Returns the value from a storage position at a given address.',
        error: error.message || 'Failed to get storage'
      };
      displayOrder = ['eth_getStorageAt'];
    }
  }

  async function executeEstimateGas() {
    params.estimateGas = { ...estimateGasParams };
    try {
      if (!params.estimateGas.to) {
        throw new Error('To address is required');
      }
      if (!passportProvider) {
        throw new Error('Provider not initialized');
      }
      const blockParam = getBlockParameter(
        params.estimateGas.blockParam,
        params.estimateGas.customBlockNumber
      );
      const requestPayload = {
        method: 'eth_estimateGas',
        params: [
          {
            to: params.estimateGas.to,
            from: userAddress || undefined,
            value: params.estimateGas.value || '0x0',
            data: params.estimateGas.data || '0x'
          },
          blockParam
        ]
      };
      const gasEstimate = await passportProvider.request(requestPayload);
      result = {
        method: 'eth_estimateGas',
        description:
          'Generates and returns an estimate of how much gas is necessary to allow the transaction to complete.',
        request: requestPayload,
        response: gasEstimate,
        formatted: `Estimated Gas: ${parseInt(gasEstimate, 16).toLocaleString()} units`
      };
      displayOrder = ['eth_estimateGas'];
    } catch (error: any) {
      result = {
        method: 'eth_estimateGas',
        description:
          'Generates and returns an estimate of how much gas is necessary to allow the transaction to complete.',
        error: error.message || 'Failed to estimate gas'
      };
      displayOrder = ['eth_estimateGas'];
    }
  }

  async function executeGetBalance() {
    params.balance = { ...balanceParams };
    try {
      if (!params.balance.address) {
        throw new Error('Address is required');
      }
      if (!passportProvider) {
        throw new Error('Provider not initialized');
      }
      const balanceBlockParam = getBlockParameter(
        params.balance.blockParam,
        params.balance.customBlockNumber
      );
      const requestPayload = {
        method: 'eth_getBalance',
        params: [params.balance.address, balanceBlockParam]
      };
      const balance = await passportProvider.request(requestPayload);
      const balanceInEther = ethers.formatEther(balance);
      setResult(
        (v) => (result = v),
        {
          method: 'eth_getBalance',
          description: 'Returns the balance of the account of given address in wei.',
          request: requestPayload,
          response: balance,
          formatted: `${balanceInEther} tIMX (${balance} Wei)`
        },
        'eth_getBalance',
        (v) => (displayOrder = v)
      );
    } catch (error: any) {
      setError(
        (v) => (result = v),
        error,
        'eth_getBalance',
        (v) => (displayOrder = v),
        'Returns the balance of the account of given address in wei.'
      );
    }
  }

  async function executeCall() {
    params.call = { ...callParams };
    console.log('Executing contract call');
    console.log('Call params:', params.call);

    try {
      if (!params.call.to) {
        throw new Error('To address is required');
      }

      if (!passportProvider) {
        throw new Error('Provider not initialized');
      }

      // Transaction object configuration
      const transaction: any = {
        to: params.call.to
      };

      if (params.call.data && params.call.data.trim() !== '') {
        transaction.data = params.call.data;
      }

      if (params.call.value && params.call.value.trim() !== '') {
        transaction.value = params.call.value;
      }

      const requestPayload = {
        method: 'eth_call',
        params: [transaction, params.call.blockNumber]
      };

      console.log('Making contract call with payload:', requestPayload);
      const response = await passportProvider.request(requestPayload);
      console.log('Call response:', response);

      result = {
        method: 'eth_call',
        description:
          'Executes a new message call immediately without creating a transaction on the blockchain.',
        request: requestPayload,
        response: response
      };
      displayOrder = ['eth_call'];
    } catch (error: any) {
      console.error('Error making contract call:', error);
      result = {
        method: 'eth_call',
        description:
          'Executes a new message call immediately without creating a transaction on the blockchain.',
        error: error.message || 'Failed to make contract call'
      };
      displayOrder = ['eth_call'];
    }
  }

  async function executeGetBlockByHash() {
    console.log('Executing get block by hash');
    console.log('Block by hash params:', params.blockByHash);

    try {
      if (!params.blockByHash.blockHash) {
        throw new Error('Block hash is required');
      }

      if (!passportProvider) {
        throw new Error('Provider not initialized');
      }

      const requestPayload = {
        method: 'eth_getBlockByHash',
        params: [params.blockByHash.blockHash, params.blockByHash.includeTransactions]
      };

      console.log('Getting block with payload:', requestPayload);
      const response = await passportProvider.request(requestPayload);
      console.log('Block response:', response);

      result = {
        method: 'eth_getBlockByHash',
        description: 'Returns information about a block by hash.',
        request: requestPayload,
        response: response
      };
      displayOrder = ['eth_getBlockByHash'];
    } catch (error: any) {
      console.error('Error getting block:', error);
      result = {
        method: 'eth_getBlockByHash',
        description: 'Returns information about a block by hash.',
        error: error.message || 'Failed to get block'
      };
      displayOrder = ['eth_getBlockByHash'];
    }
  }

  async function executeGetBlockByNumber() {
    params.blockByNumber = { ...blockByNumberParams };
    console.log('Executing get block by number');
    console.log('Block by number params:', params.blockByNumber);

    try {
      if (!passportProvider) {
        throw new Error('Provider not initialized');
      }

      let blockParameter = params.blockByNumber.blockNumber;
      if (blockParameter === 'number') {
        if (!params.blockByNumber.customBlockNumber) {
          throw new Error('Block number is required when "Block number" is selected');
        }
        // Handle both hex and decimal input
        if (params.blockByNumber.customBlockNumber.startsWith('0x')) {
          blockParameter = params.blockByNumber.customBlockNumber;
        } else if (/^\d+$/.test(params.blockByNumber.customBlockNumber)) {
          blockParameter = '0x' + Number(params.blockByNumber.customBlockNumber).toString(16);
        } else {
          throw new Error('Invalid block number format. Use decimal or hex (0x) format');
        }
      }

      const requestPayload = {
        method: 'eth_getBlockByNumber',
        params: [blockParameter, params.blockByNumber.includeTransactions]
      };

      console.log('Getting block with payload:', requestPayload);
      const response = await passportProvider.request(requestPayload);
      console.log('Block response:', response);

      result = {
        method: 'eth_getBlockByNumber',
        description: 'Returns information about a block by block number.',
        request: requestPayload,
        response: response,
        formatted: response
          ? `
Block Number: ${parseInt(response.number, 16).toLocaleString()}
Hash: ${response.hash}
Parent Hash: ${response.parentHash}
Timestamp: ${new Date(parseInt(response.timestamp, 16) * 1000).toLocaleString()}
Gas Used: ${parseInt(response.gasUsed, 16).toLocaleString()}
Gas Limit: ${parseInt(response.gasLimit, 16).toLocaleString()}
Transactions: ${formatTransactions(response.transactions)}`
          : 'Block not found'
      };
      displayOrder = ['eth_getBlockByNumber'];
    } catch (error: any) {
      console.error('Error getting block:', error);
      result = {
        method: 'eth_getBlockByNumber',
        description: 'Returns information about a block by block number.',
        error: error.message || 'Failed to get block'
      };
      displayOrder = ['eth_getBlockByNumber'];
    }
  }

  async function executeGetTransactionByHash() {
    console.log('Executing get transaction by hash');
    console.log('Transaction by hash params:', params.transactionByHash);

    try {
      if (!params.transactionByHash.hash) {
        throw new Error('Transaction hash is required');
      }

      if (!params.transactionByHash.hash.startsWith('0x')) {
        throw new Error('Transaction hash must start with 0x');
      }

      if (!passportProvider) {
        throw new Error('Provider not initialized');
      }

      const requestPayload = {
        method: 'eth_getTransactionByHash',
        params: [params.transactionByHash.hash]
      };

      console.log('Getting transaction with payload:', requestPayload);
      const response = await passportProvider.request(requestPayload);
      console.log('Transaction response:', response);

      if (!response) {
        result = {
          method: 'eth_getTransactionByHash',
          description: 'Returns the information about a transaction requested by transaction hash.',
          request: requestPayload,
          response: null,
          formatted: 'Transaction not found'
        };
      } else {
        const valueInIMX = response.value
          ? (BigInt(response.value) / BigInt(1e18)).toString()
          : '0';
        const gasPrice = response.gasPrice
          ? (BigInt(response.gasPrice) / BigInt(1e9)).toString()
          : '0';

        result = {
          method: 'eth_getTransactionByHash',
          description: 'Returns the information about a transaction requested by transaction hash.',
          request: requestPayload,
          response: response,
          formatted: `Transaction Details:
Hash: ${response.hash}
From: ${response.from}
To: ${response.to || 'Contract Creation'}
Value: ${valueInIMX} IMX
Gas Price: ${gasPrice} Gwei
Gas Limit: ${parseInt(response.gas, 16).toLocaleString()}
Nonce: ${parseInt(response.nonce, 16)}
Block Number: ${response.blockNumber ? parseInt(response.blockNumber, 16).toLocaleString() : 'Pending'}
Block Hash: ${response.blockHash || 'Pending'}
Transaction Index: ${response.transactionIndex ? parseInt(response.transactionIndex, 16) : 'Pending'}`
        };
      }
      displayOrder = ['eth_getTransactionByHash'];
    } catch (error: any) {
      console.error('Error getting transaction:', error);
      result = {
        method: 'eth_getTransactionByHash',
        description: 'Returns the information about a transaction requested by transaction hash.',
        error: error.message || 'Failed to get transaction'
      };
      displayOrder = ['eth_getTransactionByHash'];
    }
  }

  async function handleRpcCall(method: string) {
    try {
      // Reset all states when a new RPC call is made
      result = null;
      displayOrder = [];

      // Reset all form states
      formVisibility = {
        transaction: false,
        blockByHash: false,
        transactionByHash: false,
        signTypedData: false,
        personalSign: false,
        mintRequest: false
      };

      // Reset transaction states
      transactionState = {
        params: {
          to: '',
          data: '',
          value: ''
        },
        hash: null,
        error: null,
        sending: false
      };

      // Reset all params
      params = {
        transaction: {
          to: '',
          value: '',
          data: '',
          gasLimit: '',
          maxFeePerGas: '',
          maxPriorityFeePerGas: ''
        },
        storage: {
          address: '',
          slot: '0x0',
          blockParam: 'latest',
          customBlockNumber: ''
        },
        estimateGas: {
          to: '',
          data: '0x',
          value: '0x0',
          blockParam: 'latest',
          customBlockNumber: ''
        },
        call: {
          to: '',
          data: '0x',
          value: '0x0',
          blockNumber: 'latest'
        },
        blockByHash: {
          blockHash: '',
          includeTransactions: false
        },
        blockByNumber: {
          blockNumber: 'latest',
          includeTransactions: false,
          customBlockNumber: ''
        },
        transactionByHash: {
          hash: ''
        },
        transactionCount: {
          address: '',
          blockNumber: 'latest',
          customBlockNumber: ''
        },
        getCode: {
          address: '',
          blockNumber: 'latest',
          customBlockNumber: ''
        },
        signTypedData: signTypedDataParams,
        personalSign: personalSignParams,
        balance: {
          address: '',
          blockParam: 'latest',
          customBlockNumber: ''
        },
        transactionReceipt: {
          hash: ''
        },
        mintRequest: {
          chainName: '',
          contractAddress: '',
          contractType: 'ERC721',
          mintType: 'mintBatch',
          ownerAddress: '',
          referenceId: '',
          tokenId: '',
          amount: '1',
          quantity: '1',
          includeMetadata: true,
          metadata: {
            name: '',
            description: '',
            image: '',
            externalUrl: '',
            animationUrl: '',
            youtubeUrl: '',
            attributes: [] as Array<{ trait_type: string; value: string }>
          }
        }
      };

      switch (method) {
        case 'eth_requestAccounts':
          try {
            const requestAccountsPayload = { method: 'eth_requestAccounts' };
            const accounts = await passportProvider.request(requestAccountsPayload);
            result = {
              method: 'eth_requestAccounts',
              description: 'Returns the list of accounts the user has granted access to.',
              request: requestAccountsPayload,
              response: accounts,
              formatted: `Connected Accounts:\n${accounts.map((account: string) => `  ${account}`).join('\n')}`
            };
            displayOrder = ['eth_requestAccounts'];
          } catch (error: any) {
            result = {
              method: 'eth_requestAccounts',
              description: 'Returns the list of accounts the user has granted access to.',
              error: error.message || 'Failed to request accounts'
            };
            displayOrder = ['eth_requestAccounts'];
          }
          break;

        case 'eth_accounts':
          const accountsPayload = { method: 'eth_accounts' };
          const accountsList = await passportProvider.request(accountsPayload);
          result = {
            method: 'eth_accounts',
            description:
              'Returns the list of Passport accounts that the user has authorised to connect to the dApp.',
            request: accountsPayload,
            response: accountsList,
            formatted: JSON.stringify(accountsList, null, 2)
          };
          displayOrder = ['eth_accounts'];
          break;

        case 'eth_chainId':
          try {
            const response = await passportProvider.request({
              method: 'eth_chainId',
              params: []
            });
            result = {
              method: 'eth_chainId',
              description: 'Returns the chain ID of the current network.',
              request: { method: 'eth_chainId', params: [] },
              response: response,
              formatted: `Chain ID: ${parseInt(response, 16)} (0x${parseInt(response, 16).toString(16)})`
            };
            displayOrder = ['eth_chainId'];
          } catch (error: any) {
            result = {
              method: 'eth_chainId',
              description: 'Returns the chain ID of the current network.',
              error: error.message || 'Failed to get chain ID'
            };
            displayOrder = ['eth_chainId'];
          }
          break;

        case 'eth_blockNumber':
          try {
            const response = await passportProvider.request({
              method: 'eth_blockNumber',
              params: []
            });
            result = {
              method: 'eth_blockNumber',
              description: 'Returns the number of most recent block.',
              request: { method: 'eth_blockNumber', params: [] },
              response: response,
              formatted: `Current Block Number: ${parseInt(response, 16).toLocaleString()}`
            };
            displayOrder = ['eth_blockNumber'];
          } catch (error: any) {
            result = {
              method: 'eth_blockNumber',
              description: 'Returns the number of most recent block.',
              error: error.message || 'Failed to get block number'
            };
            displayOrder = ['eth_blockNumber'];
          }
          break;

        case 'eth_gasPrice':
          const gasPricePayload = { method: 'eth_gasPrice' };
          const gasPrice = await passportProvider.request(gasPricePayload);
          result = {
            method: 'eth_gasPrice',
            description: 'Returns the current gas price in wei.',
            request: gasPricePayload,
            response: gasPrice,
            formatted: `${(Number(gasPrice) / 1_000_000_000).toFixed(9)} Gwei`
          };
          displayOrder = ['eth_gasPrice'];
          break;

        case 'eth_getBalance':
          params.balance = {
            address: userAddress || '',
            blockParam: 'latest',
            customBlockNumber: ''
          };
          result = {
            method: 'eth_getBalance',
            description: 'Returns the balance of the account of given address in wei.',
            request: null,
            response: null,
            formatted: null
          };
          displayOrder = ['eth_getBalance'];
          break;

        case 'eth_sendTransaction':
          if (!isConnected) {
            await handleLogin();
          }

          formVisibility.transaction = true;
          params.transaction = {
            to: DEFAULT_TRANSACTION.to,
            value: DEFAULT_TRANSACTION.value,
            data: '',
            gasLimit: '',
            maxFeePerGas: '',
            maxPriorityFeePerGas: ''
          };
          result = {
            method: 'eth_sendTransaction',
            description:
              'Creates new message call transaction or a contract creation, if the data field contains code.',
            request: null,
            response: null,
            formatted: null
          };
          displayOrder = ['eth_sendTransaction'];
          break;

        case 'eth_getTransactionCount':
          params.transactionCount = {
            address: userAddress || '',
            blockNumber: 'latest',
            customBlockNumber: ''
          };
          result = {
            method: 'eth_getTransactionCount',
            description: 'Returns the number of transactions sent from an address.',
            request: null,
            response: null
          };
          displayOrder = ['eth_getTransactionCount'];
          break;

        case 'eth_getStorageAt':
          params.storage = {
            address: userAddress || '',
            slot: '0x0',
            blockParam: 'latest',
            customBlockNumber: ''
          };
          result = {
            method: 'eth_getStorageAt',
            description: 'Returns the value from a storage position at a given address.',
            request: null,
            response: null,
            formatted: null
          };
          displayOrder = ['eth_getStorageAt'];
          break;

        case 'eth_estimateGas':
          params.estimateGas = {
            to: userAddress || '',
            data: '0x',
            value: '0x0',
            blockParam: 'latest',
            customBlockNumber: ''
          };
          result = {
            method: 'eth_estimateGas',
            description:
              'Generates and returns an estimate of how much gas is necessary to allow the transaction to complete.',
            request: null,
            response: null,
            formatted: null
          };
          displayOrder = ['eth_estimateGas'];
          break;

        case 'eth_call':
          params.call = {
            to: '',
            data: '0x',
            value: '0x0',
            blockNumber: 'latest'
          };
          result = {
            method: 'eth_call',
            description:
              'Executes a new message call immediately without creating a transaction on the blockchain.',
            request: null,
            response: null
          };
          displayOrder = ['eth_call'];
          break;

        case 'eth_getBlockByHash':
          params.blockByHash = {
            blockHash: '',
            includeTransactions: false
          };
          result = {
            method: 'eth_getBlockByHash',
            description: 'Returns information about a block by hash.',
            request: null,
            response: null
          };
          displayOrder = ['eth_getBlockByHash'];
          break;

        case 'eth_getBlockByNumber':
          params.blockByNumber = {
            blockNumber: 'latest',
            includeTransactions: false,
            customBlockNumber: ''
          };
          result = {
            method: 'eth_getBlockByNumber',
            description: 'Returns information about a block by block number.',
            request: null,
            response: null
          };
          displayOrder = ['eth_getBlockByNumber'];
          break;

        case 'eth_getTransactionByHash':
          params.transactionByHash = {
            hash: ''
          };
          result = {
            method: 'eth_getTransactionByHash',
            description:
              'Returns the information about a transaction requested by transaction hash.',
            request: null,
            response: null
          };
          displayOrder = ['eth_getTransactionByHash'];
          break;

        case 'eth_getTransactionReceipt':
          params.transactionReceipt = {
            hash: ''
          };
          result = {
            method: 'eth_getTransactionReceipt',
            description: 'Returns the receipt of a transaction by transaction hash.',
            request: null,
            response: null
          };
          displayOrder = ['eth_getTransactionReceipt'];
          break;

        case 'eth_getTransactionCount':
          params.transactionCount = {
            address: userAddress || '',
            blockNumber: 'latest',
            customBlockNumber: ''
          };
          result = {
            method: 'eth_getTransactionCount',
            description: 'Returns the number of transactions sent from an address.',
            request: null,
            response: null
          };
          displayOrder = ['eth_getTransactionCount'];
          break;

        case 'eth_getCode':
          params.getCode = {
            address: userAddress || '',
            blockNumber: 'latest',
            customBlockNumber: ''
          };
          result = {
            method: 'eth_getCode',
            description: 'Returns code at a given address.',
            request: null,
            response: null
          };
          displayOrder = ['eth_getCode'];
          break;

        case 'eth_signTypedData_v4':
          formVisibility.signTypedData = true;
          signTypedDataParams.typedData.domain.chainId = NETWORK_CONFIG[currentNetwork].chainId;
          signTypedDataParams.typedData.message.from.wallet =
            userAddress || '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826';
          result = {
            method: 'eth_signTypedData_v4',
            description: 'Enables passport users to sign EIP-712 structured messages off-chain.',
            request: null,
            response: null
          };
          displayOrder = ['eth_signTypedData_v4'];
          break;

        case 'personal_sign':
          formVisibility.personalSign = true;
          personalSignParams = {
            message: 'Hello, Immutable zkEVM',
            fromAddress: userAddress || ''
          };
          result = {
            method: 'personal_sign',
            description: 'Signs a message using the personal_sign method.',
            request: null,
            response: null
          };
          displayOrder = ['personal_sign'];
          break;
      }
    } catch (error: any) {
      console.error(`RPC call failed (${method}):`, error);
      result = {
        method,
        error: error.message || 'Unknown error occurred'
      };
      displayOrder = [method];
    }
  }

  async function sendTransaction() {
    try {
      if (!isConnected) {
        throw new Error('Please login first');
      }

      if (!signer) {
        throw new Error('Signer not initialized');
      }

      const value = params.transaction.value || DEFAULT_TRANSACTION.value;
      const hexValue = `0x${BigInt(value).toString(16)}`;

      const tx = {
        to: params.transaction.to || DEFAULT_TRANSACTION.to,
        value: hexValue,
        data: params.transaction.data || '0x'
      };

      result = {
        method: 'eth_sendTransaction',
        description:
          'Creates new message call transaction or a contract creation, if the data field contains code.',
        request: tx,
        response: 'Sending transaction...',
        formatted: 'Sending transaction...'
      };

      const transactionResponse = await signer.sendTransaction(tx);
      result = {
        method: 'eth_sendTransaction',
        description:
          'Creates new message call transaction or a contract creation, if the data field contains code.',
        request: tx,
        response: transactionResponse,
        formatted: `Transaction Hash: ${transactionResponse.hash}\nWaiting for confirmation...`
      };

      const receipt = await transactionResponse.wait();
      if (!receipt) {
        throw new Error('Transaction receipt is null');
      }

      const details = {
        hash: transactionResponse.hash,
        blockNumber: receipt.blockNumber,
        value: `${ethers.formatEther(tx.value || '0')} tIMX`,
        from: receipt.from,
        to: receipt.to,
        status: receipt.status === 1 ? 'Success' : 'Failed'
      };

      result = {
        method: 'eth_sendTransaction',
        description:
          'Creates new message call transaction or a contract creation, if the data field contains code.',
        request: tx,
        response: receipt,
        formatted: JSON.stringify(details, null, 2)
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error && error.message.includes('DID Token')
          ? 'Error: Please login again. Your session might have expired.'
          : `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`;

      result = {
        method: 'eth_sendTransaction',
        description:
          'Creates new message call transaction or a contract creation, if the data field contains code.',
        error: errorMessage
      };
    }
  }

  function formatTransactions(transactions: any[] | null): string {
    if (!transactions || !Array.isArray(transactions)) return 'No transactions';

    if (transactions.length === 0) return 'No transactions in this block';

    if (typeof transactions[0] === 'string') {
      return (
        `${transactions.length} transactions\n` +
        transactions.map((hash: string) => `  - ${hash}`).join('\n')
      );
    } else {
      return (
        `${transactions.length} transactions\n` +
        transactions
          .map((tx: BlockTransaction) => {
            const valueInIMX = tx.value ? (BigInt(tx.value) / BigInt(1e18)).toString() : '0';
            const gasPrice = tx.gasPrice ? (BigInt(tx.gasPrice) / BigInt(1e9)).toString() : '0';

            return (
              `  - Hash: ${tx.hash}\n` +
              `    From: ${tx.from}\n` +
              `    To: ${tx.to || 'Contract Creation'}\n` +
              `    Value: ${valueInIMX} IMX\n` +
              `    Gas Limit: ${parseInt(tx.gas, 16).toLocaleString()}\n` +
              `    Gas Price: ${gasPrice} Gwei\n` +
              `    Nonce: ${parseInt(tx.nonce, 16)}\n` +
              `    Block Number: ${parseInt(tx.blockNumber, 16).toLocaleString()}\n` +
              `    Transaction Index: ${parseInt(tx.transactionIndex, 16)}`
            );
          })
          .join('\n\n')
      );
    }
  }

  function getSolidityVersion(bytecode: string): string {
    // CBOR encoded metadata to find the last part
    const match = bytecode.match(/a264697066735822/);
    if (!match || match.index === undefined) return 'Unknown';

    const versionMatch = bytecode.slice(match.index - 100, match.index).match(/736f6c6343(.{8})/);
    if (versionMatch) {
      const version = versionMatch[1];
      // Convert hexadecimal to version string
      const major = parseInt(version.slice(0, 2), 16);
      const minor = parseInt(version.slice(2, 4), 16);
      const patch = parseInt(version.slice(4, 6), 16);
      return `v${major}.${minor}.${patch}`;
    }
    return 'Unknown';
  }

  async function executeGetTransactionReceipt() {
    try {
      if (!params.transactionReceipt.hash) {
        throw new Error('Transaction hash is required');
      }
      if (!params.transactionReceipt.hash.startsWith('0x')) {
        throw new Error('Transaction hash must start with 0x');
      }
      if (!passportProvider) {
        throw new Error('Provider not initialized');
      }
      const requestPayload = {
        method: 'eth_getTransactionReceipt',
        params: [params.transactionReceipt.hash]
      };
      const response = await passportProvider.request(requestPayload);
      if (!response) {
        result = {
          method: 'eth_getTransactionReceipt',
          description: 'Returns the receipt of a transaction by transaction hash.',
          request: requestPayload,
          response: null,
          formatted: 'Transaction receipt not found (transaction may be pending)'
        };
        displayOrder = ['eth_getTransactionReceipt'];
        return;
      }
      const gasUsed = parseInt(response.gasUsed, 16).toLocaleString();
      const cumulativeGasUsed = parseInt(response.cumulativeGasUsed, 16).toLocaleString();
      const effectiveGasPrice = response.effectiveGasPrice
        ? (BigInt(response.effectiveGasPrice) / BigInt(1e9)).toString()
        : 'Not available';
      let logs = '';
      if (response.logs && response.logs.length > 0) {
        logs =
          '\n\nEvent Logs:\n' +
          response.logs
            .map(
              (log: any, index: number) =>
                `Log ${index + 1}:\n` +
                `  Address: ${log.address}\n` +
                `  Topics: ${log.topics.join('\n          ')}\n` +
                `  Data: ${log.data}`
            )
            .join('\n\n');
      }
      result = {
        method: 'eth_getTransactionReceipt',
        description: 'Returns the receipt of a transaction by transaction hash.',
        request: requestPayload,
        response: response,
        formatted: `Transaction Receipt:\nHash: ${response.transactionHash}\nStatus: ${response.status === '0x1' ? 'Success' : 'Failed'}\nBlock Number: ${parseInt(response.blockNumber, 16).toLocaleString()}\nBlock Hash: ${response.blockHash}\nFrom: ${response.from}\nTo: ${response.to || 'Contract Creation'}\nContract Address: ${response.contractAddress || 'N/A'}\nGas Used: ${gasUsed}\nCumulative Gas Used: ${cumulativeGasUsed}\nEffective Gas Price: ${effectiveGasPrice} Gwei\nTransaction Index: ${parseInt(response.transactionIndex, 16)}${logs}`
      };
      displayOrder = ['eth_getTransactionReceipt'];
    } catch (error: any) {
      result = {
        method: 'eth_getTransactionReceipt',
        description: 'Returns the receipt of a transaction by transaction hash.',
        error: error.message || 'Failed to get transaction receipt'
      };
      displayOrder = ['eth_getTransactionReceipt'];
    }
  }

  async function executeGetTransactionCount() {
    // UI 입력값을 params.transactionCount에 복사
    params.transactionCount = { ...transactionCountParams };
    console.log('Executing get transaction count');
    console.log('Transaction count params:', params.transactionCount);

    try {
      const address = params.transactionCount.address || userAddress;
      if (!address) {
        throw new Error('Address is required');
      }
      if (!address.startsWith('0x')) {
        throw new Error('Valid address starting with 0x is required');
      }

      const blockParameter = getBlockParameter(
        params.transactionCount.blockNumber,
        params.transactionCount.customBlockNumber
      );

      const requestPayload = {
        method: 'eth_getTransactionCount',
        params: [address, blockParameter]
      };

      console.log('Getting transaction count with payload:', requestPayload);
      const response = await passportProvider.request(requestPayload);
      console.log('Transaction count response:', response);

      result = {
        method: 'eth_getTransactionCount',
        description: 'Returns the number of transactions sent from an address.',
        request: requestPayload,
        response: response,
        formatted: `Number of transactions sent from ${address}: ${parseInt(response, 16).toLocaleString()}`
      };
      displayOrder = ['eth_getTransactionCount'];
    } catch (error: any) {
      console.error('Error getting transaction count:', error);
      result = {
        method: 'eth_getTransactionCount',
        description: 'Returns the number of transactions sent from an address.',
        error: error.message || 'Failed to get transaction count'
      };
      displayOrder = ['eth_getTransactionCount'];
    }
  }

  async function executeGetCode() {
    params.getCode = { ...getCodeParams };
    console.log('Executing get code');
    console.log('Get code params:', params.getCode);

    try {
      if (!params.getCode.address) {
        throw new Error('Address is required');
      }

      if (!params.getCode.address.startsWith('0x')) {
        throw new Error('Valid address starting with 0x is required');
      }

      if (!passportProvider) {
        throw new Error('Provider not initialized');
      }

      let blockParameter = params.getCode.blockNumber;
      if (blockParameter === 'number') {
        if (!params.getCode.customBlockNumber) {
          throw new Error('Block number is required when "Block number" is selected');
        }
        // Handle both hex and decimal input
        if (params.getCode.customBlockNumber.startsWith('0x')) {
          blockParameter = params.getCode.customBlockNumber;
        } else if (/^\d+$/.test(params.getCode.customBlockNumber)) {
          blockParameter = '0x' + Number(params.getCode.customBlockNumber).toString(16);
        } else {
          throw new Error('Invalid block number format. Use decimal or hex (0x) format');
        }
      }

      const requestPayload = {
        method: 'eth_getCode',
        params: [params.getCode.address, blockParameter]
      };

      console.log('Getting code with payload:', requestPayload);
      const response = await passportProvider.request(requestPayload);
      console.log('Code response:', response);

      // Check if it's a contract
      const isContract = response !== '0x';
      const bytecodeSize = (response.length - 2) / 2; // -2 for '0x' prefix, /2 for hex pairs

      let formattedResponse = isContract
        ? `Contract detected at ${getCodeParams.address}\nBytecode size: ${bytecodeSize} bytes\nBytecode: ${response}`
        : `No contract code found at ${getCodeParams.address} (this is a regular address)`;

      result = {
        method: 'eth_getCode',
        description: 'Returns code at a given address.',
        request: requestPayload,
        response: response,
        formatted: formattedResponse
      };
      displayOrder = ['eth_getCode'];
    } catch (error: any) {
      console.error('Error getting code:', error);
      result = {
        method: 'eth_getCode',
        description: 'Returns code at a given address.',
        error: error.message || 'Failed to get code'
      };
      displayOrder = ['eth_getCode'];
    }
  }

  async function executeSignTypedData() {
    console.log('Executing sign typed data');
    console.log('Sign typed data params:', signTypedDataParams);

    try {
      if (!isConnected) {
        throw new Error('Please connect your wallet first');
      }

      if (!passportProvider) {
        throw new Error('Provider not initialized');
      }

      // Update chainId based on current network
      signTypedDataParams.typedData.domain.chainId = NETWORK_CONFIG[currentNetwork].chainId;

      const requestPayload = {
        method: 'eth_signTypedData_v4',
        params: [userAddress, JSON.stringify(signTypedDataParams.typedData)]
      };

      console.log('Signing typed data with payload:', requestPayload);
      const signature = await passportProvider.request(requestPayload);
      console.log('Signature:', signature);

      result = {
        method: 'eth_signTypedData_v4',
        description: 'Signs typed structured data using the EIP-712 specification (v4).',
        request: {
          ...requestPayload,
          params: [
            requestPayload.params[0],
            requestPayload.params[1] ? JSON.parse(requestPayload.params[1]) : null
          ]
        },
        response: signature,
        formatted: `Signature: ${signature}\n\nSigned Message Details:
Domain:
- Name: ${signTypedDataParams.typedData.domain.name}
- Version: ${signTypedDataParams.typedData.domain.version}
- Chain ID: ${signTypedDataParams.typedData.domain.chainId}
- Verifying Contract: ${signTypedDataParams.typedData.domain.verifyingContract}

Message:
- From: ${signTypedDataParams.typedData.message.from.name} (${signTypedDataParams.typedData.message.from.wallet})
- To: ${signTypedDataParams.typedData.message.to.name} (${signTypedDataParams.typedData.message.to.wallet})
- Contents: ${signTypedDataParams.typedData.message.contents}`
      };
      displayOrder = ['eth_signTypedData_v4'];
    } catch (error: any) {
      console.error('Error signing typed data:', error);
      result = {
        method: 'eth_signTypedData_v4',
        description: 'Signs typed structured data using the EIP-712 specification (v4).',
        error: error.message || 'Failed to sign typed data'
      };
      displayOrder = ['eth_signTypedData_v4'];
    }
  }

  async function executePersonalSign() {
    console.log('Executing personal sign');
    console.log('Personal sign params:', personalSignParams);

    try {
      if (!isConnected) {
        throw new Error('Please connect your wallet first');
      }

      if (!passportProvider) {
        throw new Error('Provider not initialized');
      }

      if (!personalSignParams.fromAddress) {
        throw new Error('Address is required');
      }

      const requestPayload = {
        method: 'personal_sign',
        params: [personalSignParams.message, personalSignParams.fromAddress]
      };

      console.log('Signing message with payload:', requestPayload);
      const signature = await passportProvider.request(requestPayload);
      console.log('Signature:', signature);

      result = {
        method: 'personal_sign',
        description: 'Signs a message using the personal_sign method.',
        request: requestPayload,
        response: signature,
        formatted: `Signature: ${signature}\n\nSigned Message Details:\nFrom: ${personalSignParams.fromAddress}\nMessage: ${personalSignParams.message}`
      };
      displayOrder = ['personal_sign'];
    } catch (error: any) {
      console.error('Error signing message:', error);
      result = {
        method: 'personal_sign',
        description: 'Signs a message using the personal_sign method.',
        error: error.message || 'Failed to sign message'
      };
      displayOrder = ['personal_sign'];
    }
  }

  const BLOCK_PARAMETERS = [
    { value: 'latest', label: 'latest' },
    { value: 'earliest', label: 'earliest' },
    { value: 'pending', label: 'pending' },
    { value: 'safe', label: 'safe' },
    { value: 'finalized', label: 'finalized' },
    { value: 'number', label: 'Block Number' }
  ];
</script>

<div class="min-h-screen bg-gray-50">
  <div class="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
    <div class="flex gap-6">
      <!-- Sidebar -->
      <aside class="w-64 flex-none">
        <div class="bg-white rounded-lg shadow-sm p-6 sticky top-8">
          <!-- Network Selection (move to top) -->
          <div class="flex gap-2 mb-6">
            <button
              class="flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors {currentNetwork ===
              'testnet'
                ? 'bg-indigo-100 text-indigo-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
              on:click={() => switchNetwork('testnet')}
            >
              Testnet
            </button>
            <button
              class="flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors {currentNetwork ===
              'mainnet'
                ? 'bg-indigo-100 text-indigo-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
              on:click={() => switchNetwork('mainnet')}
            >
              Mainnet
            </button>
          </div>
          <div class="space-y-6">
            <!-- Connection Status -->
            {#if isConnected}
              <div class="bg-emerald-50 rounded-md p-4">
                <h3 class="text-sm font-medium text-emerald-800 mb-2">Connected</h3>
                {#if userAddress}
                  <p class="text-xs font-mono bg-white/50 p-2 rounded break-all text-emerald-600">
                    {userAddress}
                  </p>
                {/if}
                <button
                  class="mt-3 w-full bg-red-500 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-600 transition-colors"
                  on:click={handleLogout}
                >
                  Logout
                </button>
              </div>
            {:else}
              <button class="w-full flex items-center justify-center" on:click={handleLogin}>
                <img
                  src="/passport_btn_signin_light_small.svg"
                  alt="Sign in with Passport"
                  class="h-12"
                />
              </button>
            {/if}

            <!-- Actions -->
            <div class="space-y-2">
              <AccordionMenu
                title="Identity"
                items={identityMenuItems}
                on:stateChange={(e) => handleMenuStateChange(e.detail)}
              />
            </div>

            <!-- RPC Methods -->
            <div class="space-y-2">
              <AccordionMenu
                title="RPC Methods"
                items={rpcMenuItems}
                on:stateChange={(e) => handleMenuStateChange(e.detail)}
              />
            </div>

            <!-- Game Building -->
            <div class="space-y-2">
              <AccordionMenu
                title="Game Building"
                items={gameMenuItems}
                on:stateChange={(e) => handleMenuStateChange(e.detail)}
              />
            </div>
          </div>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="flex-1 space-y-6">
        <div class="bg-white rounded-lg shadow-sm p-6">
          <h2 class="text-2xl font-bold text-gray-900 mb-6">Passport Demo</h2>

          <!-- Display Results -->
          {#if displayOrder.length > 0}
            <div class="mt-6 space-y-4">
              {#each displayOrder as type}
                <div class="bg-gray-50 rounded-md p-4">
                  <!-- Method Title and Description -->
                  {#if !['idToken', 'accessToken', 'userInfo', 'linkedAddresses'].includes(type)}
                    <div class="border-b border-gray-200 pb-4 mb-4">
                      <h3 class="text-lg font-medium text-gray-900">
                        {type === 'createMintRequest' ? 'Mint tokens' : type}
                      </h3>
                      {#if result?.description}
                        <p class="mt-1 text-sm text-gray-600">{result.description}</p>
                      {/if}
                    </div>
                  {/if}

                  <!-- Input Forms -->
                  {#if type === 'eth_getBalance'}
                    <div class="space-y-4 mb-4">
                      <InputField
                        id="balance-address"
                        bind:value={balanceParams.address}
                        label="Address"
                        placeholder={userAddress || '0x...'}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        required={true}
                        description="The address to check balance for."
                      />

                      <div>
                        <label
                          class="block text-sm font-medium text-gray-700 mb-1"
                          for="balance-block"
                        >
                          Block Parameter
                        </label>
                        <select
                          id="balance-block"
                          bind:value={balanceParams.blockParam}
                          class="select-field"
                        >
                          {#each BLOCK_PARAMETERS as block}
                            <option value={block.value}>{block.label}</option>
                          {/each}
                        </select>
                      </div>

                      {#if balanceParams.blockParam === 'number'}
                        <InputField
                          id="balance-block-number"
                          bind:value={balanceParams.customBlockNumber}
                          label="Block Number"
                          placeholder="123 or 0x7b"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          required={true}
                          description="Enter decimal number or hexadecimal with 0x prefix."
                        />
                      {/if}

                      <button class="btn-primary" on:click={executeGetBalance}>
                        Get Balance
                      </button>
                    </div>
                  {/if}

                  {#if type === 'eth_sendTransaction' && formVisibility.transaction}
                    <div class="space-y-4 mb-4">
                      <InputField
                        id="transaction-to"
                        bind:value={params.transaction.to}
                        label="To Address"
                        placeholder="0x..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        required={true}
                        description="The address to send transaction to."
                      />

                      <InputField
                        id="transaction-value"
                        bind:value={params.transaction.value}
                        label="Value (in Wei)"
                        placeholder="1000000000000000"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        required={true}
                        description="Amount of wei to send."
                      />

                      <InputField
                        id="transaction-data"
                        bind:value={params.transaction.data}
                        label="Data"
                        placeholder="0x..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        description="Optional data to include in the transaction."
                      />

                      <InputField
                        id="transaction-gas-limit"
                        bind:value={params.transaction.gasLimit}
                        label="Gas Limit"
                        placeholder="21000"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        description="Optional gas limit (default: estimated automatically)."
                      />

                      <button class="btn-primary" on:click={sendTransaction}>
                        Send Transaction
                      </button>
                    </div>
                  {/if}

                  {#if type === 'eth_getStorageAt'}
                    <div class="space-y-4 mb-4">
                      <InputField
                        id="storage-address"
                        bind:value={params.storage.address}
                        label="Address"
                        placeholder={userAddress || '0x...'}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        required={true}
                        description="The address of the storage to read from."
                      />

                      <InputField
                        id="storage-slot"
                        bind:value={params.storage.slot}
                        label="Storage Slot"
                        placeholder="0x0"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        required={true}
                        description="The position in the storage to read from."
                      />

                      <InputField
                        id="storage-block-number"
                        bind:value={params.storage.customBlockNumber}
                        label="Block Number"
                        placeholder="123 or 0x7b"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        description="Enter decimal number or hexadecimal with 0x prefix."
                      />

                      <button class="btn-primary" on:click={executeStorageCall}>
                        Get Storage
                      </button>
                    </div>
                  {/if}

                  {#if type === 'eth_estimateGas'}
                    <div class="space-y-4 mb-4">
                      <InputField
                        id="estimate-gas-to"
                        bind:value={estimateGasParams.to}
                        label="To Address"
                        placeholder="0x..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        required={true}
                        description="The address to estimate gas for."
                      />

                      <InputField
                        id="estimate-gas-value"
                        bind:value={estimateGasParams.value}
                        label="Value (Wei)"
                        placeholder="0x0"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        description="Amount of wei to send (hex format)."
                      />

                      <InputField
                        id="estimate-gas-data"
                        bind:value={estimateGasParams.data}
                        label="Data"
                        placeholder="0x..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        description="The data for the transaction (hex format)."
                      />

                      <div>
                        <label
                          class="block text-sm font-medium text-gray-700 mb-1"
                          for="estimate-block"
                        >
                          Block Parameter
                        </label>
                        <select
                          id="estimate-block"
                          bind:value={estimateGasParams.blockParam}
                          class="select-field"
                        >
                          {#each BLOCK_PARAMETERS as block}
                            <option value={block.value}>{block.label}</option>
                          {/each}
                        </select>
                        <p class="mt-1 text-xs text-gray-500">The block to estimate gas at.</p>
                      </div>

                      {#if estimateGasParams.blockParam === 'number'}
                        <InputField
                          id="estimate-gas-block-number"
                          bind:value={estimateGasParams.customBlockNumber}
                          label="Block Number"
                          placeholder="123 or 0x7b"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          description="Enter decimal number or hexadecimal with 0x prefix."
                        />
                      {/if}

                      <button class="btn-primary" on:click={executeEstimateGas}>
                        Estimate Gas
                      </button>
                    </div>
                  {/if}

                  {#if type === 'eth_call'}
                    <div class="space-y-4 mb-4">
                      <InputField
                        id="call-to"
                        bind:value={callParams.to}
                        label="To Address"
                        placeholder="0x..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        required={true}
                        description="The address of the contract to call."
                      />

                      <InputField
                        id="call-data"
                        bind:value={callParams.data}
                        label="Data"
                        placeholder="0x..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        description="The encoded function call data (hex format)."
                      />

                      <InputField
                        id="call-value"
                        bind:value={callParams.value}
                        label="Value"
                        placeholder="0x0"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        description="The value in wei to send with the call (hex format)."
                      />

                      <div>
                        <label
                          class="block text-sm font-medium text-gray-700 mb-1"
                          for="call-block"
                        >
                          Block Parameter
                        </label>
                        <select
                          id="call-block"
                          bind:value={callParams.blockNumber}
                          class="select-field"
                        >
                          {#each BLOCK_PARAMETERS as block}
                            <option value={block.value}>{block.label}</option>
                          {/each}
                        </select>
                        <p class="mt-1 text-xs text-gray-500">
                          The block to execute the call against.
                        </p>
                      </div>

                      <button class="btn-primary" on:click={executeCall}> Execute Call </button>
                    </div>
                  {/if}

                  {#if type === 'eth_getBlockByHash'}
                    <div class="space-y-4 mb-4">
                      <InputField
                        id="block-hash"
                        bind:value={blockByHashParams.blockHash}
                        label="Block Hash"
                        placeholder="0x..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        required={true}
                        description="The hash of the block to retrieve."
                      />

                      <div class="flex items-center">
                        <input
                          type="checkbox"
                          id="include-transactions"
                          bind:checked={blockByHashParams.includeTransactions}
                          class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        />
                        <label class="ml-2 block text-sm text-gray-900" for="include-transactions">
                          Include Full Transactions
                        </label>
                      </div>

                      <button class="btn-primary" on:click={executeGetBlockByHash}>
                        Get Block
                      </button>
                    </div>
                  {/if}

                  {#if type === 'eth_getBlockByNumber'}
                    <div class="space-y-4 mb-4">
                      <div>
                        <label
                          class="block text-sm font-medium text-gray-700 mb-1"
                          for="block-number-param"
                        >
                          Block Parameter
                        </label>
                        <select
                          id="block-number-param"
                          bind:value={blockByNumberParams.blockNumber}
                          class="select-field"
                        >
                          {#each BLOCK_PARAMETERS as block}
                            <option value={block.value}>{block.label}</option>
                          {/each}
                        </select>
                      </div>

                      {#if blockByNumberParams.blockNumber === 'number'}
                        <InputField
                          id="custom-block-number"
                          bind:value={blockByNumberParams.customBlockNumber}
                          label="Block Number"
                          placeholder="123 or 0x7b"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          required={true}
                          description="Enter decimal number or hexadecimal with 0x prefix."
                        />
                      {/if}

                      <div class="flex items-center">
                        <input
                          type="checkbox"
                          id="include-transactions-by-number"
                          bind:checked={blockByNumberParams.includeTransactions}
                          class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        />
                        <label
                          class="ml-2 block text-sm text-gray-900"
                          for="include-transactions-by-number"
                        >
                          Include Full Transactions
                        </label>
                      </div>

                      <button class="btn-primary" on:click={executeGetBlockByNumber}>
                        Get Block
                      </button>
                    </div>
                  {/if}

                  {#if type === 'eth_getTransactionByHash'}
                    <div class="space-y-4 mb-4">
                      <InputField
                        id="transaction-hash"
                        bind:value={transactionByHashParams.hash}
                        label="Transaction Hash"
                        placeholder="0x..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        required={true}
                        description="The hash of the transaction to retrieve."
                      />

                      <button class="btn-primary" on:click={executeGetTransactionByHash}>
                        Get Transaction
                      </button>
                    </div>
                  {/if}

                  {#if type === 'eth_getTransactionReceipt'}
                    <div class="space-y-4 mb-4">
                      <InputField
                        id="transaction-receipt-hash"
                        bind:value={transactionReceiptParams.hash}
                        label="Transaction Hash"
                        placeholder="0x..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        required={true}
                        description="The hash of the transaction to get the receipt for."
                      />

                      <button class="btn-primary" on:click={executeGetTransactionReceipt}>
                        Get Receipt
                      </button>
                    </div>
                  {/if}

                  {#if type === 'eth_getTransactionCount'}
                    <div class="space-y-4 mb-4">
                      <InputField
                        id="transaction-count-address"
                        bind:value={transactionCountParams.address}
                        label="Address"
                        placeholder={userAddress || '0x...'}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        required={true}
                        description="The address to get the transaction count for."
                      />

                      <div>
                        <label
                          class="block text-sm font-medium text-gray-700 mb-1"
                          for="transaction-count-block"
                        >
                          Block Parameter
                        </label>
                        <select
                          id="transaction-count-block"
                          bind:value={transactionCountParams.blockNumber}
                          class="select-field"
                        >
                          {#each BLOCK_PARAMETERS as block}
                            <option value={block.value}>{block.label}</option>
                          {/each}
                        </select>
                      </div>

                      {#if transactionCountParams.blockNumber === 'number'}
                        <InputField
                          id="transaction-count-block-number"
                          bind:value={transactionCountParams.customBlockNumber}
                          label="Block Number"
                          placeholder="123 or 0x7b"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          required={true}
                          description="Enter decimal number or hexadecimal with 0x prefix."
                        />
                      {/if}

                      <button class="btn-primary" on:click={executeGetTransactionCount}>
                        Get Transaction Count
                      </button>
                    </div>
                  {/if}

                  {#if type === 'eth_getCode'}
                    <div class="space-y-4 mb-4">
                      <InputField
                        id="get-code-address"
                        bind:value={getCodeParams.address}
                        label="Contract Address"
                        placeholder="0x..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        required={true}
                        description="The address of the smart contract to get the code from."
                      />

                      <div>
                        <label
                          class="block text-sm font-medium text-gray-700 mb-1"
                          for="get-code-block"
                        >
                          Block Parameter
                        </label>
                        <select
                          id="get-code-block"
                          bind:value={getCodeParams.blockNumber}
                          class="select-field"
                        >
                          {#each BLOCK_PARAMETERS as block}
                            <option value={block.value}>{block.label}</option>
                          {/each}
                        </select>
                        <p class="mt-1 text-xs text-gray-500">
                          The block number to get the code from.
                        </p>
                      </div>

                      {#if getCodeParams.blockNumber === 'number'}
                        <InputField
                          id="get-code-block-number"
                          bind:value={getCodeParams.customBlockNumber}
                          label="Block Number"
                          placeholder="123 or 0x7b"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          required={true}
                          description="Enter decimal number or hexadecimal with 0x prefix."
                        />
                      {/if}

                      <button class="btn-primary" on:click={executeGetCode}>
                        Get Contract Code
                      </button>
                    </div>
                  {/if}

                  {#if type === 'eth_signTypedData_v4' && formVisibility.signTypedData}
                    <SignTypedDataForm
                      typedData={params.signTypedData.typedData}
                      onSign={executeSignTypedData}
                    />
                  {/if}

                  {#if type === 'personal_sign' && formVisibility.personalSign}
                    <div class="space-y-4 mb-4">
                      <InputField
                        id="personal-sign-address"
                        bind:value={personalSignParams.fromAddress}
                        label="Address"
                        placeholder={userAddress || '0x...'}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        required={true}
                        description="The Ethereum address that will sign the message."
                      />

                      <InputField
                        id="personal-sign-message"
                        bind:value={personalSignParams.message}
                        label="Message"
                        placeholder="Enter message to sign"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
                        textarea={true}
                        rows={4}
                        required={true}
                        description="The message to sign. This message will be prefixed with '\x19Ethereum Signed Message:\n' + message.length."
                      />

                      <button class="btn-primary" on:click={executePersonalSign}>
                        Sign Message
                      </button>
                    </div>
                  {/if}

                  {#if type === 'createMintRequest' && formVisibility.mintRequest}
                    <div class="space-y-6 mb-4">
                      <!-- Contract Type -->
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">
                          Contract Type
                        </label>
                        <select bind:value={params.mintRequest.contractType} class="select-field">
                          <option value="ERC721">ERC-721</option>
                          <option value="ERC1155">ERC-1155</option>
                        </select>
                      </div>

                      <InputField
                        id="mint-contract-address"
                        bind:value={params.mintRequest.contractAddress}
                        label="Contract Address"
                        placeholder="0x..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        required={true}
                        description="The deployed contract address for your collection."
                      />

                      <!-- Mint Type Selection for ERC721 -->
                      {#if params.mintRequest.contractType === 'ERC721'}
                        <div>
                          <label class="block text-sm font-medium text-gray-700 mb-1">
                            Mint Type
                          </label>
                          <select bind:value={params.mintRequest.mintType} class="select-field">
                            <option value="mintBatch">mintBatch (specify token ID)</option>
                            <option value="mintBatchByQuantity"
                              >mintBatchByQuantity (auto-generated token ID)</option
                            >
                          </select>
                          <p class="mt-1 text-xs text-gray-500">
                            {#if params.mintRequest.mintType === 'mintBatch'}
                              You specify the token ID. Less gas efficient but allows custom token
                              IDs.
                            {:else}
                              System generates token ID sequentially. More gas efficient.
                            {/if}
                          </p>
                        </div>
                      {/if}

                      <!-- Quantity Field for mintBatchByQuantity -->
                      {#if params.mintRequest.contractType === 'ERC721' && params.mintRequest.mintType === 'mintBatchByQuantity'}
                        <InputField
                          id="mint-quantity"
                          bind:value={params.mintRequest.quantity}
                          label="Quantity"
                          placeholder="1"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          required={true}
                          description="Number of NFTs to mint in the batch with auto-generated token IDs."
                        />
                      {/if}

                      <!-- Basic Required Fields -->
                      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InputField
                          id="mint-owner-address"
                          bind:value={params.mintRequest.ownerAddress}
                          label="Owner Address"
                          placeholder={userAddress || '0x...'}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          required={true}
                          description="Wallet address that will own the minted asset."
                        />

                        <InputField
                          id="mint-reference-id"
                          bind:value={params.mintRequest.referenceId}
                          label="Reference ID"
                          placeholder="unique-ref-123"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          required={true}
                          description="Unique identifier for tracking this mint request."
                        />
                      </div>

                      <!-- Token ID and Amount Fields -->
                      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {#if (params.mintRequest.contractType === 'ERC721' && params.mintRequest.mintType === 'mintBatch') || params.mintRequest.contractType === 'ERC1155'}
                          <InputField
                            id="mint-token-id"
                            bind:value={params.mintRequest.tokenId}
                            label="Token ID"
                            placeholder="1"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                            required={true}
                            description="Unique identifier for the token within the collection."
                          />
                        {/if}

                        {#if params.mintRequest.contractType === 'ERC1155'}
                          <InputField
                            id="mint-amount"
                            bind:value={params.mintRequest.amount}
                            label="Amount"
                            placeholder="1"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                            required={true}
                            description="Number of tokens to mint for this token ID."
                          />
                        {/if}
                      </div>

                      <!-- Metadata Section -->
                      <div class="border-t pt-6">
                        <div class="flex items-center mb-4">
                          <input
                            type="checkbox"
                            id="include-metadata"
                            bind:checked={params.mintRequest.includeMetadata}
                            class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                          />
                          <label
                            class="ml-2 block text-sm font-medium text-gray-900"
                            for="include-metadata"
                          >
                            Include Metadata in Request
                          </label>
                        </div>
                        <p class="text-xs text-gray-500 mb-4">
                          Including metadata in the request optimizes performance but you must still
                          store metadata files at baseURI/token_id.
                        </p>

                        {#if params.mintRequest.includeMetadata}
                          <div class="space-y-4 pl-6 border-l-2 border-gray-200">
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <InputField
                                id="metadata-name"
                                bind:value={params.mintRequest.metadata.name}
                                label="Name"
                                placeholder="My Awesome NFT"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                description="The name of the NFT."
                              />

                              <InputField
                                id="metadata-image"
                                bind:value={params.mintRequest.metadata.image}
                                label="Image URL"
                                placeholder="https://example.com/image.png"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                description="URL to the image asset."
                              />
                            </div>

                            <InputField
                              id="metadata-description"
                              bind:value={params.mintRequest.metadata.description}
                              label="Description"
                              placeholder="A detailed description of the NFT..."
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                              textarea={true}
                              rows={3}
                              description="Description of the NFT."
                            />

                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <InputField
                                id="metadata-external-url"
                                bind:value={params.mintRequest.metadata.externalUrl}
                                label="External URL"
                                placeholder="https://example.com"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                description="Link to external website."
                              />

                              <InputField
                                id="metadata-animation-url"
                                bind:value={params.mintRequest.metadata.animationUrl}
                                label="Animation URL"
                                placeholder="https://example.com/animation.mp4"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                description="URL to animation/video file."
                              />

                              <InputField
                                id="metadata-youtube-url"
                                bind:value={params.mintRequest.metadata.youtubeUrl}
                                label="YouTube URL"
                                placeholder="https://youtube.com/watch?v=..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                description="YouTube video URL."
                              />
                            </div>

                            <!-- Attributes -->
                            <div>
                              <div class="flex items-center justify-between mb-3">
                                <label class="block text-sm font-medium text-gray-700">
                                  Attributes
                                </label>
                                <button
                                  type="button"
                                  on:click={addAttribute}
                                  class="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                                >
                                  + Add Attribute
                                </button>
                              </div>

                              {#if params.mintRequest.metadata.attributes.length > 0}
                                <div class="space-y-2">
                                  {#each params.mintRequest.metadata.attributes as attribute, index}
                                    <div class="grid grid-cols-5 gap-2 items-end">
                                      <div class="col-span-2">
                                        <InputField
                                          id="attribute-trait-{index}"
                                          bind:value={attribute.trait_type}
                                          label="Trait Type"
                                          placeholder="Color"
                                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                          description=""
                                        />
                                      </div>
                                      <div class="col-span-2">
                                        <InputField
                                          id="attribute-value-{index}"
                                          bind:value={attribute.value}
                                          label="Value"
                                          placeholder="Blue"
                                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                          description=""
                                        />
                                      </div>
                                      <div>
                                        <button
                                          type="button"
                                          on:click={() => removeAttribute(index)}
                                          class="w-full px-3 py-2 text-red-600 hover:text-red-900 text-sm"
                                        >
                                          Remove
                                        </button>
                                      </div>
                                    </div>
                                  {/each}
                                </div>
                              {:else}
                                <p class="text-sm text-gray-500 italic">No attributes added yet.</p>
                              {/if}
                            </div>
                          </div>
                        {/if}
                      </div>

                      <div class="flex flex-col space-y-2">
                        <button class="btn-primary" on:click={executeMintRequest}>
                          Create Mint Request
                        </button>
                      </div>
                    </div>
                  {/if}

                  {#if type === 'transferAssets'}
                    <TransferAssets
                      userAddress={userAddress}
                      currentNetwork={currentNetwork}
                      signer={signer}
                      provider={passportProvider}
                      isConnected={isConnected}
                    />
                  {/if}
                  {#if type === 'transactionDataEncoding'}
                    <div class="space-y-4 mb-4">
                      <div>
                        <h4 class="text-sm font-medium text-gray-900 mb-2">
                          Transaction Data Encoding
                        </h4>
                        <p class="text-xs text-gray-600 mb-4">
                          Encode and decode transaction data for smart contract interactions.
                        </p>
                      </div>

                      <div class="space-y-4">
                        <!-- Keccak-256 Section -->
                        <div class="bg-gray-50 p-4 rounded-md">
                          <h4 class="text-sm font-medium text-gray-900 mb-2">
                            🔐 Keccak-256 Hash Calculator
                          </h4>
                          <div class="space-y-3">
                            <div>
                              <label class="block text-sm font-medium text-gray-700 mb-1">
                                Input Type
                              </label>
                              <select
                                bind:value={keccakInputType}
                                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                              >
                                <option value="utf8">UTF-8</option>
                                <option value="hex">Hex</option>
                              </select>
                            </div>

                            <div>
                              <label class="block text-sm font-medium text-gray-700 mb-1">
                                Input Text
                              </label>
                              <textarea
                                bind:value={keccakInput}
                                rows="2"
                                placeholder="e.g., transfer(address,uint256) or craftSkin()"
                                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                              ></textarea>
                              <p class="text-xs text-gray-500 mt-1">
                                Enter function signature or any text to hash
                              </p>
                            </div>

                            <button
                              on:click={calculateKeccak256}
                              class="w-full bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                            >
                              Calculate Hash
                            </button>

                            {#if keccakResult}
                              <div class="mt-4">
                                <label class="block text-sm font-medium text-gray-700 mb-1">
                                  Keccak-256 Hash
                                </label>
                                <div class="bg-gray-50 rounded-md p-3">
                                  <code class="text-sm font-mono break-all">{keccakResult}</code>
                                </div>
                                {#if functionSelector}
                                  <div class="mt-2">
                                    <label class="block text-sm font-medium text-gray-700 mb-1">
                                      Function Selector (First 4 bytes)
                                    </label>
                                    <div class="bg-blue-50 rounded-md p-3">
                                      <code class="text-sm font-mono text-blue-800"
                                        >{functionSelector}</code
                                      >
                                    </div>
                                  </div>
                                {/if}
                              </div>
                            {/if}

                            <!-- Keccak-256 Usage Example -->
                            <div class="mt-3 pt-3 border-t border-gray-200">
                              <h5 class="text-xs font-medium text-gray-700 mb-1">💡 Example</h5>
                              <div class="bg-gray-100 rounded p-2 text-xs">
                                <p class="text-gray-700 mb-1">
                                  <strong>Input:</strong> setApprovalForAll(address,bool)
                                </p>
                                <p class="text-gray-700 mb-1">
                                  <strong>Hash:</strong> 0xa22cb4651ab9570f89bb516380c40ce76762284fb1f21337ceaf6adab99e7d4a
                                </p>
                                <p class="text-gray-700">
                                  <strong>Selector:</strong> 0xa22cb465
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <!-- Encode Section -->
                        <div class="bg-gray-50 p-4 rounded-md">
                          <h4 class="text-sm font-medium text-gray-900 mb-2">
                            📝 Function Call Encoder
                          </h4>
                          <div class="space-y-3">
                            <div>
                              <label class="block text-sm font-medium text-gray-700 mb-1">
                                Function Signature
                              </label>
                              <input
                                type="text"
                                bind:value={encodeFunctionSignature}
                                placeholder="e.g., transfer(address,uint256)"
                                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                              />
                              <p class="text-xs text-gray-500 mt-1">
                                Enter the function signature without 'function' keyword
                              </p>
                            </div>

                            <div>
                              <label class="block text-sm font-medium text-gray-700 mb-1">
                                Parameters (JSON)
                              </label>
                              <textarea
                                bind:value={encodeParameters}
                                rows="3"
                                placeholder={encodeParamsPlaceholder}
                                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                              ></textarea>
                              <p class="text-xs text-gray-500 mt-1">
                                Enter parameters as a JSON array (leave empty for no parameters)
                              </p>
                            </div>

                            <button
                              on:click={encodeFunction}
                              class="w-full bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                            >
                              Encode Function Data
                            </button>

                            {#if encodeResult}
                              <div class="mt-4">
                                <label class="block text-sm font-medium text-gray-700 mb-1">
                                  Encoded Data
                                </label>
                                <div class="bg-gray-50 rounded-md p-3">
                                  <code class="text-sm font-mono break-all">{encodeResult}</code>
                                </div>
                              </div>
                            {/if}

                            <!-- Encoding Usage Example -->
                            <div class="mt-3 pt-3 border-t border-gray-200">
                              <h5 class="text-xs font-medium text-gray-700 mb-1">💡 Example</h5>
                              <div class="bg-gray-100 rounded p-2 text-xs">
                                <p class="text-gray-700 mb-1">
                                  <strong>Function:</strong> transfer(address,uint256)
                                </p>
                                <p class="text-gray-700 mb-1">
                                  <strong>Parameters:</strong> ["0x742d35Cc6635C0532925a3b8D4C9db96C3a8b4B",
                                  "1000000000000000000"]
                                </p>
                                <p class="text-gray-700">
                                  <strong>Result:</strong> 0xa9059cbb000000000000000000000000742d35cc...
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <!-- Decode Section -->
                        <div class="bg-gray-50 p-4 rounded-md">
                          <h4 class="text-sm font-medium text-gray-900 mb-2">
                            🔍 Transaction Data Decoder
                          </h4>
                          <div class="space-y-3">
                            <div>
                              <label class="block text-sm font-medium text-gray-700 mb-1">
                                Transaction Data (Hex)
                              </label>
                              <textarea
                                bind:value={decodeTransactionData}
                                rows="3"
                                placeholder="0xa9059cbb000000000000000000000000742d35cc6635c0532925a3b8d4c9db96c3a8b4b0000000000000000000000000000000000000000000000000de0b6b3a7640000"
                                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
                              ></textarea>
                              <p class="text-xs text-gray-500 mt-1">
                                Enter the transaction data to decode
                              </p>
                            </div>

                            <div>
                              <label class="block text-sm font-medium text-gray-700 mb-1">
                                ABI (Optional)
                              </label>
                              <textarea
                                bind:value={decodeABI}
                                rows="2"
                                placeholder={abiPlaceholder}
                                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
                              ></textarea>
                              <p class="text-xs text-gray-500 mt-1">
                                Provide ABI for detailed parameter decoding (optional)
                              </p>
                            </div>

                            <button
                              on:click={decodeTransaction}
                              class="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                            >
                              Decode Transaction Data
                            </button>

                            {#if decodeResult}
                              <div class="mt-4">
                                <label class="block text-sm font-medium text-gray-700 mb-1">
                                  Decoded Result
                                </label>
                                <div class="bg-gray-50 rounded-md p-3">
                                  <pre
                                    class="text-sm font-mono whitespace-pre-wrap break-all">{decodeResult}</pre>
                                </div>
                              </div>
                            {/if}

                            <!-- Decoding Usage Example -->
                            <div class="mt-3 pt-3 border-t border-gray-200">
                              <h5 class="text-xs font-medium text-gray-700 mb-1">💡 Example</h5>
                              <div class="bg-gray-100 rounded p-2 text-xs">
                                <p class="text-gray-700 mb-1">
                                  <strong>Input Data:</strong> 0xa9059cbb000000000000000000000000742d35cc...
                                </p>
                                <p class="text-gray-700 mb-1">
                                  <strong>Function:</strong> transfer(address,uint256)
                                </p>
                                <p class="text-gray-700 mb-1">
                                  <strong>Parameters:</strong> to=0x742d35Cc..., amount=1000000000000000000
                                </p>
                                <p class="text-gray-700">
                                  <strong>Selector:</strong> 0xa9059cbb
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  {/if}

                  {#if type === 'idToken' && tokenState.idToken}
                    <div class="space-y-4 mb-4">
                      <div>
                        <h4 class="text-sm font-medium text-gray-900 mb-2">ID Token</h4>
                        <pre
                          class="text-xs font-mono bg-gray-50 p-4 rounded-md overflow-x-auto whitespace-pre-wrap break-all">{tokenState.idToken}</pre>
                      </div>
                      {#if tokenState.decodedIdToken}
                        <div>
                          <h4 class="text-sm font-medium text-gray-900 mb-2">Decoded ID Token</h4>
                          <pre
                            class="text-xs font-mono bg-gray-50 p-4 rounded-md overflow-x-auto whitespace-pre-wrap break-all">{JSON.stringify(
                              tokenState.decodedIdToken,
                              null,
                              2
                            )}</pre>
                        </div>
                      {/if}
                      <p class="text-sm text-gray-500 mt-4 p-4 bg-blue-50 rounded-md">
                        Note: The <code class="text-blue-600">sub</code> attribute will uniquely identify
                        the Passport user. If your decoded token does not look like the above, double
                        check that you have decoded the ID token and not the Access token.
                      </p>
                    </div>
                  {/if}

                  {#if type === 'accessToken' && tokenState.accessToken}
                    <div class="space-y-4 mb-4">
                      <div>
                        <h4 class="text-sm font-medium text-gray-900 mb-2">Access Token</h4>
                        <pre
                          class="text-xs font-mono bg-gray-50 p-4 rounded-md overflow-x-auto whitespace-pre-wrap break-all">{tokenState.accessToken}</pre>
                      </div>
                      {#if tokenState.decodedAccessToken}
                        <div>
                          <h4 class="text-sm font-medium text-gray-900 mb-2">
                            Decoded Access Token
                          </h4>
                          <pre
                            class="text-xs font-mono bg-gray-50 p-4 rounded-md overflow-x-auto whitespace-pre-wrap break-all">{JSON.stringify(
                              tokenState.decodedAccessToken,
                              null,
                              2
                            )}</pre>
                        </div>
                      {/if}
                      <p class="text-sm text-gray-500 mt-4 p-4 bg-blue-50 rounded-md">
                        Note: The <code class="text-blue-600">sub</code> attribute will uniquely identify
                        the Passport user. If your decoded token does not look like the above, double
                        check that you have decoded the ID token and not the Access token.
                      </p>
                    </div>
                  {/if}

                  {#if type === 'userInfo' && userInfo}
                    <div class="space-y-4 mb-4">
                      <div>
                        <h4 class="text-sm font-medium text-gray-900 mb-2">User Info</h4>
                        <pre
                          class="text-xs font-mono bg-gray-50 p-4 rounded-md overflow-x-auto whitespace-pre-wrap break-all">{JSON.stringify(
                            userInfo,
                            null,
                            2
                          )}</pre>
                      </div>
                      <p class="text-sm text-gray-500 mt-4 p-4 bg-yellow-50 rounded-md">
                        <span class="font-medium text-yellow-800"
                          >Apple Social Login Email Masking:</span
                        > If a user logs in through Apple and chooses to mask their email address, the
                        email will appear as xyz@privaterelay.appleid.com. This masked email prevents
                        direct communication with users. Please consider this limitation when implementing
                        Apple Social Login.
                      </p>
                    </div>
                  {/if}

                  {#if type === 'linkedAddresses' && linkedAddresses}
                    <div class="space-y-4 mb-4">
                      <div>
                        <h4 class="text-sm font-medium text-gray-900 mb-2">Linked Addresses</h4>
                        <pre
                          class="text-xs font-mono bg-gray-50 p-4 rounded-md overflow-x-auto whitespace-pre-wrap break-all">{JSON.stringify(
                            linkedAddresses,
                            null,
                            2
                          )}</pre>
                        <AddressList
                          addresses={linkedAddresses}
                          explorerBase={NETWORK_CONFIG[currentNetwork].explorerUrl}
                        />
                      </div>
                    </div>
                  {/if}

                  <!-- Result or Error -->
                  {#if result}
                    <ResultPanel result={result} />
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </main>
    </div>
  </div>
</div>

<style lang="postcss">
  @reference "tailwindcss";

  :global(.btn-primary) {
    @apply w-full bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors;
  }

  :global(.select-field) {
    @apply w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white;
  }

  :global(.form-label) {
    @apply block text-sm font-medium text-gray-700 mb-1;
  }

  :global(.form-container) {
    @apply space-y-4 mb-4;
  }
</style>
