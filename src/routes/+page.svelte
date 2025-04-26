<script lang="ts">
  import { passport, config } from '@imtbl/sdk';
  import { onMount } from 'svelte';
  import { jwtDecode } from 'jwt-decode';
  import { BrowserProvider, Contract, ethers } from 'ethers';
  import type { Eip1193Provider } from 'ethers';

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

  // Constants
  const DEFAULT_TRANSACTION = {
    to: '0xacbe301e5b46f4dd532b74e209adac0c06d42f8c',
    value: '1000000000000000'
  };

  const ERROR_MESSAGES = {
    NOT_LOGGED_IN: 'User must be logged in to perform this action',
    UNAUTHORIZED: 'Unauthorized - Please connect your wallet first',
    INVALID_PARAMS: 'Invalid parameters - "to" field is required',
    TRANSACTION_FAILED: 'Transaction failed'
  };

  // State
  let passportInstance: passport.Passport;
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

  let transactionParams = {
    to: '',
    value: '',
    data: '',
    gasLimit: '',
    maxFeePerGas: '',
    maxPriorityFeePerGas: ''
  };

  let storageParams = {
    address: '',
    slot: '0x0',
    blockParam: 'latest',
    customBlockNumber: ''
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

  let signTypedDataParams = {
    typedData: {
      domain: {
        name: 'Ether Mail',
        version: '1',
        chainId: 13473,  // Immutable zkEVM testnet chainId
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
    fromAddress: ''  // Add signer address field
  };

  let balanceParams = {
    address: '',
    blockParam: 'latest',
    customBlockNumber: ''
  };

  let transactionReceiptParams = {
    hash: ''
  };

  // 네트워크 설정
  const NETWORK_CONFIG = {
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

  // chainId 업데이트 함수
  function updateChainId() {
    if (signTypedDataParams?.typedData?.domain) {
      signTypedDataParams.typedData.domain.chainId = NETWORK_CONFIG[currentNetwork].chainId;
    }
  }

  // Network switching function
  async function switchNetwork(network: 'testnet' | 'mainnet') {
    try {
      currentNetwork = network;
      updateChainId();
      
      // Update environment variables
      const environment = network === 'mainnet' ? 
        config.Environment.PRODUCTION : 
        config.Environment.SANDBOX;

      // Reinitialize Passport instance
      passportInstance = new passport.Passport({
        baseConfig: {
          environment,
          publishableKey: import.meta.env.VITE_IMMUTABLE_PUBLISHABLE_KEY,
        },
        clientId: import.meta.env.VITE_IMMUTABLE_CLIENT_ID,
        redirectUri: import.meta.env.VITE_IMMUTABLE_REDIRECT_URI,
        logoutRedirectUri: import.meta.env.VITE_IMMUTABLE_LOGOUT_URI,
        audience: 'platform_api',
        scope: 'openid offline_access email transact',
      });

      // Reset connection
      if (isConnected) {
        await initializeProviders();
      }

      // Display result message
      result = {
        message: `Switched to ${NETWORK_CONFIG[network].name}`,
        chainId: NETWORK_CONFIG[network].chainId
      };
      addToDisplayOrder('network');
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

  onMount(() => {
    // Check if environment variables are set
    if (!import.meta.env.VITE_IMMUTABLE_CLIENT_ID || 
        !import.meta.env.VITE_IMMUTABLE_PUBLISHABLE_KEY ||
        !import.meta.env.VITE_IMMUTABLE_ENVIRONMENT ||
        !import.meta.env.VITE_IMMUTABLE_REDIRECT_URI ||
        !import.meta.env.VITE_IMMUTABLE_LOGOUT_URI) {
      console.error('Environment variables are not set. Please check .env file.');
      return;
    }

    const environment = import.meta.env.VITE_IMMUTABLE_ENVIRONMENT === 'PRODUCTION' 
      ? config.Environment.PRODUCTION 
      : config.Environment.SANDBOX;

    passportInstance = new passport.Passport({
      baseConfig: {
        environment,
        publishableKey: import.meta.env.VITE_IMMUTABLE_PUBLISHABLE_KEY,
      },
      clientId: import.meta.env.VITE_IMMUTABLE_CLIENT_ID,
      redirectUri: import.meta.env.VITE_IMMUTABLE_REDIRECT_URI,
      logoutRedirectUri: import.meta.env.VITE_IMMUTABLE_LOGOUT_URI,
      audience: 'platform_api',
      scope: 'openid offline_access email transact',
    });

    initializeProviders();
  });

  async function initializeProviders() {
    try {
      passportProvider = await passportInstance.connectEvm();
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
          checkBalance();
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
      if (!browserProvider) return;
      
      const accounts = await browserProvider.send('eth_requestAccounts', []);
      if (accounts && accounts.length > 0) {
        isConnected = true;
        userAddress = accounts[0];
        signer = await browserProvider.getSigner();
        await checkBalance();
      }
    } catch (error: unknown) {
      console.error('Login failed:', error);
      isConnected = false;
      userAddress = null;
      balance = null;
      signer = null;
    }
  }

  function addToDisplayOrder(type: string) {
    // Reset form visibility flags except for the current form
    showTransactionForm = type === 'sendTransaction';
    showBlockByHashForm = type === 'blockByHash';
    showTransactionByHashForm = type === 'transactionByHash';
    showSignTypedDataForm = type === 'signTypedData';
    showPersonalSignForm = type === 'personalSign';
    
    // Add new type to displayOrder if it doesn't exist
    if (!displayOrder.includes(type)) {
      displayOrder = [...displayOrder, type];
    }
  }

  async function handleGetIdToken() {
    try {
      const token = await passportInstance.getIdToken();
      if (token) {
        tokenState.idToken = token;
        tokenState.decodedIdToken = jwtDecode(token);
        addToDisplayOrder('idToken');
      }
    } catch (error: unknown) {
      console.error('Failed to get ID token:', error);
      tokenState.idToken = null;
      tokenState.decodedIdToken = null;
    }
  }

  async function handleGetAccessToken() {
    try {
      const token = await passportInstance.getAccessToken();
      if (token) {
        tokenState.accessToken = token;
        tokenState.decodedAccessToken = jwtDecode(token);
        addToDisplayOrder('accessToken');
      }
    } catch (error: unknown) {
      console.error('Failed to get access token:', error);
      tokenState.accessToken = null;
      tokenState.decodedAccessToken = null;
    }
  }

  async function handleGetUserInfo() {
    try {
      const info = await passportInstance.getUserInfo();
      if (info) {
        userInfo = info;
        addToDisplayOrder('userInfo');
      }
    } catch (error: unknown) {
      console.error('Failed to get user info:', error);
      if ((error as Error).message === 'NOT_LOGGED_IN_ERROR') {
        console.error('User must be logged in to get user info');
      }
      userInfo = null;
    }
  }

  async function handleGetLinkedAddresses() {
    try {
      const addresses = await passportInstance.getLinkedAddresses();
      linkedAddresses = addresses;
      addToDisplayOrder('linkedAddresses');
    } catch (error: unknown) {
      console.error('Failed to get linked addresses:', error);
      if ((error as Error).message === 'NOT_LOGGED_IN_ERROR') {
        console.error('User must be logged in to get linked addresses');
      }
      linkedAddresses = null;
    }
  }

  async function handleLogout() {
    try {
      await passportInstance.logout();
      
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
      // 16진수 또는 10진수 입력 처리
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
    console.log('Executing storage lookup');
    console.log('Storage params:', storageParams);

    try {
      if (!storageParams.address) {
        throw new Error('Address is required');
      }

      if (!storageParams.slot) {
        throw new Error('Storage slot is required');
      }

      if (!passportProvider) {
        throw new Error('Provider not initialized');
      }

      const blockParam = getBlockParameter(storageParams.blockParam, storageParams.customBlockNumber);
      const requestPayload = {
        method: 'eth_getStorageAt',
        params: [
          storageParams.address,
          storageParams.slot,
          blockParam
        ]
      };

      console.log('Getting storage with payload:', requestPayload);
      const storageValue = await passportProvider.request(requestPayload);
      console.log('Storage response:', storageValue);

      result = {
        method: 'eth_getStorageAt',
        description: "Returns the value from a storage position at a given address.",
        request: requestPayload,
        response: storageValue,
        formatted: `Storage Value at slot ${storageParams.slot}: ${storageValue}`
      };
      displayOrder = ['eth_getStorageAt'];
    } catch (error: any) {
      console.error('Error getting storage:', error);
      result = {
        method: 'eth_getStorageAt',
        description: "Returns the value from a storage position at a given address.",
        error: error.message || 'Failed to get storage'
      };
      displayOrder = ['eth_getStorageAt'];
    }
  }

  async function executeEstimateGas() {
    console.log('Executing gas estimation');
    console.log('Estimate gas params:', estimateGasParams);

    try {
      if (!estimateGasParams.to) {
        throw new Error('To address is required');
      }

      if (!passportProvider) {
        throw new Error('Provider not initialized');
      }

      const blockParam = getBlockParameter(estimateGasParams.blockParam, estimateGasParams.customBlockNumber);
      const requestPayload = {
        method: 'eth_estimateGas',
        params: [{
          to: estimateGasParams.to,
          from: userAddress || undefined,
          value: estimateGasParams.value || '0x0',
          data: estimateGasParams.data || '0x'
        }, blockParam]
      };

      console.log('Estimating gas with payload:', requestPayload);
      const gasEstimate = await passportProvider.request(requestPayload);
      console.log('Gas estimate response:', gasEstimate);

      result = {
        method: 'eth_estimateGas',
        description: "Generates and returns an estimate of how much gas is necessary to allow the transaction to complete.",
        request: requestPayload,
        response: gasEstimate,
        formatted: `Estimated Gas: ${parseInt(gasEstimate, 16).toLocaleString()} units`
      };
      displayOrder = ['eth_estimateGas'];
    } catch (error: any) {
      console.error('Error estimating gas:', error);
      result = {
        method: 'eth_estimateGas',
        description: "Generates and returns an estimate of how much gas is necessary to allow the transaction to complete.",
        error: error.message || 'Failed to estimate gas'
      };
      displayOrder = ['eth_estimateGas'];
    }
  }

  async function executeGetBalance() {
    console.log('Executing balance check');
    console.log('Balance params:', balanceParams);

    try {
      if (!balanceParams.address) {
        throw new Error('Address is required');
      }

      if (!passportProvider) {
        throw new Error('Provider not initialized');
      }

      const balanceBlockParam = getBlockParameter(balanceParams.blockParam, balanceParams.customBlockNumber);
      const requestPayload = { 
        method: 'eth_getBalance',
        params: [
          balanceParams.address,
          balanceBlockParam
        ]
      };
      
      console.log('Requesting balance with payload:', requestPayload);
      const balance = await passportProvider.request(requestPayload);
      console.log('Balance response:', balance);
      
      const balanceInEther = ethers.formatEther(balance);
      result = {
        method: 'eth_getBalance',
        description: "Returns the balance of the account of given address in wei.",
        request: requestPayload,
        response: balance,
        formatted: `${balanceInEther} tIMX (${balance} Wei)`
      };
      displayOrder = ['eth_getBalance'];
    } catch (error: any) {
      console.error('Error getting balance:', error);
      result = {
        method: 'eth_getBalance',
        description: "Returns the balance of the account of given address in wei.",
        error: error.message || 'Failed to get balance'
      };
      displayOrder = ['eth_getBalance'];
    }
  }

  async function executeCall() {
    console.log('Executing contract call');
    console.log('Call params:', callParams);

    try {
      if (!callParams.to) {
        throw new Error('To address is required');
      }

      if (!passportProvider) {
        throw new Error('Provider not initialized');
      }

      // 트랜잭션 객체 구성
      const transaction: any = {
        to: callParams.to
      };

      // 선택적 필드들은 값이 있을 때만 추가
      if (callParams.data && callParams.data.trim() !== '') {
        transaction.data = callParams.data;
      }

      if (callParams.value && callParams.value.trim() !== '') {
        transaction.value = callParams.value;
      }

      const requestPayload = {
        method: 'eth_call',
        params: [
          transaction,
          callParams.blockNumber
        ]
      };

      console.log('Making contract call with payload:', requestPayload);
      const response = await passportProvider.request(requestPayload);
      console.log('Call response:', response);

      result = {
        method: 'eth_call',
        description: "Executes a new message call immediately without creating a transaction on the blockchain.",
        request: requestPayload,
        response: response
      };
      displayOrder = ['eth_call'];
    } catch (error: any) {
      console.error('Error making contract call:', error);
      result = {
        method: 'eth_call',
        description: "Executes a new message call immediately without creating a transaction on the blockchain.",
        error: error.message || 'Failed to make contract call'
      };
      displayOrder = ['eth_call'];
    }
  }

  async function executeGetBlockByHash() {
    console.log('Executing get block by hash');
    console.log('Block by hash params:', blockByHashParams);

    try {
      if (!blockByHashParams.blockHash) {
        throw new Error('Block hash is required');
      }

      if (!passportProvider) {
        throw new Error('Provider not initialized');
      }

      const requestPayload = {
        method: 'eth_getBlockByHash',
        params: [
          blockByHashParams.blockHash,
          blockByHashParams.includeTransactions
        ]
      };

      console.log('Getting block with payload:', requestPayload);
      const response = await passportProvider.request(requestPayload);
      console.log('Block response:', response);

      result = {
        method: 'eth_getBlockByHash',
        description: "Returns information about a block by hash.",
        request: requestPayload,
        response: response
      };
      displayOrder = ['eth_getBlockByHash'];
    } catch (error: any) {
      console.error('Error getting block:', error);
      result = {
        method: 'eth_getBlockByHash',
        description: "Returns information about a block by hash.",
        error: error.message || 'Failed to get block'
      };
      displayOrder = ['eth_getBlockByHash'];
    }
  }

  async function executeGetBlockByNumber() {
    console.log('Executing get block by number');
    console.log('Block by number params:', blockByNumberParams);

    try {
      if (!passportProvider) {
        throw new Error('Provider not initialized');
      }

      let blockParameter = blockByNumberParams.blockNumber;
      if (blockParameter === 'number') {
        if (!blockByNumberParams.customBlockNumber) {
          throw new Error('Block number is required when "Block number" is selected');
        }
        // Handle both hex and decimal input
        if (blockByNumberParams.customBlockNumber.startsWith('0x')) {
          blockParameter = blockByNumberParams.customBlockNumber;
        } else if (/^\d+$/.test(blockByNumberParams.customBlockNumber)) {
          blockParameter = '0x' + Number(blockByNumberParams.customBlockNumber).toString(16);
        } else {
          throw new Error('Invalid block number format. Use decimal or hex (0x) format');
        }
      }

      const requestPayload = {
        method: 'eth_getBlockByNumber',
        params: [
          blockParameter,
          blockByNumberParams.includeTransactions
        ]
      };

      console.log('Getting block with payload:', requestPayload);
      const response = await passportProvider.request(requestPayload);
      console.log('Block response:', response);

      result = {
        method: 'eth_getBlockByNumber',
        description: "Returns information about a block by block number.",
        request: requestPayload,
        response: response,
        formatted: response ? `
Block Number: ${parseInt(response.number, 16).toLocaleString()}
Hash: ${response.hash}
Parent Hash: ${response.parentHash}
Timestamp: ${new Date(parseInt(response.timestamp, 16) * 1000).toLocaleString()}
Gas Used: ${parseInt(response.gasUsed, 16).toLocaleString()}
Gas Limit: ${parseInt(response.gasLimit, 16).toLocaleString()}
Transactions: ${formatTransactions(response.transactions)}` : 'Block not found'
      };
      displayOrder = ['eth_getBlockByNumber'];
    } catch (error: any) {
      console.error('Error getting block:', error);
      result = {
        method: 'eth_getBlockByNumber',
        description: "Returns information about a block by block number.",
        error: error.message || 'Failed to get block'
      };
      displayOrder = ['eth_getBlockByNumber'];
    }
  }

  async function executeGetTransactionByHash() {
    console.log('Executing get transaction by hash');
    console.log('Transaction by hash params:', transactionByHashParams);

    try {
      if (!transactionByHashParams.hash) {
        throw new Error('Transaction hash is required');
      }

      if (!transactionByHashParams.hash.startsWith('0x')) {
        throw new Error('Transaction hash must start with 0x');
      }

      if (!passportProvider) {
        throw new Error('Provider not initialized');
      }

      const requestPayload = {
        method: 'eth_getTransactionByHash',
        params: [transactionByHashParams.hash]
      };

      console.log('Getting transaction with payload:', requestPayload);
      const response = await passportProvider.request(requestPayload);
      console.log('Transaction response:', response);

      if (!response) {
        result = {
          method: 'eth_getTransactionByHash',
          description: "Returns the information about a transaction requested by transaction hash.",
          request: requestPayload,
          response: null,
          formatted: 'Transaction not found'
        };
      } else {
        const valueInIMX = response.value ? (BigInt(response.value) / BigInt(1e18)).toString() : '0';
        const gasPrice = response.gasPrice ? (BigInt(response.gasPrice) / BigInt(1e9)).toString() : '0';
        
        result = {
          method: 'eth_getTransactionByHash',
          description: "Returns the information about a transaction requested by transaction hash.",
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
        description: "Returns the information about a transaction requested by transaction hash.",
        error: error.message || 'Failed to get transaction'
      };
      displayOrder = ['eth_getTransactionByHash'];
    }
  }

  async function handleRpcCall(method: string) {
    try {
      // 새로운 RPC 호출시 이전 결과 초기화
      displayOrder = [];
      result = null;

      // 폼 표시 상태 초기화
      showTransactionForm = false;
      showBlockByHashForm = false;
      showTransactionByHashForm = false;
      showSignTypedDataForm = false;
      showPersonalSignForm = false;

      switch (method) {
        case 'eth_requestAccounts':
          const requestAccountsPayload = { method: 'eth_requestAccounts' };
          const accounts = await passportProvider.request(requestAccountsPayload);
          result = {
            method: 'eth_requestAccounts',
            description: "Returns the list of accounts the user has granted access to.",
            request: requestAccountsPayload,
            response: accounts,
            formatted: JSON.stringify(accounts, null, 2)
          };
          displayOrder = ['eth_requestAccounts'];
          break;

        case 'eth_accounts':
          const accountsPayload = { method: 'eth_accounts' };
          const accountsList = await passportProvider.request(accountsPayload);
          result = {
            method: 'eth_accounts',
            description: "Returns the list of Passport accounts that the user has authorised to connect to the dApp.",
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
              description: "Returns the chain ID of the current network.",
              request: { method: 'eth_chainId', params: [] },
              response: response,
              formatted: `Chain ID: ${parseInt(response, 16)} (0x${parseInt(response, 16).toString(16)})`
            };
            displayOrder = ['eth_chainId'];
          } catch (error: any) {
            result = {
              method: 'eth_chainId',
              description: "Returns the chain ID of the current network.",
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
              description: "Returns the number of most recent block.",
              request: { method: 'eth_blockNumber', params: [] },
              response: response,
              formatted: `Current Block Number: ${parseInt(response, 16).toLocaleString()}`
            };
            displayOrder = ['eth_blockNumber'];
          } catch (error: any) {
            result = {
              method: 'eth_blockNumber',
              description: "Returns the number of most recent block.",
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
            description: "Returns the current gas price in wei.",
            request: gasPricePayload,
            response: gasPrice,
            formatted: `${(Number(gasPrice) / 1_000_000_000).toFixed(9)} Gwei`
          };
          displayOrder = ['eth_gasPrice'];
          break;

        case 'eth_getBalance':
          // 메뉴 클릭 시에는 폼만 표시
          balanceParams = {
            address: userAddress || '',
            blockParam: 'latest',
            customBlockNumber: ''
          };
          result = {
            method: 'eth_getBalance',
            description: "Returns the balance of the account of given address in wei.",
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
          
          showTransactionForm = true;
          transactionParams = {
            to: DEFAULT_TRANSACTION.to,
            value: DEFAULT_TRANSACTION.value,
            data: '',
            gasLimit: '',
            maxFeePerGas: '',
            maxPriorityFeePerGas: ''
          };
          result = {
            method: 'eth_sendTransaction',
            description: "Creates new message call transaction or a contract creation, if the data field contains code.",
            request: null,
            response: null,
            formatted: null
          };
          displayOrder = ['eth_sendTransaction'];
          break;

        case 'eth_getTransactionCount':
          // 메뉴 클릭 시에는 폼만 표시
          transactionCountParams = {
            address: userAddress || '',
            blockNumber: 'latest',
            customBlockNumber: ''
          };
          result = {
            method: 'eth_getTransactionCount',
            description: "Returns the number of transactions sent from an address.",
            request: null,
            response: null
          };
          displayOrder = ['eth_getTransactionCount'];
          break;

        case 'eth_getStorageAt':
          // 메뉴 클릭 시에는 폼만 표시
          storageParams = {
            address: userAddress || '',
            slot: '0x0',
            blockParam: 'latest',
            customBlockNumber: ''
          };
          result = {
            method: 'eth_getStorageAt',
            description: "Returns the value from a storage position at a given address.",
            request: null,
            response: null,
            formatted: null
          };
          displayOrder = ['eth_getStorageAt'];
          break;

        case 'eth_estimateGas':
          // 메뉴 클릭 시에는 폼만 표시
          estimateGasParams = {
            to: userAddress || '',  // 현재 로그인된 주소를 기본값으로 설정
            data: '0x',
            value: '0x0',
            blockParam: 'latest',
            customBlockNumber: ''
          };
          result = {
            method: 'eth_estimateGas',
            description: "Generates and returns an estimate of how much gas is necessary to allow the transaction to complete.",
            request: null,
            response: null,
            formatted: null
          };
          displayOrder = ['eth_estimateGas'];
          break;

        case 'eth_call':
          // 메뉴 클릭 시에는 폼만 표시
          callParams = {
            to: '',
            data: '0x',
            value: '0x0',
            blockNumber: 'latest'
          };
          result = {
            method: 'eth_call',
            description: "Executes a new message call immediately without creating a transaction on the blockchain.",
            request: null,
            response: null
          };
          displayOrder = ['eth_call'];
          break;

        case 'eth_getBlockByHash':
          // 메뉴 클릭 시에는 폼만 표시
          blockByHashParams = {
            blockHash: '',
            includeTransactions: false
          };
          result = {
            method: 'eth_getBlockByHash',
            description: "Returns information about a block by hash.",
            request: null,
            response: null
          };
          displayOrder = ['eth_getBlockByHash'];
          break;

        case 'eth_getBlockByNumber':
          // 메뉴 클릭 시에는 폼만 표시
          blockByNumberParams = {
            blockNumber: 'latest',
            includeTransactions: false,
            customBlockNumber: ''
          };
          result = {
            method: 'eth_getBlockByNumber',
            description: "Returns information about a block by block number.",
            request: null,
            response: null
          };
          displayOrder = ['eth_getBlockByNumber'];
          break;

        case 'eth_getTransactionByHash':
          // 메뉴 클릭 시에는 폼만 표시
          transactionByHashParams = {
            hash: ''
          };
          result = {
            method: 'eth_getTransactionByHash',
            description: "Returns the information about a transaction requested by transaction hash.",
            request: null,
            response: null
          };
          displayOrder = ['eth_getTransactionByHash'];
          break;

        case 'eth_getTransactionReceipt':
          // 메뉴 클릭 시에는 폼만 표시
          transactionReceiptParams = {
            hash: ''
          };
          result = {
            method: 'eth_getTransactionReceipt',
            description: "Returns the receipt of a transaction by transaction hash.",
            request: null,
            response: null
          };
          displayOrder = ['eth_getTransactionReceipt'];
          break;

        case 'eth_getTransactionCount':
          // 메뉴 클릭 시에는 폼만 표시
          transactionCountParams = {
            address: userAddress || '',
            blockNumber: 'latest',
            customBlockNumber: ''
          };
          result = {
            method: 'eth_getTransactionCount',
            description: "Returns the number of transactions sent from an address.",
            request: null,
            response: null
          };
          displayOrder = ['eth_getTransactionCount'];
          break;

        case 'eth_getCode':
          // 메뉴 클릭 시에는 폼만 표시
          getCodeParams = {
            address: userAddress || '',
            blockNumber: 'latest',
            customBlockNumber: ''
          };
          result = {
            method: 'eth_getCode',
            description: "Returns code at a given address.",
            request: null,
            response: null
          };
          displayOrder = ['eth_getCode'];
          break;

        case 'eth_signTypedData_v4':
          // 메뉴 클릭 시에는 폼만 표시
          showSignTypedDataForm = true;
          signTypedDataParams.typedData.domain.chainId = NETWORK_CONFIG[currentNetwork].chainId;
          signTypedDataParams.typedData.message.from.wallet = userAddress || '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826';
          result = {
            method: 'eth_signTypedData_v4',
            description: "Enables passport users to sign EIP-712 structured messages off-chain.",
            request: null,
            response: null
          };
          displayOrder = ['eth_signTypedData_v4'];
          break;

        case 'personal_sign':
          // 메뉴 클릭 시에는 폼만 표시
          showPersonalSignForm = true;
          personalSignParams = {
            message: 'Hello, Immutable zkEVM',
            fromAddress: userAddress || ''
          };
          result = {
            method: 'personal_sign',
            description: "Signs a message using the personal_sign method.",
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

      const value = transactionParams.value || DEFAULT_TRANSACTION.value;
      const hexValue = `0x${BigInt(value).toString(16)}`;

      const tx = {
        to: transactionParams.to || DEFAULT_TRANSACTION.to,
        value: hexValue,
        data: transactionParams.data || '0x'
      };
      
      result = {
        method: 'eth_sendTransaction',
        description: "Creates new message call transaction or a contract creation, if the data field contains code.",
        request: tx,
        response: 'Sending transaction...',
        formatted: 'Sending transaction...'
      };
      
      const transactionResponse = await signer.sendTransaction(tx);
      result = {
        method: 'eth_sendTransaction',
        description: "Creates new message call transaction or a contract creation, if the data field contains code.",
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
        description: "Creates new message call transaction or a contract creation, if the data field contains code.",
        request: tx,
        response: receipt,
        formatted: JSON.stringify(details, null, 2)
      };
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('DID Token')) {
        result = {
          method: 'eth_sendTransaction',
          description: "Creates new message call transaction or a contract creation, if the data field contains code.",
          error: 'Error: Please login again. Your session might have expired.'
        };
        await handleLogout();
      } else {
        result = {
          method: 'eth_sendTransaction',
          description: "Creates new message call transaction or a contract creation, if the data field contains code.",
          error: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
        };
      }
    }
  }

  function formatTransactions(transactions: any[] | null): string {
    if (!transactions || !Array.isArray(transactions)) return 'No transactions';
    
    if (transactions.length === 0) return 'No transactions in this block';

    if (typeof transactions[0] === 'string') {
      // 트랜잭션 해시만 있는 경우
      return `${transactions.length} transactions\n` +
        transactions.map((hash: string) => `  - ${hash}`).join('\n');
    } else {
      // 전체 트랜잭션 객체가 있는 경우
      return `${transactions.length} transactions\n` +
        transactions.map((tx: BlockTransaction) => {
          const valueInIMX = tx.value ? (BigInt(tx.value) / BigInt(1e18)).toString() : '0';
          const gasPrice = tx.gasPrice ? (BigInt(tx.gasPrice) / BigInt(1e9)).toString() : '0';
          
          return `  - Hash: ${tx.hash}\n` +
            `    From: ${tx.from}\n` +
            `    To: ${tx.to || 'Contract Creation'}\n` +
            `    Value: ${valueInIMX} IMX\n` +
            `    Gas Limit: ${parseInt(tx.gas, 16).toLocaleString()}\n` +
            `    Gas Price: ${gasPrice} Gwei\n` +
            `    Nonce: ${parseInt(tx.nonce, 16)}\n` +
            `    Block Number: ${parseInt(tx.blockNumber, 16).toLocaleString()}\n` +
            `    Transaction Index: ${parseInt(tx.transactionIndex, 16)}`;
        }).join('\n\n');
    }
  }

  function getSolidityVersion(bytecode: string): string {
    // CBOR 인코딩된 메타데이터를 찾기 위해 마지막 부분 확인
    const match = bytecode.match(/a264697066735822/);
    if (!match || match.index === undefined) return 'Unknown';
    
    const versionMatch = bytecode.slice(match.index - 100, match.index).match(/736f6c6343(.{8})/);
    if (versionMatch) {
      const version = versionMatch[1];
      // 16진수를 버전 문자열로 변환
      const major = parseInt(version.slice(0, 2), 16);
      const minor = parseInt(version.slice(2, 4), 16);
      const patch = parseInt(version.slice(4, 6), 16);
      return `v${major}.${minor}.${patch}`;
    }
    return 'Unknown';
  }

  async function executeGetTransactionReceipt() {
    console.log('Executing get transaction receipt');
    console.log('Transaction receipt params:', transactionReceiptParams);

    try {
      if (!transactionReceiptParams.hash) {
        throw new Error('Transaction hash is required');
      }

      if (!transactionReceiptParams.hash.startsWith('0x')) {
        throw new Error('Transaction hash must start with 0x');
      }

      if (!passportProvider) {
        throw new Error('Provider not initialized');
      }

      const requestPayload = {
        method: 'eth_getTransactionReceipt',
        params: [transactionReceiptParams.hash]
      };

      console.log('Getting transaction receipt with payload:', requestPayload);
      const response = await passportProvider.request(requestPayload);
      console.log('Transaction receipt response:', response);

      if (!response) {
        result = {
          method: 'eth_getTransactionReceipt',
          description: "Returns the receipt of a transaction by transaction hash.",
          request: requestPayload,
          response: null,
          formatted: 'Transaction receipt not found (transaction may be pending)'
        };
      } else {
        const gasUsed = parseInt(response.gasUsed, 16).toLocaleString();
        const cumulativeGasUsed = parseInt(response.cumulativeGasUsed, 16).toLocaleString();
        const effectiveGasPrice = response.effectiveGasPrice ? 
          (BigInt(response.effectiveGasPrice) / BigInt(1e9)).toString() : 
          'Not available';
        
        let logs = '';
        if (response.logs && response.logs.length > 0) {
          logs = '\n\nEvent Logs:\n' + response.logs.map((log: any, index: number) => 
            `Log ${index + 1}:\n` +
            `  Address: ${log.address}\n` +
            `  Topics: ${log.topics.join('\n          ')}\n` +
            `  Data: ${log.data}`
          ).join('\n\n');
        }

        result = {
          method: 'eth_getTransactionReceipt',
          description: "Returns the receipt of a transaction by transaction hash.",
          request: requestPayload,
          response: response,
          formatted: `Transaction Receipt:
Hash: ${response.transactionHash}
Status: ${response.status === '0x1' ? 'Success' : 'Failed'}
Block Number: ${parseInt(response.blockNumber, 16).toLocaleString()}
Block Hash: ${response.blockHash}
From: ${response.from}
To: ${response.to || 'Contract Creation'}
Contract Address: ${response.contractAddress || 'N/A'}
Gas Used: ${gasUsed}
Cumulative Gas Used: ${cumulativeGasUsed}
Effective Gas Price: ${effectiveGasPrice} Gwei
Transaction Index: ${parseInt(response.transactionIndex, 16)}${logs}`
        };
      }
      displayOrder = ['eth_getTransactionReceipt'];
    } catch (error: any) {
      console.error('Error getting transaction receipt:', error);
      result = {
        method: 'eth_getTransactionReceipt',
        description: "Returns the receipt of a transaction by transaction hash.",
        error: error.message || 'Failed to get transaction receipt'
      };
      displayOrder = ['eth_getTransactionReceipt'];
    }
  }

  async function executeGetTransactionCount() {
    console.log('Executing get transaction count');
    console.log('Transaction count params:', transactionCountParams);

    try {
      const address = transactionCountParams.address || userAddress;
      if (!address) {
        throw new Error('Address is required');
      }
      if (!address.startsWith('0x')) {
        throw new Error('Valid address starting with 0x is required');
      }

      let blockParameter = transactionCountParams.blockNumber;
      if (blockParameter === 'number') {
        if (!transactionCountParams.customBlockNumber) {
          throw new Error('Block number is required when "Block number" is selected');
        }
        // Handle both hex and decimal input
        if (transactionCountParams.customBlockNumber.startsWith('0x')) {
          blockParameter = transactionCountParams.customBlockNumber;
        } else if (/^\d+$/.test(transactionCountParams.customBlockNumber)) {
          blockParameter = '0x' + Number(transactionCountParams.customBlockNumber).toString(16);
        } else {
          throw new Error('Invalid block number format. Use decimal or hex (0x) format');
        }
      }

      const requestPayload = {
        method: 'eth_getTransactionCount',
        params: [address, blockParameter]
      };

      console.log('Getting transaction count with payload:', requestPayload);
      const response = await passportProvider.request(requestPayload);
      console.log('Transaction count response:', response);

      result = {
        method: 'eth_getTransactionCount',
        description: "Returns the number of transactions sent from an address.",
        request: requestPayload,
        response: response,
        formatted: `Number of transactions sent from ${address}: ${parseInt(response, 16).toLocaleString()}`
      };
      displayOrder = ['eth_getTransactionCount'];
    } catch (error: any) {
      console.error('Error getting transaction count:', error);
      result = {
        method: 'eth_getTransactionCount',
        description: "Returns the number of transactions sent from an address.",
        error: error.message || 'Failed to get transaction count'
      };
      displayOrder = ['eth_getTransactionCount'];
    }
  }

  async function executeGetCode() {
    console.log('Executing get code');
    console.log('Get code params:', getCodeParams);

    try {
      if (!getCodeParams.address) {
        throw new Error('Address is required');
      }

      if (!getCodeParams.address.startsWith('0x')) {
        throw new Error('Valid address starting with 0x is required');
      }

      if (!passportProvider) {
        throw new Error('Provider not initialized');
      }

      let blockParameter = getCodeParams.blockNumber;
      if (blockParameter === 'number') {
        if (!getCodeParams.customBlockNumber) {
          throw new Error('Block number is required when "Block number" is selected');
        }
        // Handle both hex and decimal input
        if (getCodeParams.customBlockNumber.startsWith('0x')) {
          blockParameter = getCodeParams.customBlockNumber;
        } else if (/^\d+$/.test(getCodeParams.customBlockNumber)) {
          blockParameter = '0x' + Number(getCodeParams.customBlockNumber).toString(16);
        } else {
          throw new Error('Invalid block number format. Use decimal or hex (0x) format');
        }
      }

      const requestPayload = {
        method: 'eth_getCode',
        params: [getCodeParams.address, blockParameter]
      };

      console.log('Getting code with payload:', requestPayload);
      const response = await passportProvider.request(requestPayload);
      console.log('Code response:', response);

      // Check if it's a contract
      const isContract = response !== '0x';
      const bytecodeSize = (response.length - 2) / 2; // -2 for '0x' prefix, /2 for hex pairs

      let formattedResponse = isContract ? 
        `Contract detected at ${getCodeParams.address}\nBytecode size: ${bytecodeSize} bytes\nBytecode: ${response}` :
        `No contract code found at ${getCodeParams.address} (this is a regular address)`;

      result = {
        method: 'eth_getCode',
        description: "Returns code at a given address.",
        request: requestPayload,
        response: response,
        formatted: formattedResponse
      };
      displayOrder = ['eth_getCode'];
    } catch (error: any) {
      console.error('Error getting code:', error);
      result = {
        method: 'eth_getCode',
        description: "Returns code at a given address.",
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
        params: [
          userAddress,
          JSON.stringify(signTypedDataParams.typedData)
        ]
      };

      console.log('Signing typed data with payload:', requestPayload);
      const signature = await passportProvider.request(requestPayload);
      console.log('Signature:', signature);

      result = {
        method: 'eth_signTypedData_v4',
        description: "Signs typed structured data using the EIP-712 specification (v4).",
        request: {
          ...requestPayload,
          params: [requestPayload.params[0], JSON.parse(requestPayload.params[1])]
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
        description: "Signs typed structured data using the EIP-712 specification (v4).",
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
        params: [
          personalSignParams.message,
          personalSignParams.fromAddress
        ]
      };

      console.log('Signing message with payload:', requestPayload);
      const signature = await passportProvider.request(requestPayload);
      console.log('Signature:', signature);

      result = {
        method: 'personal_sign',
        description: "Signs a message using the personal_sign method.",
        request: requestPayload,
        response: signature,
        formatted: `Signature: ${signature}\n\nSigned Message Details:\nFrom: ${personalSignParams.fromAddress}\nMessage: ${personalSignParams.message}`
      };
      displayOrder = ['personal_sign'];
    } catch (error: any) {
      console.error('Error signing message:', error);
      result = {
        method: 'personal_sign',
        description: "Signs a message using the personal_sign method.",
        error: error.message || 'Failed to sign message'
      };
      displayOrder = ['personal_sign'];
    }
  }
</script>

<div class="min-h-screen bg-gray-50">
  <div class="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
    <div class="flex gap-6">
      <!-- Sidebar -->
      <aside class="w-64 flex-none">
        <div class="bg-white rounded-lg shadow-sm p-6 sticky top-8">
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
              <button
                class="w-full bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
                on:click={handleLogin}
              >
                Connect Wallet
              </button>
            {/if}

            <!-- Actions -->
            <div class="space-y-2">
              <h3 class="text-lg font-medium text-gray-900 mb-3">Actions</h3>
              <button
                class="w-full text-left px-4 py-2 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
                on:click={() => handleGetIdToken()}
              >
                Get ID Token
              </button>
              <button
                class="w-full text-left px-4 py-2 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
                on:click={() => handleGetAccessToken()}
              >
                Get Access Token
              </button>
              <button
                class="w-full text-left px-4 py-2 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
                on:click={() => handleGetUserInfo()}
              >
                Get User Info
              </button>
              <button
                class="w-full text-left px-4 py-2 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
                on:click={() => handleGetLinkedAddresses()}
              >
                Get Linked Addresses
              </button>
            </div>

            <!-- RPC Methods -->
            <div class="space-y-2">
              <h3 class="text-lg font-medium text-gray-900 mb-3">RPC Methods</h3>
              
              <!-- Network Selection -->
              <div class="flex gap-2 mb-2">
                <button
                  class="flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors
                    {currentNetwork === 'testnet' ? 
                      'bg-indigo-100 text-indigo-700' : 
                      'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
                  on:click={() => switchNetwork('testnet')}
                >
                  Testnet
                </button>
                <button
                  class="flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors
                    {currentNetwork === 'mainnet' ? 
                      'bg-indigo-100 text-indigo-700' : 
                      'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
                  on:click={() => switchNetwork('mainnet')}
                >
                  Mainnet
                </button>
              </div>

              <button
                class="w-full text-left px-4 py-2 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
                on:click={() => handleRpcCall('eth_requestAccounts')}
              >
                Request Accounts
              </button>
              <button
                class="w-full text-left px-4 py-2 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
                on:click={() => handleRpcCall('eth_sendTransaction')}
              >
                Send Transaction
              </button>
              <button
                class="w-full text-left px-4 py-2 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
                on:click={() => handleRpcCall('eth_accounts')}
              >
                Get Accounts
              </button>
              <button
                class="w-full text-left px-4 py-2 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
                on:click={() => handleRpcCall('eth_gasPrice')}
              >
                Get Gas Price
              </button>
              <button
                class="w-full text-left px-4 py-2 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
                on:click={() => handleRpcCall('eth_getBalance')}
              >
                Get Balance
              </button>
              <button
                class="w-full text-left px-4 py-2 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
                on:click={() => handleRpcCall('eth_getStorageAt')}
              >
                Get Storage
              </button>
              <button
                class="w-full text-left px-4 py-2 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
                on:click={() => handleRpcCall('eth_estimateGas')}
              >
                Get Estimate Gas
              </button>
              <button
                class="w-full text-left px-4 py-2 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
                on:click={() => handleRpcCall('eth_call')}
              >
                Call
              </button>
              <button
                class="w-full text-left px-4 py-2 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
                on:click={() => handleRpcCall('eth_chainId')}
              >
                Get Chain ID
              </button>
              <button
                class="w-full text-left px-4 py-2 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
                on:click={() => handleRpcCall('eth_blockNumber')}
              >
                Get Block Number
              </button>
              <button
                class="w-full text-left px-4 py-2 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
                on:click={() => handleRpcCall('eth_getBlockByHash')}
              >
                Get Block By Hash
              </button>
              <button
                class="w-full text-left px-4 py-2 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
                on:click={() => handleRpcCall('eth_getBlockByNumber')}
              >
                Get Block By Number
              </button>
              <button
                class="w-full text-left px-4 py-2 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
                on:click={() => handleRpcCall('eth_getTransactionByHash')}
              >
                Get Transaction By Hash
              </button>
              <button
                class="w-full text-left px-4 py-2 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
                on:click={() => handleRpcCall('eth_getTransactionReceipt')}
              >
                Get Transaction Receipt
              </button>
              <button
                class="w-full text-left px-4 py-2 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
                on:click={() => handleRpcCall('eth_getTransactionCount')}
              >
                Get Transaction Count
              </button>
              <button
                class="w-full text-left px-4 py-2 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
                on:click={() => handleRpcCall('eth_getCode')}
              >
                Get Code
              </button>
              <button
                class="w-full text-left px-4 py-2 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
                on:click={() => handleRpcCall('eth_signTypedData_v4')}
              >
                Sign Typed Data v4
              </button>
              <button
                class="w-full text-left px-4 py-2 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
                on:click={() => handleRpcCall('personal_sign')}
              >
                Personal Sign
              </button>
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
                  <div class="border-b border-gray-200 pb-4 mb-4">
                    <h3 class="text-lg font-medium text-gray-900">{type}</h3>
                    {#if result?.description}
                      <p class="mt-1 text-sm text-gray-600">{result.description}</p>
                    {/if}
                  </div>

                  <!-- Input Forms -->
                  {#if type === 'eth_getBalance'}
                    <div class="space-y-4 mb-4">
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1" for="balance-address">
                          Address <span class="text-red-600">*</span>
                        </label>
                        <input
                          type="text"
                          id="balance-address"
                          bind:value={balanceParams.address}
                          placeholder={userAddress || '0x...'}
                          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                        <p class="mt-1 text-xs text-gray-500">The address to check balance for.</p>
                      </div>

                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1" for="balance-block">
                          Block Parameter
                        </label>
                        <select
                          id="balance-block"
                          bind:value={balanceParams.blockParam}
                          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                        >
                          <option value="latest">latest</option>
                          <option value="earliest">earliest</option>
                          <option value="pending">pending</option>
                          <option value="safe">safe</option>
                          <option value="finalized">finalized</option>
                          <option value="number">Block Number</option>
                        </select>
                        <p class="mt-1 text-xs text-gray-500">The block number to check balance at.</p>
                      </div>

                      {#if balanceParams.blockParam === 'number'}
                        <div>
                          <label class="block text-sm font-medium text-gray-700 mb-1" for="balance-block-number">
                            Block Number
                          </label>
                          <input
                            type="text"
                            id="balance-block-number"
                            bind:value={balanceParams.customBlockNumber}
                            placeholder="123 or 0x7b"
                            class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          />
                          <p class="mt-1 text-xs text-gray-500">Enter decimal number or hexadecimal with 0x prefix.</p>
                        </div>
                      {/if}

                      <button
                        class="w-full bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
                        on:click={executeGetBalance}
                      >
                        Get Balance
                      </button>
                    </div>
                  {/if}

                  {#if type === 'eth_sendTransaction' && showTransactionForm}
                    <div class="space-y-4 mb-4">
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1" for="tx-to">
                          To Address <span class="text-red-600">*</span>
                        </label>
                        <input
                          type="text"
                          id="tx-to"
                          bind:value={transactionParams.to}
                          placeholder="0x..."
                          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                        <p class="mt-1 text-xs text-gray-500">The address to send transaction to.</p>
                      </div>

                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1" for="tx-value">
                          Value (in Wei) <span class="text-red-600">*</span>
                        </label>
                        <input
                          type="text"
                          id="tx-value"
                          bind:value={transactionParams.value}
                          placeholder="1000000000000000"
                          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                        <p class="mt-1 text-xs text-gray-500">Amount of wei to send.</p>
                      </div>

                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1" for="tx-data">
                          Data
                        </label>
                        <input
                          type="text"
                          id="tx-data"
                          bind:value={transactionParams.data}
                          placeholder="0x..."
                          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                        <p class="mt-1 text-xs text-gray-500">Optional data to include in the transaction.</p>
                      </div>

                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1" for="tx-gas-limit">
                          Gas Limit
                        </label>
                        <input
                          type="text"
                          id="tx-gas-limit"
                          bind:value={transactionParams.gasLimit}
                          placeholder="21000"
                          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                        <p class="mt-1 text-xs text-gray-500">Optional gas limit (default: estimated automatically).</p>
                      </div>

                      <button
                        class="w-full bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
                        on:click={sendTransaction}
                      >
                        Send Transaction
                      </button>
                    </div>
                  {/if}

                  {#if type === 'eth_getStorageAt'}
                    <div class="space-y-4 mb-4">
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1" for="storage-address">
                          Address <span class="text-red-600">*</span>
                        </label>
                        <input
                          type="text"
                          id="storage-address"
                          bind:value={storageParams.address}
                          placeholder={userAddress || '0x...'}
                          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                        <p class="mt-1 text-xs text-gray-500">The address of the storage to read from.</p>
                      </div>

                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1" for="storage-slot">
                          Storage Slot <span class="text-red-600">*</span>
                        </label>
                        <input
                          type="text"
                          id="storage-slot"
                          bind:value={storageParams.slot}
                          placeholder="0x0"
                          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                        <p class="mt-1 text-xs text-gray-500">The position in the storage to read from.</p>
                      </div>

                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1" for="storage-block">
                          Block Parameter
                        </label>
                        <select
                          id="storage-block"
                          bind:value={storageParams.blockParam}
                          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                        >
                          <option value="latest">latest</option>
                          <option value="earliest">earliest</option>
                          <option value="pending">pending</option>
                          <option value="safe">safe</option>
                          <option value="finalized">finalized</option>
                          <option value="number">Block Number</option>
                        </select>
                        <p class="mt-1 text-xs text-gray-500">The block number to read storage from. If omitted, the latest block is used.</p>
                      </div>

                      {#if storageParams.blockParam === 'number'}
                        <div>
                          <label class="block text-sm font-medium text-gray-700 mb-1" for="storage-block-number">
                            Block Number
                          </label>
                          <input
                            type="text"
                            id="storage-block-number"
                            bind:value={storageParams.customBlockNumber}
                            placeholder="123 or 0x7b"
                            class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          />
                          <p class="mt-1 text-xs text-gray-500">Enter decimal number or hexadecimal with 0x prefix.</p>
                        </div>
                      {/if}

                      <button
                        class="w-full bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
                        on:click={executeStorageCall}
                      >
                        Get Storage
                      </button>
                    </div>
                  {/if}

                  {#if type === 'eth_estimateGas'}
                    <div class="space-y-4 mb-4">
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1" for="estimate-to">
                          To Address <span class="text-red-600">*</span>
                        </label>
                        <input
                          type="text"
                          id="estimate-to"
                          bind:value={estimateGasParams.to}
                          placeholder="0x..."
                          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                        <p class="mt-1 text-xs text-gray-500">The address to estimate gas for.</p>
                      </div>

                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1" for="estimate-value">
                          Value (in Wei)
                        </label>
                        <input
                          type="text"
                          id="estimate-value"
                          bind:value={estimateGasParams.value}
                          placeholder="0x0"
                          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                        <p class="mt-1 text-xs text-gray-500">Amount of wei to send (hex format).</p>
                      </div>

                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1" for="estimate-data">
                          Data
                        </label>
                        <input
                          type="text"
                          id="estimate-data"
                          bind:value={estimateGasParams.data}
                          placeholder="0x..."
                          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                        <p class="mt-1 text-xs text-gray-500">The data for the transaction (hex format).</p>
                      </div>

                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1" for="estimate-block">
                          Block Parameter
                        </label>
                        <select
                          id="estimate-block"
                          bind:value={estimateGasParams.blockParam}
                          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                        >
                          <option value="latest">latest</option>
                          <option value="earliest">earliest</option>
                          <option value="pending">pending</option>
                          <option value="safe">safe</option>
                          <option value="finalized">finalized</option>
                          <option value="number">Block Number</option>
                        </select>
                        <p class="mt-1 text-xs text-gray-500">The block to estimate gas at.</p>
                      </div>

                      {#if estimateGasParams.blockParam === 'number'}
                        <div>
                          <label class="block text-sm font-medium text-gray-700 mb-1" for="estimate-block-number">
                            Block Number
                          </label>
                          <input
                            type="text"
                            id="estimate-block-number"
                            bind:value={estimateGasParams.customBlockNumber}
                            placeholder="123 or 0x7b"
                            class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          />
                          <p class="mt-1 text-xs text-gray-500">Enter decimal number or hexadecimal with 0x prefix.</p>
                        </div>
                      {/if}

                      <button
                        class="w-full bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
                        on:click={executeEstimateGas}
                      >
                        Estimate Gas
                      </button>
                    </div>
                  {/if}

                  {#if type === 'eth_call'}
                    <div class="space-y-4 mb-4">
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1" for="call-to">
                          To Address <span class="text-red-600">*</span>
                        </label>
                        <input
                          type="text"
                          id="call-to"
                          bind:value={callParams.to}
                          placeholder="0x..."
                          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                        <p class="mt-1 text-xs text-gray-500">The address of the contract to call.</p>
                      </div>

                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1" for="call-data">
                          Data
                        </label>
                        <input
                          type="text"
                          id="call-data"
                          bind:value={callParams.data}
                          placeholder="0x..."
                          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                        <p class="mt-1 text-xs text-gray-500">The encoded function call data (hex format).</p>
                      </div>

                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1" for="call-value">
                          Value
                        </label>
                        <input
                          type="text"
                          id="call-value"
                          bind:value={callParams.value}
                          placeholder="0x0"
                          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                        <p class="mt-1 text-xs text-gray-500">The value in wei to send with the call (hex format).</p>
                      </div>

                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1" for="call-block">
                          Block Parameter
                        </label>
                        <select
                          id="call-block"
                          bind:value={callParams.blockNumber}
                          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                        >
                          <option value="latest">latest</option>
                          <option value="earliest">earliest</option>
                          <option value="pending">pending</option>
                          <option value="safe">safe</option>
                          <option value="finalized">finalized</option>
                        </select>
                        <p class="mt-1 text-xs text-gray-500">The block to execute the call against.</p>
                      </div>

                      <button
                        class="w-full bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
                        on:click={executeCall}
                      >
                        Execute Call
                      </button>
                    </div>
                  {/if}

                  {#if type === 'eth_getBlockByHash'}
                    <div class="space-y-4 mb-4">
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1" for="block-hash">
                          Block Hash <span class="text-red-600">*</span>
                        </label>
                        <input
                          type="text"
                          id="block-hash"
                          bind:value={blockByHashParams.blockHash}
                          placeholder="0x..."
                          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                      </div>

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

                      <button
                        class="w-full bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
                        on:click={executeGetBlockByHash}
                      >
                        Get Block
                      </button>
                    </div>
                  {/if}

                  {#if type === 'eth_getBlockByNumber'}
                    <div class="space-y-4 mb-4">
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1" for="block-number-param">
                          Block Parameter
                        </label>
                        <select
                          id="block-number-param"
                          bind:value={blockByNumberParams.blockNumber}
                          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                        >
                          <option value="latest">latest</option>
                          <option value="earliest">earliest</option>
                          <option value="pending">pending</option>
                          <option value="safe">safe</option>
                          <option value="finalized">finalized</option>
                          <option value="number">Block Number</option>
                        </select>
                      </div>

                      {#if blockByNumberParams.blockNumber === 'number'}
                        <div>
                          <label class="block text-sm font-medium text-gray-700 mb-1" for="custom-block-number">
                            Block Number <span class="text-red-600">*</span>
                          </label>
                          <input
                            type="text"
                            id="custom-block-number"
                            bind:value={blockByNumberParams.customBlockNumber}
                            placeholder="123 or 0x7b"
                            class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          />
                          <p class="mt-1 text-xs text-gray-500">Enter decimal number or hexadecimal with 0x prefix.</p>
                        </div>
                      {/if}

                      <div class="flex items-center">
                        <input
                          type="checkbox"
                          id="include-transactions-by-number"
                          bind:checked={blockByNumberParams.includeTransactions}
                          class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        />
                        <label class="ml-2 block text-sm text-gray-900" for="include-transactions-by-number">
                          Include Full Transactions
                        </label>
                      </div>

                      <button
                        class="w-full bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
                        on:click={executeGetBlockByNumber}
                      >
                        Get Block
                      </button>
                    </div>
                  {/if}

                  {#if type === 'eth_getTransactionByHash'}
                    <div class="space-y-4 mb-4">
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1" for="transaction-hash">
                          Transaction Hash <span class="text-red-600">*</span>
                        </label>
                        <input
                          type="text"
                          id="transaction-hash"
                          bind:value={transactionByHashParams.hash}
                          placeholder="0x..."
                          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                      </div>

                      <button
                        class="w-full bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
                        on:click={executeGetTransactionByHash}
                      >
                        Get Transaction
                      </button>
                    </div>
                  {/if}

                  {#if type === 'eth_getTransactionReceipt'}
                    <div class="space-y-4 mb-4">
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1" for="receipt-transaction-hash">
                          Transaction Hash <span class="text-red-600">*</span>
                        </label>
                        <input
                          type="text"
                          id="receipt-transaction-hash"
                          bind:value={transactionReceiptParams.hash}
                          placeholder="0x..."
                          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                      </div>

                      <button
                        class="w-full bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
                        on:click={executeGetTransactionReceipt}
                      >
                        Get Receipt
                      </button>
                    </div>
                  {/if}

                  {#if type === 'eth_getTransactionCount'}
                    <div class="space-y-4 mb-4">
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1" for="transaction-count-address">
                          Address <span class="text-red-600">*</span>
                        </label>
                        <input
                          type="text"
                          id="transaction-count-address"
                          bind:value={transactionCountParams.address}
                          placeholder={userAddress || '0x...'}
                          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                      </div>

                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1" for="transaction-count-block">
                          Block Parameter
                        </label>
                        <select
                          id="transaction-count-block"
                          bind:value={transactionCountParams.blockNumber}
                          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                        >
                          <option value="latest">latest</option>
                          <option value="earliest">earliest</option>
                          <option value="pending">pending</option>
                          <option value="safe">safe</option>
                          <option value="finalized">finalized</option>
                          <option value="number">Block Number</option>
                        </select>
                      </div>

                      {#if transactionCountParams.blockNumber === 'number'}
                        <div>
                          <label class="block text-sm font-medium text-gray-700 mb-1" for="transaction-count-block-number">
                            Block Number <span class="text-red-600">*</span>
                          </label>
                          <input
                            type="text"
                            id="transaction-count-block-number"
                            bind:value={transactionCountParams.customBlockNumber}
                            placeholder="123 or 0x7b"
                            class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          />
                          <p class="mt-1 text-xs text-gray-500">Enter decimal number or hexadecimal with 0x prefix.</p>
                        </div>
                      {/if}

                      <button
                        class="w-full bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
                        on:click={executeGetTransactionCount}
                      >
                        Get Transaction Count
                      </button>
                    </div>
                  {/if}

                  {#if type === 'eth_getCode'}
                    <div class="space-y-4 mb-4">
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1" for="get-code-address">
                          Contract Address <span class="text-red-600">*</span>
                        </label>
                        <input
                          type="text"
                          id="get-code-address"
                          bind:value={getCodeParams.address}
                          placeholder="0x..."
                          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                        <p class="mt-1 text-xs text-gray-500">The address of the smart contract to get the code from.</p>
                      </div>

                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1" for="get-code-block">
                          Block Parameter
                        </label>
                        <select
                          id="get-code-block"
                          bind:value={getCodeParams.blockNumber}
                          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                        >
                          <option value="latest">latest</option>
                          <option value="earliest">earliest</option>
                          <option value="pending">pending</option>
                          <option value="safe">safe</option>
                          <option value="finalized">finalized</option>
                          <option value="number">Block Number</option>
                        </select>
                        <p class="mt-1 text-xs text-gray-500">The block number to get the code from.</p>
                      </div>

                      {#if getCodeParams.blockNumber === 'number'}
                        <div>
                          <label class="block text-sm font-medium text-gray-700 mb-1" for="get-code-block-number">
                            Block Number <span class="text-red-600">*</span>
                          </label>
                          <input
                            type="text"
                            id="get-code-block-number"
                            bind:value={getCodeParams.customBlockNumber}
                            placeholder="123 or 0x7b"
                            class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          />
                          <p class="mt-1 text-xs text-gray-500">Enter decimal number or hexadecimal with 0x prefix.</p>
                        </div>
                      {/if}

                      <button
                        class="w-full bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
                        on:click={executeGetCode}
                      >
                        Get Contract Code
                      </button>
                    </div>
                  {/if}

                  {#if type === 'eth_signTypedData_v4' && showSignTypedDataForm}
                    <div class="space-y-4 mb-4">
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1" for="sign-typed-data-address">
                          Address <span class="text-red-600">*</span>
                        </label>
                        <input
                          type="text"
                          id="sign-typed-data-address"
                          value={userAddress || ''}
                          disabled
                          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50"
                        />
                      </div>

                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1" for="sign-typed-data-data">
                          Typed Data <span class="text-red-600">*</span>
                        </label>
                        <textarea
                          id="sign-typed-data-data"
                          rows="12"
                          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
                          placeholder="Enter EIP-712 TypedData JSON"
                          value={JSON.stringify(signTypedDataParams.typedData, null, 2)}
                          readonly
                        ></textarea>
                        <p class="mt-1 text-xs text-gray-500">A JSON in either string or object form that conforms to the EIP-712 TypedData JSON schema.</p>
                      </div>

                      <button
                        class="w-full bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
                        on:click={executeSignTypedData}
                      >
                        Sign Message
                      </button>
                    </div>
                  {/if}

                  {#if type === 'personal_sign' && showPersonalSignForm}
                    <div class="space-y-4 mb-4">
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1" for="personal-sign-address">
                          Address <span class="text-red-600">*</span>
                        </label>
                        <input
                          type="text"
                          id="personal-sign-address"
                          bind:value={personalSignParams.fromAddress}
                          placeholder={userAddress || '0x...'}
                          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                        <p class="mt-1 text-xs text-gray-500">The Ethereum address that will sign the message.</p>
                      </div>

                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1" for="personal-sign-message">
                          Message <span class="text-red-600">*</span>
                        </label>
                        <textarea
                          id="personal-sign-message"
                          bind:value={personalSignParams.message}
                          rows="4"
                          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
                          placeholder="Enter message to sign"
                        ></textarea>
                        <p class="mt-1 text-xs text-gray-500">The message to sign. This message will be prefixed with "\x19Ethereum Signed Message:\n" + message.length.</p>
                      </div>

                      <button
                        class="w-full bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
                        on:click={executePersonalSign}
                      >
                        Sign Message
                      </button>
                    </div>
                  {/if}

                  <!-- Result or Error -->
                  {#if result}
                    <div class="mt-6 bg-gray-50 rounded-md p-4">
                      {#if result.error}
                        <h4 class="text-sm font-medium text-red-900 mb-2">Error:</h4>
                        <p class="text-red-600 text-sm">{result.error}</p>
                      {:else}
                        {#if result.request}
                          <div>
                            <h4 class="text-sm font-medium text-gray-900 mb-2">Request Payload:</h4>
                            <pre class="text-xs font-mono bg-white/50 p-2 rounded overflow-x-auto whitespace-pre-wrap break-all">{JSON.stringify(result.request, null, 2)}</pre>
                          </div>
                        {/if}

                        {#if result.response}
                          <div class="mt-4">
                            <h4 class="text-sm font-medium text-gray-900 mb-2">Response Payload:</h4>
                            <pre class="text-xs font-mono bg-white/50 p-2 rounded overflow-x-auto whitespace-pre-wrap break-all">{JSON.stringify(result.response, null, 2)}</pre>
                          </div>
                        {/if}

                        {#if result.decoded}
                          <div class="mt-4">
                            <h4 class="text-sm font-medium text-gray-900 mb-2">Decoded Result:</h4>
                            <pre class="text-xs font-mono bg-white/50 p-2 rounded overflow-x-auto whitespace-pre-wrap break-all">{result.decoded}</pre>
                          </div>
                        {/if}
                      {/if}
                    </div>
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
</style>
