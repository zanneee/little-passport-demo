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
    to: '0xbbb4e3fa3e7efed0834e4eaeb6beeda635d67da2',
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
    includeTransactions: false
  };

  let transactionByHashParams = {
    hash: ''
  };

  let transactionCountParams = {
    address: '',
    blockNumber: 'latest'
  };

  let getCodeParams = {
    address: '',
    blockNumber: 'latest',
    customBlockNumber: ''
  };

  let signTypedDataParams = {
    typedData: {
      domain: {
        name: 'Immutable Passport Demo',
        version: '1',
        chainId: 13473,  // Immutable zkEVM testnet chainId (0x5af)
        verifyingContract: '0x0000000000000000000000000000000000000000'
      },
      message: {
        from: {
          name: 'Alice',
          wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826'
        },
        to: {
          name: 'Bob',
          wallet: ''  // Automatically set to the currently connected wallet address
        },
        contents: 'Hello, Bob! Welcome to Immutable zkEVM.'
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
      isConnected = false;
      userAddress = null;
      tokenState.idToken = null;
      tokenState.accessToken = null;
      tokenState.decodedIdToken = null;
      tokenState.decodedAccessToken = null;
      userInfo = null;
      linkedAddresses = null;
      displayOrder = [];
      signer = null;
      balance = null;
    } catch (error: unknown) {
      console.error('Logout failed:', error);
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

  async function handleRpcCall(method: string) {
    try {
      // 새로운 메서드 호출 시 이전 결과들 초기화
      displayOrder = [];
      result = null;

      switch (method) {
        case 'eth_requestAccounts':
          const requestAccountsPayload = { method: 'eth_requestAccounts' };
          const accounts = await passportProvider.request(requestAccountsPayload);
          result = {
            method: 'eth_requestAccounts',
            description: "This method attempts to authenticate the user and initialises their Passport wallet before returning an array of wallet addresses. If the user does not already have an active session with Passport, then they will be prompted to log in.",
            request: requestAccountsPayload,
            response: accounts,
            formatted: JSON.stringify(accounts, null, 2)
          };
          addToDisplayOrder('eth_requestAccounts');
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
          addToDisplayOrder('eth_accounts');
          break;

        case 'eth_chainId':
          const chainIdPayload = { method: 'eth_chainId' };
          const chainId = await passportProvider.request(chainIdPayload);
          result = {
            method: 'eth_chainId',
            description: "Returns the current chain id.",
            request: chainIdPayload,
            response: chainId,
            formatted: `Chain ID: ${chainId} (Decimal: ${parseInt(chainId, 16)}) - Immutable zkEVM ${currentNetwork === 'testnet' ? 'Testnet' : 'Mainnet'}`
          };
          addToDisplayOrder('eth_chainId');
          break;

        case 'eth_blockNumber':
          const blockNumberPayload = { method: 'eth_blockNumber' };
          const blockNumber = await passportProvider.request(blockNumberPayload);
          result = {
            method: 'eth_blockNumber',
            description: "Returns the number of most recent block.",
            request: blockNumberPayload,
            response: blockNumber,
            formatted: blockNumber
          };
          addToDisplayOrder('eth_blockNumber');
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
          addToDisplayOrder('eth_gasPrice');
          break;

        case 'eth_getBalance':
          // 주소가 비어있으면 현재 로그인된 주소 사용
          if (!balanceParams.address && userAddress) {
            balanceParams.address = userAddress;
          }
          
          result = {
            method: 'eth_getBalance',
            description: "Returns the balance of the account of given address in wei.",
            request: null,
            response: null,
            formatted: null
          };
          addToDisplayOrder('eth_getBalance');
          return;

        case 'eth_getTransactionCount':
          addToDisplayOrder('eth_getTransactionCount');
          
          try {
            const address = transactionCountParams.address || userAddress;
            if (!address) {
              throw new Error('Address is required');
            }
            if (!address.startsWith('0x')) {
              throw new Error('Valid address starting with 0x is required');
            }

            const blockNumber = /^\d+$/.test(transactionCountParams.blockNumber) ? 
              '0x' + Number(transactionCountParams.blockNumber).toString(16) : 
              transactionCountParams.blockNumber;

            const txCountPayload = { 
              method: 'eth_getTransactionCount',
              params: [
                address,
                blockNumber
              ]
            };
            const txCount = await passportProvider.request(txCountPayload);
            const count = parseInt(txCount, 16);
            result = {
              method: 'eth_getTransactionCount',
              description: "Returns the number of transactions sent from an address.",
              request: txCountPayload,
              response: txCount,
              formatted: `Number of transactions sent from ${address}: ${count.toLocaleString()}`
            };
          } catch (error: any) {
            console.error('Error getting transaction count:', error);
            result = {
              error: error.message || 'Failed to get transaction count'
            };
          }
          break;

        case 'eth_getStorageAt':
          // 주소가 비어있으면 현재 로그인된 주소 사용
          if (!storageParams.address && userAddress) {
            storageParams.address = userAddress;
          }

          if (!storageParams.address) {
            throw new Error('Address is required');
          }

          // slot이 비어있으면 기본값 사용
          if (!storageParams.slot) {
            storageParams.slot = '0x0';
          }

          const storageBlockParam = getBlockParameter(storageParams.blockParam, storageParams.customBlockNumber);
          const storagePayload = { 
            method: 'eth_getStorageAt',
            params: [
              storageParams.address,
              storageParams.slot,
              storageBlockParam
            ]
          };
          const storageValue = await passportProvider.request(storagePayload);
          result = {
            method: 'eth_getStorageAt',
            description: "Returns the value from a storage position at a given address.",
            request: storagePayload,
            response: storageValue,
            formatted: `Storage Value: ${storageValue}`
          };
          addToDisplayOrder('eth_getStorageAt');
          break;

        case 'eth_estimateGas':
          if (!displayOrder.includes('eth_estimateGas')) {
            addToDisplayOrder('eth_estimateGas');
            result = {
              method: 'eth_estimateGas',
              description: "Returns an estimate of the gas that would be used in a transaction with the given parameters.",
              request: null,
              response: null,
              formatted: null
            };
            return;
          }
          
          try {
            // 주소가 비어있으면 현재 로그인된 주소 사용
            if (!estimateGasParams.to && userAddress) {
              estimateGasParams.to = userAddress;
            }

            if (!estimateGasParams.to) {
              throw new Error('Destination address (to) is required');
            }

            const estimateBlockParam = getBlockParameter(estimateGasParams.blockParam, estimateGasParams.customBlockNumber);
            const estimateGasPayload = {
              method: 'eth_estimateGas',
              params: [
                {
                  to: estimateGasParams.to,
                  data: estimateGasParams.data || '0x',
                  value: estimateGasParams.value || '0x0'
                },
                estimateBlockParam
              ]
            };
            const estimatedGas = await passportProvider.request(estimateGasPayload);
            result = {
              method: 'eth_estimateGas',
              description: "Returns an estimate of the gas that would be used in a transaction with the given parameters.",
              request: estimateGasPayload,
              response: estimatedGas,
              formatted: `Estimated Gas: ${parseInt(estimatedGas, 16).toLocaleString()} units`
            };
          } catch (error: any) {
            result = {
              method: 'eth_estimateGas',
              description: "Returns an estimate of the gas that would be used in a transaction with the given parameters.",
              error: error.message || 'Failed to estimate gas'
            };
          }
          break;

        case 'eth_call':
          if (!displayOrder.includes('eth_call')) {
            addToDisplayOrder('eth_call');
            result = {
              method: 'eth_call',
              description: "Executes a new message call immediately without creating a transaction on the blockchain.",
              request: null,
              response: null,
              formatted: null
            };
            return;
          }

          try {
            // 주소가 비어있으면 현재 로그인된 주소 사용
            if (!callParams.to && userAddress) {
              callParams.to = userAddress;
            }

            if (!callParams.to) {
              throw new Error('Destination address (to) is required');
            }

            const callPayload = {
              method: 'eth_call',
              params: [
                {
                  to: callParams.to,
                  data: callParams.data || '0x',
                  value: callParams.value || '0x0'
                },
                callParams.blockNumber
              ]
            };
            const callResult = await passportProvider.request(callPayload);
            result = {
              method: 'eth_call',
              description: "Executes a new message call immediately without creating a transaction on the blockchain.",
              request: callPayload,
              response: callResult,
              formatted: `Return Value: ${callResult}`
            };
          } catch (error: any) {
            result = {
              method: 'eth_call',
              description: "Executes a new message call immediately without creating a transaction on the blockchain.",
              error: error.message || 'Failed to execute call'
            };
          }
          break;

        case 'eth_getBlockByHash':
          if (!showBlockByHashForm) {
            showBlockByHashForm = true;
            result = {
              method: 'eth_getBlockByHash',
              description: "Returns information about a block by hash.",
              request: null,
              response: null,
              formatted: null
            };
            addToDisplayOrder('eth_getBlockByHash');
            return;
          }

          try {
            if (!blockByHashParams.blockHash || !blockByHashParams.blockHash.startsWith('0x')) {
              throw new Error('Valid block hash starting with 0x is required');
            }

            const blockByHashPayload = {
              method: 'eth_getBlockByHash',
              params: [
                blockByHashParams.blockHash,
                blockByHashParams.includeTransactions
              ]
            };

            console.log('Request with includeTransactions:', blockByHashParams.includeTransactions);
            const blockByHash = await passportProvider.request(blockByHashPayload);
            console.log('Response data:', JSON.stringify(blockByHash, null, 2));
            
            if (!blockByHash) {
              throw new Error('Block not found');
            }

            const formattedBlockByHash = {
              number: blockByHash.number ? parseInt(blockByHash.number, 16).toString() : 'N/A',
              hash: blockByHash.hash || 'N/A',
              parentHash: blockByHash.parentHash || 'N/A',
              timestamp: blockByHash.timestamp ? 
                new Date(parseInt(blockByHash.timestamp, 16) * 1000).toLocaleString() : 
                'N/A',
              transactions: formatTransactions(blockByHash.transactions),
              gasUsed: blockByHash.gasUsed ? parseInt(blockByHash.gasUsed, 16).toLocaleString() : 'N/A',
              gasLimit: blockByHash.gasLimit ? parseInt(blockByHash.gasLimit, 16).toLocaleString() : 'N/A',
              miner: blockByHash.miner || 'N/A',
              size: blockByHash.size ? parseInt(blockByHash.size, 16).toLocaleString() : 'N/A'
            };

            result = {
              request: blockByHashPayload,
              response: blockByHash,
              formatted: `Block #${formattedBlockByHash.number}\n` +
                `Hash: ${formattedBlockByHash.hash}\n` +
                `Parent Hash: ${formattedBlockByHash.parentHash}\n` +
                `Timestamp: ${formattedBlockByHash.timestamp}\n` +
                `Gas Used: ${formattedBlockByHash.gasUsed}\n` +
                `Gas Limit: ${formattedBlockByHash.gasLimit}\n` +
                `Miner: ${formattedBlockByHash.miner}\n` +
                `Size: ${formattedBlockByHash.size} bytes\n\n` +
                `Transactions:\n${formattedBlockByHash.transactions}`,
              note: 'Note: This result is based on the block information at the time of the request. The actual block content may change after the request.'
            };
          } catch (error: any) {
            console.error('Error getting block by hash:', error);
            result = {
              error: error.message || 'Failed to get block'
            };
          }
          addToDisplayOrder('eth_getBlockByHash');
          break;

        case 'eth_getBlockByNumber':
          try {
            const blockNumberParam = blockByNumberParams.blockNumber === 'latest' ? 
              'latest' : 
              (blockByNumberParams.blockNumber.startsWith('0x') ? 
                blockByNumberParams.blockNumber : 
                '0x' + parseInt(blockByNumberParams.blockNumber).toString(16));

            const blockNumberPayload = {
              method: 'eth_getBlockByNumber',
              params: [
                blockNumberParam,
                blockByNumberParams.includeTransactions
              ]
            };

            const blockByNumber = await passportProvider.request(blockNumberPayload);
            
            if (!blockByNumber) {
              throw new Error('Block not found');
            }

            const formattedBlockByNumber = {
              number: blockByNumber.number ? parseInt(blockByNumber.number, 16).toString() : 'N/A',
              hash: blockByNumber.hash || 'N/A',
              parentHash: blockByNumber.parentHash || 'N/A',
              timestamp: blockByNumber.timestamp ? 
                new Date(parseInt(blockByNumber.timestamp, 16) * 1000).toLocaleString() : 
                'N/A',
              transactions: formatTransactions(blockByNumber.transactions),
              gasUsed: blockByNumber.gasUsed ? parseInt(blockByNumber.gasUsed, 16).toLocaleString() : 'N/A',
              gasLimit: blockByNumber.gasLimit ? parseInt(blockByNumber.gasLimit, 16).toLocaleString() : 'N/A',
              miner: blockByNumber.miner || 'N/A',
              size: blockByNumber.size ? parseInt(blockByNumber.size, 16).toLocaleString() : 'N/A'
            };

            result = {
              method: 'eth_getBlockByNumber',
              description: "Returns information about a block by number.",
              request: blockNumberPayload,
              response: blockByNumber,
              formatted: `Block #${formattedBlockByNumber.number}\n` +
                `Hash: ${formattedBlockByNumber.hash}\n` +
                `Parent Hash: ${formattedBlockByNumber.parentHash}\n` +
                `Timestamp: ${formattedBlockByNumber.timestamp}\n` +
                `Gas Used: ${formattedBlockByNumber.gasUsed}\n` +
                `Gas Limit: ${formattedBlockByNumber.gasLimit}\n` +
                `Miner: ${formattedBlockByNumber.miner}\n` +
                `Size: ${formattedBlockByNumber.size} bytes\n\n` +
                `Transactions:\n${formattedBlockByNumber.transactions}`,
              note: 'Note: This result is based on the block information at the time of the request. The actual block content may change after the request.'
            };
          } catch (error: any) {
            console.error('Error getting block:', error);
            result = {
              error: error.message || 'Failed to get block'
            };
          }
          addToDisplayOrder('eth_getBlockByNumber');
          break;

        case 'eth_getTransactionByHash':
          if (!showTransactionByHashForm) {
            showTransactionByHashForm = true;
            result = {
              method: 'eth_getTransactionByHash',
              description: "Returns the information about a transaction requested by transaction hash.",
              request: null,
              response: null,
              formatted: null
            };
            addToDisplayOrder('eth_getTransactionByHash');
            return;
          }

          if (!transactionByHashParams.hash) {
            return;
          }

          try {
            if (!transactionByHashParams.hash.startsWith('0x')) {
              throw new Error('Valid transaction hash starting with 0x is required');
            }

            const txHashPayload = { 
              method: 'eth_getTransactionByHash',
              params: [transactionByHashParams.hash]
            };

            console.log('Requesting transaction:', txHashPayload);
            const txByHash = await passportProvider.request(txHashPayload);
            console.log('Transaction response:', txByHash);

            if (!txByHash) {
              throw new Error('Transaction not found');
            }

            // Format the transaction data
            const formattedTx = {
              hash: txByHash.hash,
              blockHash: txByHash.blockHash,
              blockNumber: txByHash.blockNumber ? parseInt(txByHash.blockNumber, 16).toLocaleString() : 'N/A',
              from: txByHash.from,
              to: txByHash.to || 'Contract Creation',
              value: txByHash.value ? `${BigInt(txByHash.value) / BigInt(1e18)} IMX` : '0 IMX',
              gasPrice: txByHash.gasPrice ? `${BigInt(txByHash.gasPrice) / BigInt(1e9)} Gwei` : 'N/A',
              gas: txByHash.gas ? parseInt(txByHash.gas, 16).toLocaleString() : 'N/A',
              nonce: txByHash.nonce ? parseInt(txByHash.nonce, 16).toString() : 'N/A',
              transactionIndex: txByHash.transactionIndex ? 
                parseInt(txByHash.transactionIndex, 16).toString() : 'N/A',
              input: txByHash.input
            };

            result = {
              request: txHashPayload,
              response: txByHash,
              formatted: `Transaction Details:\n` +
                `Hash: ${formattedTx.hash}\n` +
                `Block: #${formattedTx.blockNumber} (${formattedTx.blockHash})\n` +
                `From: ${formattedTx.from}\n` +
                `To: ${formattedTx.to}\n` +
                `Value: ${formattedTx.value}\n` +
                `Gas Limit: ${formattedTx.gas}\n` +
                `Gas Price: ${formattedTx.gasPrice}\n` +
                `Nonce: ${formattedTx.nonce}\n` +
                `Transaction Index: ${formattedTx.transactionIndex}\n` +
                `Input Data: ${formattedTx.input}`,
              note: 'Note: This result is based on the transaction information at the time of the request. The actual transaction content may change after the request.'
            };
          } catch (error: any) {
            console.error('Error getting transaction:', error);
            result = {
              error: error.message || 'Failed to get transaction'
            };
          }
          addToDisplayOrder('eth_getTransactionByHash');
          break;

        case 'eth_getTransactionReceipt':
          // 먼저 UI를 표시하기 위해 displayOrder 업데이트
          addToDisplayOrder('eth_getTransactionReceipt');
          
          // 해시가 없으면 API 호출하지 않고 리턴
          if (!transactionState.hash) {
            result = null;
            return;
          }

          try {
            if (!transactionState.hash.startsWith('0x')) {
              throw new Error('Valid transaction hash starting with 0x is required');
            }

            const txReceiptPayload = { 
              method: 'eth_getTransactionReceipt',
              params: [transactionState.hash]
            };
            const txReceipt = await passportProvider.request(txReceiptPayload);
            
            if (!txReceipt) {
              throw new Error('Transaction receipt not found');
            }

            result = {
              method: 'eth_getTransactionReceipt',
              description: "Returns the receipt of a transaction requested by transaction hash.",
              request: txReceiptPayload,
              response: txReceipt,
              formatted: `Transaction Receipt:\n` +
                `Status: ${txReceipt.status === '0x1' ? 'Success' : 'Failed'}\n` +
                `Block Number: ${parseInt(txReceipt.blockNumber, 16)}\n` +
                `Gas Used: ${parseInt(txReceipt.gasUsed, 16).toLocaleString()}\n` +
                `Block Hash: ${txReceipt.blockHash}\n` +
                `Transaction Index: ${parseInt(txReceipt.transactionIndex, 16)}\n` +
                `Contract Address: ${txReceipt.contractAddress || 'N/A'}\n` +
                `Logs: ${txReceipt.logs.length} events`,
              note: 'Note: This result is based on the transaction receipt information at the time of the request. The actual receipt content may change after the request.'
            };
          } catch (error: any) {
            console.error('Error getting transaction receipt:', error);
            result = {
              error: error.message || 'Failed to get transaction receipt'
            };
          }
          break;

        case 'eth_getCode':
          addToDisplayOrder('eth_getCode');
          
          if (!getCodeParams.address) {
            result = null;
            return;
          }

          try {
            if (!getCodeParams.address.startsWith('0x')) {
              throw new Error('Valid address starting with 0x is required');
            }

            // 블록 넘버 처리
            let blockNumber = getCodeParams.blockNumber;
            if (blockNumber === 'number') {
              if (!getCodeParams.customBlockNumber) {
                throw new Error('Block number is required when "Block number" is selected');
              }
              // 16진수 또는 10진수 입력 처리
              if (getCodeParams.customBlockNumber.startsWith('0x')) {
                blockNumber = getCodeParams.customBlockNumber;
              } else if (/^\d+$/.test(getCodeParams.customBlockNumber)) {
                blockNumber = '0x' + Number(getCodeParams.customBlockNumber).toString(16);
              } else {
                throw new Error('Invalid block number format. Use decimal or hex (0x) format');
              }
            }

            const codePayload = { 
              method: 'eth_getCode',
              params: [
                getCodeParams.address,
                blockNumber
              ]
            };
            const contractCode = await passportProvider.request(codePayload);
            
            // 바이트코드 길이 계산 (0x 제외)
            const byteLength = contractCode === '0x' ? 0 : (contractCode.length - 2) / 2;
            
            result = {
              method: 'eth_getCode',
              description: "Returns the bytecode of a smart contract at a given address.",
              request: codePayload,
              response: contractCode,
              formatted: contractCode === '0x' 
                ? `Contract Bytecode at ${getCodeParams.address}:\n(Not a contract)`
                : `Contract Bytecode at ${getCodeParams.address}:\n` +
                  `Bytecode Length: ${byteLength} bytes\n` +
                  `Solidity Version: ${getSolidityVersion(contractCode)}\n` +
                  `Bytecode:\n${contractCode.slice(0, 100)}...\n` +
                  `(Full bytecode available in Response Payload)`,
              note: 'Note: This result is based on the contract code information at the time of the request. The actual code content may change after the request.'
            };
          } catch (error: any) {
            console.error('Error getting contract code:', error);
            result = {
              error: error.message || 'Failed to get contract code'
            };
          }
          break;

        case 'eth_signTypedData_v4':
          if (!showSignTypedDataForm) {
            showSignTypedDataForm = true;
            result = {
              method: 'eth_signTypedData_v4',
              description: "Enables passport users to sign EIP-712 structured messages off-chain.",
              request: null,
              response: null,
              formatted: null
            };
            addToDisplayOrder('eth_signTypedData_v4');
            return;
          }

          try {
            if (!userAddress) {
              throw new Error('Please connect your wallet first');
            }

            // Update the from wallet address with the connected wallet
            signTypedDataParams.typedData.message.from.wallet = userAddress;

            const signTypedDataPayload = { 
              method: 'eth_signTypedData_v4',
              params: [
                userAddress,
                JSON.stringify(signTypedDataParams.typedData)
              ]
            };

            const signedData = await passportProvider.request(signTypedDataPayload);
            
            // 서명 데이터 분석
            const signature = signedData.slice(2); // 0x 제거
            const r = '0x' + signature.slice(0, 64);
            const s = '0x' + signature.slice(64, 128);
            const v = '0x' + signature.slice(128, 130);

            result = {
              request: {
                ...signTypedDataPayload,
                params: [signTypedDataPayload.params[0], JSON.parse(signTypedDataPayload.params[1])]
              },
              response: signedData,
              formatted: `Signature Details:\n` +
                `\nSigner: ${userAddress}\n` +
                `\nTyped Data:\n` +
                `• Domain:\n` +
                `  - Name: ${signTypedDataParams.typedData.domain.name}\n` +
                `  - Version: ${signTypedDataParams.typedData.domain.version}\n` +
                `  - Chain ID: ${signTypedDataParams.typedData.domain.chainId}\n` +
                `  - Verifying Contract: ${signTypedDataParams.typedData.domain.verifyingContract}\n` +
                `\n• Message:\n` +
                `  - From: ${signTypedDataParams.typedData.message.from.name} (${signTypedDataParams.typedData.message.from.wallet})\n` +
                `  - To: ${signTypedDataParams.typedData.message.to.name} (${signTypedDataParams.typedData.message.to.wallet})\n` +
                `  - Contents: ${signTypedDataParams.typedData.message.contents}\n` +
                `\nSignature Components:\n` +
                `• Full Signature: ${signedData}\n` +
                `• R: ${r}\n` +
                `• S: ${s}\n` +
                `• V: ${v}\n` +
                `\nVerification:\n` +
                `• Primary Type: ${signTypedDataParams.typedData.primaryType}\n` +
                `• Types Hash: Mail(Person from,Person to,string contents)\n` +
                `• Person Type: Person(string name,address wallet)\n` +
                `\nNote: This signature can be verified on-chain using EIP-712 verification methods.`,
              note: 'Note: This result is based on the signature information at the time of the request. The actual signature content may change after the request.'
            };
          } catch (error: any) {
            console.error('Error signing typed data:', error);
            result = {
              error: error.message || 'Failed to sign typed data'
            };
          }
          break;

        case 'personal_sign':
          if (!showPersonalSignForm) {
            showPersonalSignForm = true;
            personalSignParams.fromAddress = userAddress || '';  // Initialize with current connected address
            result = {
              method: 'personal_sign',
              description: "Enables passport users to sign ERC-191 personal messages off-chain.",
              request: null,
              response: null,
              formatted: null
            };
            addToDisplayOrder('personal_sign');
            return;
          }

          try {
            if (!personalSignParams.fromAddress) {
              throw new Error('Please enter the signer address');
            }

            if (!personalSignParams.fromAddress.startsWith('0x')) {
              throw new Error('Invalid address format. Address must start with 0x');
            }

            const messageToSign = personalSignParams.message;
            const signPayload = { 
              method: 'personal_sign',
              params: [messageToSign, personalSignParams.fromAddress]  // Update order: [message, address]
            };

            const signedMessage = await passportProvider.request(signPayload);
            
            // 서명 데이터 분석
            const signature = signedMessage.slice(2);
            const r = '0x' + signature.slice(0, 64);
            const s = '0x' + signature.slice(64, 128);
            const v = '0x' + signature.slice(128, 130);

            const prefix = '\x19Ethereum Signed Message:\n' + messageToSign.length;
            const prefixedMessage = prefix + messageToSign;

            result = {
              request: signPayload,
              response: signedMessage,
              formatted: `Signature Details:\n` +
                `\nSigner: ${personalSignParams.fromAddress}\n` +
                `\nMessage Details:\n` +
                `• Original Message: ${messageToSign}\n` +
                `• Message Length: ${messageToSign.length} characters\n` +
                `• Prefixed Message: ${prefixedMessage}\n` +
                `\nSignature Components:\n` +
                `• Full Signature: ${signedMessage}\n` +
                `• R: ${r}\n` +
                `• S: ${s}\n` +
                `• V: ${v}\n` +
                `\nNote: This signature follows ERC-191 personal_sign standard.`,
              note: 'Note: This result is based on the signature information at the time of the request. The actual signature content may change after the request.'
            };
          } catch (error: any) {
            console.error('Error signing message:', error);
            result = {
              error: error.message || 'Failed to sign message'
            };
          }
          break;

        case 'eth_sendTransaction':
          if (!isConnected) {
            await handleLogin();
          }
          showTransactionForm = true;
          result = {
            method: 'eth_sendTransaction',
            description: "Creates new message call transaction or a contract creation, if the data field contains code.",
            request: null,
            response: null,
            formatted: null
          };
          transactionParams = {
            to: '',
            value: '',
            data: '',
            gasLimit: '',
            maxFeePerGas: '',
            maxPriorityFeePerGas: ''
          };
          addToDisplayOrder('eth_sendTransaction');
          return;
      }
    } catch (error: any) {
      console.error(`RPC call failed (${method}):`, error);
      result = {
        method,
        error: error.message || 'Unknown error occurred'
      };
      addToDisplayOrder(method.replace('eth_', ''));
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
        data: transactionParams.data || '0x',
        gasLimit: transactionParams.gasLimit ? BigInt(transactionParams.gasLimit) : undefined,
        maxFeePerGas: transactionParams.maxFeePerGas ? ethers.parseUnits(transactionParams.maxFeePerGas, 'gwei') : undefined,
        maxPriorityFeePerGas: transactionParams.maxPriorityFeePerGas ? ethers.parseUnits(transactionParams.maxPriorityFeePerGas, 'gwei') : undefined,
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
      
      const gasPrice = (receipt as any).effectiveGasPrice || (receipt as any).gasPrice || 0n;
      const gasFee = receipt.gasUsed * BigInt(gasPrice);
      const gasPriceInGwei = Number(gasPrice) / 1_000_000_000;
      const maxFeePerGasInGwei = tx.maxFeePerGas ? Number(tx.maxFeePerGas) / 1_000_000_000 : undefined;
      const maxPriorityFeePerGasInGwei = tx.maxPriorityFeePerGas ? Number(tx.maxPriorityFeePerGas) / 1_000_000_000 : undefined;
      
      const details = {
        hash: transactionResponse.hash,
        blockNumber: receipt.blockNumber,
        value: `${ethers.formatEther(tx.value || '0')} tIMX`,
        transactionFee: `${ethers.formatEther(gasFee)} tIMX`,
        gasPrice: `${ethers.formatEther(gasPrice)} tIMX (${gasPriceInGwei.toFixed(9)} Gwei)`,
        gasUsage: `${receipt.gasUsed} | ${tx.gasLimit || receipt.gasUsed} = ${((Number(receipt.gasUsed) / Number(tx.gasLimit || receipt.gasUsed)) * 100).toFixed(2)}%`,
        gasFees: `Base: ${gasPriceInGwei.toFixed(9)} Gwei | Max: ${maxFeePerGasInGwei?.toFixed(9) || gasPriceInGwei.toFixed(9)} Gwei | Max priority: ${maxPriorityFeePerGasInGwei?.toFixed(0) || gasPriceInGwei.toFixed(0)} Gwei`,
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
                Estimate Gas
              </button>
              <button
                class="w-full text-left px-4 py-2 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
                on:click={() => handleRpcCall('eth_call')}
              >
                Call
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

                  <!-- Form Content -->
                  {#if type === 'estimateGas'}
                    <div class="space-y-4">
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1" for="estimate-to">
                          To Address <span class="text-red-600">*</span>
                        </label>
                        <input
                          type="text"
                          id="estimate-to"
                          bind:value={estimateGasParams.to}
                          placeholder={userAddress || '0x...'}
                          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                        <p class="mt-1 text-xs text-gray-500">The destination address of the message. Defaults to connected address if empty.</p>
                      </div>

                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1" for="estimate-data">
                          Data
                        </label>
                        <input
                          type="text"
                          id="estimate-data"
                          bind:value={estimateGasParams.data}
                          placeholder="0x"
                          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                        <p class="mt-1 text-xs text-gray-500">The byte string containing the associated data of the message, or contract initialization code (optional).</p>
                      </div>

                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1" for="estimate-value">
                          Value
                        </label>
                        <input
                          type="text"
                          id="estimate-value"
                          bind:value={estimateGasParams.value}
                          placeholder="0x0"
                          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                        <p class="mt-1 text-xs text-gray-500">The value transferred for the transaction in wei, encoded as a hex string (optional).</p>
                      </div>

                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1" for="estimate-block-param">
                          Block Parameter
                        </label>
                        <select
                          id="estimate-block-param"
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
                        <p class="mt-1 text-xs text-gray-500">The block number to get the gas estimate at. If omitted, the latest block is used.</p>
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
                          <p class="mt-1 text-xs text-gray-500">Enter decimal number or hexadecimal with 0x prefix</p>
                        </div>
                      {/if}

                      <button
                        class="w-full bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
                        on:click={() => handleRpcCall('eth_estimateGas')}
                      >
                        Estimate Gas
                      </button>
                    </div>
                  {/if}

                  {#if type === 'call'}
                    <div class="space-y-4">
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1" for="call-to">
                          To Address <span class="text-red-600">*</span>
                        </label>
                        <input
                          type="text"
                          id="call-to"
                          bind:value={callParams.to}
                          placeholder={userAddress || '0x...'}
                          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                        <p class="mt-1 text-xs text-gray-500">The address to execute the call on. Defaults to connected address if empty.</p>
                      </div>

                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1" for="call-data">
                          Data
                        </label>
                        <input
                          type="text"
                          id="call-data"
                          bind:value={callParams.data}
                          placeholder="0x"
                          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                        <p class="mt-1 text-xs text-gray-500">The data to be executed in the call (e.g. encoded function call).</p>
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
                        <p class="mt-1 text-xs text-gray-500">The value to be sent with the call in wei, encoded as a hex string (optional).</p>
                      </div>

                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1" for="call-block-number">
                          Block Number
                        </label>
                        <select
                          id="call-block-number"
                          bind:value={callParams.blockNumber}
                          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                        >
                          <option value="latest">latest</option>
                          <option value="earliest">earliest</option>
                          <option value="pending">pending</option>
                          <option value="safe">safe</option>
                          <option value="finalized">finalized</option>
                        </select>
                        <p class="mt-1 text-xs text-gray-500">The block number to execute the call at. If omitted, the latest block is used.</p>
                      </div>

                      <button
                        class="w-full bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
                        on:click={() => handleRpcCall('eth_call')}
                      >
                        Execute Call
                      </button>
                    </div>
                  {/if}

                  {#if type === 'getBalance'}
                    <div class="space-y-4">
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
                        on:click={() => handleRpcCall('eth_getBalance')}
                      >
                        Get Balance
                      </button>
                    </div>
                  {/if}

                  <!-- Result or Error -->
                  {#if result}
                    <div class="mt-6 bg-gray-50 rounded-md p-4">
                      {#if result.error}
                        <h4 class="text-sm font-medium text-red-900 mb-2">Error:</h4>
                        <p class="text-red-600 text-sm">{result.error}</p>
                      {:else if result.request}
                        <div>
                          <h4 class="text-sm font-medium text-gray-900 mb-2">Request Payload:</h4>
                          <pre class="text-xs font-mono bg-white/50 p-2 rounded overflow-x-auto whitespace-pre-wrap break-all">{JSON.stringify(result.request, null, 2)}</pre>
                        </div>

                        <div class="mt-4">
                          <h4 class="text-sm font-medium text-gray-900 mb-2">Response Payload:</h4>
                          <pre class="text-xs font-mono bg-white/50 p-2 rounded overflow-x-auto whitespace-pre-wrap break-all">{JSON.stringify(result.response, null, 2)}</pre>
                        </div>

                        <div class="mt-4">
                          <h4 class="text-sm font-medium text-gray-900 mb-2">Formatted Result:</h4>
                          <pre class="text-xs font-mono bg-white/50 p-2 rounded overflow-x-auto whitespace-pre-wrap break-all">{result.formatted}</pre>
                        </div>
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
