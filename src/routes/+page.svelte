<script lang="ts">
  import { passport, config } from '@imtbl/sdk';
  import { onMount } from 'svelte';
  import { jwtDecode } from 'jwt-decode';
  import { BrowserProvider, Contract, ethers } from 'ethers';
  import type { Eip1193Provider } from 'ethers';
  import '../styles/app.css';

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
    value: '1000000000000000000'  // 1 IMX 
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

  let transactionParams: {
    to: string;
    value: string;
    data: string;
    gasLimit?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
  } = {
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
    blockNumber: 'latest'
  };

  let estimateGasParams = {
    to: '',
    data: '0x',
    value: '0x0',
    blockNumber: 'latest'
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

  let showPersonalSignForm = false;

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
    // Clear previous results and show only the current one
    displayOrder = [type];
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

  async function handleRpcCall(method: string) {
    try {
      switch (method) {
        case 'eth_sendTransaction':
          await sendTransaction();
          break;
        case 'eth_requestAccounts':
          const requestAccountsPayload = { method: 'eth_requestAccounts' };
          const accounts = await passportProvider.request(requestAccountsPayload);
          result = {
            request: requestAccountsPayload,
            response: accounts,
            formatted: JSON.stringify(accounts, null, 2)
          };
          addToDisplayOrder('requestAccounts');
          break;
        case 'eth_accounts':
          const accountsPayload = { method: 'eth_accounts' };
          const accountsList = await passportProvider.request(accountsPayload);
          result = {
            request: accountsPayload,
            response: accountsList,
            title: 'Passport Accounts',
            description: 'List of authorized Passport wallet addresses',
            accounts: accountsList
          };
          addToDisplayOrder('accounts');
          break;
        case 'eth_chainId':
          const chainIdPayload = { method: 'eth_chainId' };
          const chainId = await passportProvider.request(chainIdPayload);
          result = {
            request: chainIdPayload,
            response: chainId,
            formatted: `Chain ID: ${chainId} (Decimal: ${parseInt(chainId, 16)}) - Immutable zkEVM Testnet`
          };
          addToDisplayOrder('chainId');
          break;
        case 'eth_blockNumber':
          const blockNumberPayload = { method: 'eth_blockNumber' };
          const blockNumber = await passportProvider.request(blockNumberPayload);
          result = {
            request: blockNumberPayload,
            response: blockNumber,
            formatted: blockNumber
          };
          addToDisplayOrder('blockNumber');
          break;
        case 'eth_gasPrice':
          const gasPricePayload = { method: 'eth_gasPrice' };
          const gasPrice = await passportProvider.request(gasPricePayload);
          result = {
            request: gasPricePayload,
            response: gasPrice,
            formatted: `${(Number(gasPrice) / 1_000_000_000).toFixed(9)} Gwei`
          };
          addToDisplayOrder('gasPrice');
          break;
        case 'eth_getBalance':
          if (!userAddress) return;
          const requestPayload = { 
            method: 'eth_getBalance',
            params: [userAddress, 'latest']
          };
          const balance = await passportProvider.request(requestPayload);
          const balanceInEther = ethers.formatEther(balance);
          result = {
            request: requestPayload,
            response: balance,
            formatted: `${balanceInEther} tIMX (${balance} Wei)`
          };
          addToDisplayOrder('balance');
          break;
        case 'eth_getTransactionCount':
          addToDisplayOrder('transactionCount');
          
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
          const storagePayload = { 
            method: 'eth_getStorageAt',
            params: [
              storageParams.address || userAddress,
              storageParams.slot,
              storageParams.blockNumber
            ]
          };
          const storageValue = await passportProvider.request(storagePayload);
          result = {
            request: storagePayload,
            response: storageValue,
            formatted: `Storage Value: ${storageValue}`
          };
          addToDisplayOrder('storage');
          break;
        case 'eth_estimateGas':
          const estimateGasPayload = {
            method: 'eth_estimateGas',
            params: [
              {
                to: estimateGasParams.to || userAddress,
                data: estimateGasParams.data,
                value: estimateGasParams.value
              },
              estimateGasParams.blockNumber
            ]
          };
          const estimatedGas = await passportProvider.request(estimateGasPayload);
          result = {
            request: estimateGasPayload,
            response: estimatedGas,
            formatted: `Estimated Gas: ${parseInt(estimatedGas, 16).toLocaleString()} units`
          };
          addToDisplayOrder('estimateGas');
          break;
        case 'eth_call':
          const callPayload = {
            method: 'eth_call',
            params: [
              {
                to: callParams.to || userAddress,
                data: callParams.data,
                value: callParams.value
              },
              callParams.blockNumber
            ]
          };
          const callResult = await passportProvider.request(callPayload);
          result = {
            request: callPayload,
            response: callResult,
            formatted: `Return Value: ${callResult}`
          };
          addToDisplayOrder('call');
          break;
        case 'eth_getBlockByHash':
          if (!showBlockByHashForm) {
            showBlockByHashForm = true;
            result = null;
            addToDisplayOrder('blockByHash');
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
                `Transactions:\n${formattedBlockByHash.transactions}`
            };
          } catch (error: any) {
            console.error('Error getting block by hash:', error);
            result = {
              error: error.message || 'Failed to get block'
            };
          }
          addToDisplayOrder('blockByHash');
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
                `Transactions:\n${formattedBlockByNumber.transactions}`
            };
          } catch (error: any) {
            console.error('Error getting block:', error);
            result = {
              error: error.message || 'Failed to get block'
            };
          }
          addToDisplayOrder('blockByNumber');
          break;
        case 'eth_getTransactionByHash':
          if (!showTransactionByHashForm) {
            showTransactionByHashForm = true;
            result = null;
            addToDisplayOrder('transactionByHash');
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
                `Input Data: ${formattedTx.input}`
            };
          } catch (error: any) {
            console.error('Error getting transaction:', error);
            result = {
              error: error.message || 'Failed to get transaction'
            };
          }
          addToDisplayOrder('transactionByHash');
          break;
        case 'eth_getTransactionReceipt':
          // 먼저 UI를 표시하기 위해 displayOrder 업데이트
          addToDisplayOrder('transactionReceipt');
          
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
              request: txReceiptPayload,
              response: txReceipt,
              formatted: `Transaction Receipt:\n` +
                `Status: ${txReceipt.status === '0x1' ? 'Success' : 'Failed'}\n` +
                `Block Number: ${parseInt(txReceipt.blockNumber, 16)}\n` +
                `Gas Used: ${parseInt(txReceipt.gasUsed, 16).toLocaleString()}\n` +
                `Block Hash: ${txReceipt.blockHash}\n` +
                `Transaction Index: ${parseInt(txReceipt.transactionIndex, 16)}\n` +
                `Contract Address: ${txReceipt.contractAddress || 'N/A'}\n` +
                `Logs: ${txReceipt.logs.length} events`
            };
          } catch (error: any) {
            console.error('Error getting transaction receipt:', error);
            result = {
              error: error.message || 'Failed to get transaction receipt'
            };
          }
          break;
        case 'eth_getCode':
          addToDisplayOrder('getCode');
          
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
              request: codePayload,
              response: contractCode,
              formatted: contractCode === '0x' 
                ? `Contract Bytecode at ${getCodeParams.address}:\n(Not a contract)`
                : `Contract Bytecode at ${getCodeParams.address}:\n` +
                  `Bytecode Length: ${byteLength} bytes\n` +
                  `Solidity Version: ${getSolidityVersion(contractCode)}\n` +
                  `Bytecode:\n${contractCode.slice(0, 100)}...\n` +
                  `(Full bytecode available in Response Payload)`
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
            // 현재 연결된 지갑 주소를 수신자 주소로 설정
            signTypedDataParams.typedData.message.to.wallet = userAddress || '';
            result = null;
            addToDisplayOrder('signTypedData');
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
                `\nNote: This signature can be verified on-chain using EIP-712 verification methods.`
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
            result = null;
            addToDisplayOrder('personalSign');
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
                `\nNote: This signature follows ERC-191 personal_sign standard.`
            };
          } catch (error: any) {
            console.error('Error signing message:', error);
            result = {
              error: error.message || 'Failed to sign message'
            };
          }
          break;
      }
    } catch (error: any) {
      console.error(`RPC call failed (${method}):`, error);
      if (error.code === 4001) {
        console.error('User rejected request');
      }
      result = {
        error: true,
        message: error.message || 'Unknown error occurred'
      };
    }
  }

  async function handleSendTransaction() {
    if (!showTransactionForm) {
      showTransactionForm = true;
      result = null;
      transactionParams = {
        to: '',
        value: '',
        data: '',
        gasLimit: '',
        maxFeePerGas: '',
        maxPriorityFeePerGas: ''
      };
      addToDisplayOrder('sendTransaction');
      return;
    }

    await sendTransaction();
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
      
      result = 'Sending transaction...';
      
      const transactionResponse = await signer.sendTransaction(tx);
      result = `Transaction Hash: ${transactionResponse.hash}\nWaiting for confirmation...`;
      
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

      result = JSON.stringify(details);
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('DID Token')) {
        result = 'Error: Please login again. Your session might have expired.';
        await handleLogout();
      } else {
        result = `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`;
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

<main>
  <div class="app-container">
    <div class="sidebar">
      {#if isConnected}
        <div class="connection-status">
          {#if userAddress}
            <p class="address">Address: {userAddress}</p>
          {/if}
          <button class="logout-button" on:click={handleLogout}>Logout</button>
        </div>
      {/if}
      <div class="menu-section">
        <h3>Identity</h3>
        <button on:click={handleGetIdToken}>Get ID Token</button>
        <button on:click={handleGetAccessToken}>Get Access Token</button>
        <button on:click={handleGetUserInfo}>Get User Info</button>
        <button on:click={handleGetLinkedAddresses}>Get Linked Addresses</button>
      </div>
      <div class="menu-section">
        <h3>JSON-RPC API</h3>
        <div class="network-selector">
          <button 
            class:active={currentNetwork === 'testnet'} 
            on:click={() => switchNetwork('testnet')}
          >
            Testnet
          </button>
          <button 
            class:active={currentNetwork === 'mainnet'} 
            on:click={() => switchNetwork('mainnet')}
          >
            Mainnet
          </button>
        </div>
        <button on:click={() => handleRpcCall('eth_requestAccounts')}>eth_requestAccounts</button>
        <button on:click={() => {
          showTransactionForm = true;
          result = null;
          addToDisplayOrder('sendTransaction');
        }}>eth_sendTransaction</button>
        <button on:click={() => handleRpcCall('eth_accounts')}>eth_accounts</button>
        <button on:click={() => handleRpcCall('eth_gasPrice')}>eth_gasPrice</button>
        <button on:click={() => handleRpcCall('eth_getBalance')}>eth_getBalance</button>
        <button on:click={() => handleRpcCall('eth_getStorageAt')}>eth_getStorageAt</button>
        <button on:click={() => handleRpcCall('eth_estimateGas')}>eth_estimateGas</button>
        <button on:click={() => handleRpcCall('eth_call')}>eth_call</button>
        <button on:click={() => handleRpcCall('eth_getBlockByHash')}>eth_getBlockByHash</button>
        <button on:click={() => handleRpcCall('eth_getBlockByNumber')}>eth_getBlockByNumber</button>
        <button on:click={() => handleRpcCall('eth_getTransactionByHash')}>eth_getTransactionByHash</button>
        <button on:click={() => handleRpcCall('eth_getTransactionReceipt')}>eth_getTransactionReceipt</button>
        <button on:click={() => handleRpcCall('eth_getTransactionCount')}>eth_getTransactionCount</button>
        <button on:click={() => handleRpcCall('eth_getCode')}>eth_getCode</button>
        <button on:click={() => handleRpcCall('eth_signTypedData_v4')}>eth_signTypedData_v4</button>
        <button on:click={() => handleRpcCall('personal_sign')}>personal_sign</button>
      </div>
    </div>

    <div class="main-content">
      <h1>Immutable Passport Demo</h1>
      
      {#if isConnected}
        <div class="connected">
          <div class="results">
            {#each [...displayOrder].reverse() as type}
              {#if type === 'requestAccounts'}
                <div class="token-container">
                  <h3>Request Accounts</h3>
                  <div class="api-details">
                    <h4>Request Payload:</h4>
                    <pre class="token">{JSON.stringify(result.request, null, 2)}</pre>
                    <h4>Response Payload:</h4>
                    <pre class="token">{JSON.stringify(result.response, null, 2)}</pre>
                    <h4>Formatted Result:</h4>
                    <pre class="token">{result.formatted}</pre>
                  </div>
                  <div class="note">
                    <span class="note-icon">💡</span>
                    <p>Returns an array of wallet addresses after authenticating the user and initializing their Passport wallet.</p>
                  </div>
                </div>
              {:else if type === 'chainId'}
                <div class="token-container">
                  <h3>Chain ID</h3>
                  <div class="api-details">
                    <h4>Request Payload:</h4>
                    <pre class="token">{JSON.stringify(result.request, null, 2)}</pre>
                    <h4>Response Payload:</h4>
                    <pre class="token">{JSON.stringify(result.response, null, 2)}</pre>
                    <h4>Formatted Result:</h4>
                    <pre class="token">{result.formatted}</pre>
                  </div>
                </div>
              {:else if type === 'blockNumber'}
                <div class="token-container">
                  <h3>Block Number</h3>
                  <div class="api-details">
                    <h4>Request Payload:</h4>
                    <pre class="token">{JSON.stringify(result.request, null, 2)}</pre>
                    <h4>Response Payload:</h4>
                    <pre class="token">{JSON.stringify(result.response, null, 2)}</pre>
                    <h4>Formatted Result:</h4>
                    <pre class="token">{result.formatted}</pre>
                  </div>
                </div>
              {:else if type === 'blockByNumber'}
                <div class="token-container">
                  <h3>Get Block By Number</h3>
                  <div class="storage-form">
                    <div class="form-group">
                      <label for="block-number">Block Number (or 'latest'):</label>
                      <input
                        type="text"
                        id="block-number"
                        bind:value={blockByNumberParams.blockNumber}
                        placeholder="latest"
                      />
                    </div>
                    <div class="form-group">
                      <label class="checkbox-label">
                        <input
                          type="checkbox"
                          bind:checked={blockByNumberParams.includeTransactions}
                        />
                        Include Full Transactions
                      </label>
                    </div>
                    <div class="button-group">
                      <button on:click={() => handleRpcCall('eth_getBlockByNumber')}>Get Block</button>
                    </div>
                  </div>
                  {#if result}
                    <div class="api-details">
                      <h4>Request Payload:</h4>
                      <pre class="token">{JSON.stringify(result.request, null, 2)}</pre>
                      <h4>Response Payload:</h4>
                      <pre class="token">{JSON.stringify(result.response, null, 2)}</pre>
                      <h4>Formatted Result:</h4>
                      <pre class="token">{result.formatted}</pre>
                      {#if result.response && result.response.hash}
                        <div class="action-buttons">
                          <button 
                            on:click={() => {
                              blockByHashParams.blockHash = result.response.hash;
                              handleRpcCall('eth_getBlockByHash');
                            }}
                          >
                            View Block By Hash
                          </button>
                        </div>
                      {/if}
                    </div>
                  {/if}
                  <div class="note">
                    <span class="note-icon">💡</span>
                    <p>Returns information about a block by its number. Use 'latest' for the most recent block, or enter a specific block number.</p>
                    <p>When "Include Full Transactions" is checked, you'll see detailed transaction information including From, To, Value, and Gas.</p>
                    <p>The timestamp is automatically converted to your local time format.</p>
                  </div>
                </div>
              {:else if type === 'gasPrice'}
                <div class="token-container">
                  <h3>Gas Price</h3>
                  <div class="api-details">
                    <h4>Request Payload:</h4>
                    <pre class="token">{JSON.stringify(result.request, null, 2)}</pre>
                    <h4>Response Payload:</h4>
                    <pre class="token">{JSON.stringify(result.response, null, 2)}</pre>
                    <h4>Formatted Result:</h4>
                    <pre class="token">{result.formatted}</pre>
                  </div>
                </div>
              {:else if type === 'balance'}
                <div class="token-container">
                  <h3>Balance</h3>
                  <div class="api-details">
                    <h4>Request Payload:</h4>
                    <pre class="token">{JSON.stringify(result.request, null, 2)}</pre>
                    <h4>Response Payload:</h4>
                    <pre class="token">{JSON.stringify(result.response, null, 2)}</pre>
                    <h4>Formatted Result:</h4>
                    <pre class="token">{result.formatted}</pre>
                  </div>
                  <div class="note">
                    <span class="note-icon">💡</span>
                    <p>Shows the current balance of your connected wallet address with request/response details.</p>
                  </div>
                </div>
              {:else if type === 'transactionCount'}
                <div class="token-container">
                  <h3>Get Transaction Count</h3>
                  <div class="storage-form">
                    <div class="form-group">
                      <label for="count-address">Address:</label>
                      <input
                        type="text"
                        id="count-address"
                        bind:value={transactionCountParams.address}
                        placeholder={userAddress || '0x...'}
                      />
                      <small class="helper-text">The address to get the number of transactions from</small>
                    </div>
                    <div class="form-group">
                      <label for="count-block">Block Number (optional):</label>
                      <input
                        type="text"
                        id="count-block"
                        bind:value={transactionCountParams.blockNumber}
                        placeholder="latest"
                      />
                      <small class="helper-text">Block number (e.g. 1000) or 'latest', 'pending', 'earliest'. Defaults to 'latest'</small>
                    </div>
                    <div class="button-group">
                      <button on:click={() => handleRpcCall('eth_getTransactionCount')}>
                        Get Transaction Count
                      </button>
                    </div>
                  </div>
                  {#if result}
                    <div class="api-details">
                      {#if result.error}
                        <div class="error-message">
                          <span class="error-icon">⚠️</span>
                          {result.error}
                        </div>
                      {:else}
                        <h4>Request Payload:</h4>
                        <pre class="token">{JSON.stringify(result.request, null, 2)}</pre>
                        <h4>Response Payload:</h4>
                        <pre class="token">{JSON.stringify(result.response, null, 2)}</pre>
                        <h4>Formatted Result:</h4>
                        <pre class="token">{result.formatted}</pre>
                      {/if}
                    </div>
                  {/if}
                  <div class="note">
                    <span class="note-icon">💡</span>
                    <p>Returns the number of transactions sent from an address. The block number parameter is optional - if omitted, the latest block is used.</p>
                  </div>
                </div>
              {:else if type === 'idToken' && tokenState.idToken}
                <div class="token-container">
                  <h3>ID Token</h3>
                  <pre class="token">{tokenState.idToken}</pre>
                  {#if tokenState.decodedIdToken}
                    <div class="decoded-token">
                      <h4>Decoded ID Token</h4>
                      <pre class="token">{JSON.stringify(tokenState.decodedIdToken, null, 2)}</pre>
                      <div class="note">
                        <span class="note-icon">💡</span>
                        <p>The <code class="inline-code">sub</code> attribute will uniquely identify the Passport user. If your decoded token does not look like the above, double check that you have decoded the ID token and not the Access token.</p>
                      </div>
                    </div>
                  {/if}
                </div>
              {:else if type === 'accessToken' && tokenState.accessToken}
                <div class="token-container">
                  <h3>Access Token</h3>
                  <pre class="token">{tokenState.accessToken}</pre>
                  {#if tokenState.decodedAccessToken}
                    <div class="decoded-token">
                      <h4>Decoded Access Token</h4>
                      <pre class="token">{JSON.stringify(tokenState.decodedAccessToken, null, 2)}</pre>
                      <div class="note">
                        <span class="note-icon">💡</span>
                        <p>The <code class="inline-code">sub</code> attribute will uniquely identify the Passport user. If your decoded token does not look like the above, double check that you have decoded the ID token and not the Access token.</p>
                      </div>
                    </div>
                  {/if}
                </div>
              {:else if type === 'userInfo' && userInfo}
                <div class="token-container">
                  <h3>User Information</h3>
                  <div class="user-info">
                    {#if userInfo.email}
                      <p><strong>Email:</strong> {userInfo.email}</p>
                    {/if}
                    <p><strong>User ID (<code class="inline-code">sub</code>):</strong> {userInfo.sub}</p>
                    {#if userInfo.nickname}
                      <p><strong>Nickname:</strong> {userInfo.nickname}</p>
                    {/if}
                  </div>
                  <div class="note">
                    <span class="note-icon">💡</span>
                    <p><strong>Apple Social Login Email Masking:</strong> If a user logs in through Apple and chooses to mask their email address, the email will appear as <code class="inline-code">xyz@privaterelay.appleid.com</code>. This masked email prevents direct communication with users. Please consider this limitation when implementing Apple Social Login.</p>
                  </div>
                </div>
              {:else if type === 'linkedAddresses' && linkedAddresses}
                <div class="token-container">
                  <h3>Linked Addresses</h3>
                  <div class="user-info">
                    {#if linkedAddresses.length > 0}
                      <ul class="address-list">
                        {#each linkedAddresses as address}
                          <li>{address}</li>
                        {/each}
                      </ul>
                    {:else}
                      <p>No linked addresses found.</p>
                    {/if}
                  </div>
                  <div class="note">
                    <span class="note-icon">💡</span>
                    <p>These are the external wallets that the user has linked to their Passport account via the Dashboard.</p>
                  </div>
                </div>
              {:else if type === 'sendTransaction'}
                <div class="token-container">
                  <h3>Send Transaction</h3>
                  <div class="transaction-form">
                    <div class="form-group">
                      <label for="to">To Address:</label>
                      <input
                        type="text"
                        id="to"
                        bind:value={transactionParams.to}
                        placeholder={DEFAULT_TRANSACTION.to}
                      />
                    </div>
                    <div class="form-group">
                      <label for="value">Value (IMX):</label>
                      <input
                        type="text"
                        id="value"
                        bind:value={transactionParams.value}
                        placeholder={DEFAULT_TRANSACTION.value}
                      />
                    </div>
                    <div class="form-group">
                      <label for="data">Data (hex):</label>
                      <input
                        type="text"
                        id="data"
                        bind:value={transactionParams.data}
                        placeholder="0x"
                      />
                    </div>
                    <div class="form-group">
                      <label for="gasLimit">Gas Limit:</label>
                      <input
                        type="text"
                        id="gasLimit"
                        bind:value={transactionParams.gasLimit}
                        placeholder="21000"
                      />
                    </div>
                    <div class="form-group">
                      <label for="maxFeePerGas">Max Fee Per Gas (gwei):</label>
                      <input
                        type="text"
                        id="maxFeePerGas"
                        bind:value={transactionParams.maxFeePerGas}
                        placeholder="30"
                      />
                    </div>
                    <div class="form-group">
                      <label for="maxPriorityFeePerGas">Max Priority Fee Per Gas (gwei):</label>
                      <input
                        type="text"
                        id="maxPriorityFeePerGas"
                        bind:value={transactionParams.maxPriorityFeePerGas}
                        placeholder="1.5"
                      />
                    </div>
                    <div class="button-group">
                      <button on:click={sendTransaction}>Send</button>
                    </div>
                  </div>
                  {#if result}
                    <div class="transaction-result">
                      {#if !result.startsWith('Error:')}
                        {#if result.includes('blockNumber')}
                          <h4>Transaction Details:</h4>
                          {@const details = JSON.parse(result)}
                          <div class="transaction-details">
                            <div>
                              <a 
                                href="https://explorer.testnet.immutable.com/tx/{details.hash}" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                class="explorer-link"
                              >
                                Transaction Hash: {details.hash}
                                <span class="external-link-icon">↗</span>
                              </a>
                            </div>
                            <div class="detail-row">
                              <span class="detail-label">Block Number:</span>
                              <span class="detail-value">{details.blockNumber}</span>
                            </div>
                            <div class="detail-row">
                              <span class="detail-label">Value:</span>
                              <span class="detail-value">{details.value}</span>
                            </div>
                            <div class="detail-row">
                              <span class="detail-label">Transaction fee:</span>
                              <span class="detail-value">{details.transactionFee}</span>
                            </div>
                            <div class="detail-row">
                              <span class="detail-label">Gas price:</span>
                              <span class="detail-value">{details.gasPrice}</span>
                            </div>
                            <div class="detail-row">
                              <span class="detail-label">Gas usage & limit by txn:</span>
                              <span class="detail-value">{details.gasUsage}</span>
                            </div>
                            <div class="detail-row">
                              <span class="detail-label">Gas fees (Gwei):</span>
                              <span class="detail-value">{details.gasFees}</span>
                            </div>
                          </div>
                        {:else}
                          <h4>Transaction Status:</h4>
                          <pre class="token">{result}</pre>
                        {/if}
                      {:else}
                        <h4>Error:</h4>
                        <pre class="token error">{result}</pre>
                      {/if}
                    </div>
                  {/if}
                </div>
              {:else if type === 'accounts'}
                <div class="token-container">
                  <h3>{result.title}</h3>
                  <div class="description">{result.description}</div>
                  <div class="api-details">
                    <h4>Request Payload:</h4>
                    <pre class="token">{JSON.stringify(result.request, null, 2)}</pre>
                    <h4>Response Payload:</h4>
                    <pre class="token">{JSON.stringify(result.response, null, 2)}</pre>
                  </div>
                  {#if result.accounts && result.accounts.length > 0}
                    <div class="accounts-list">
                      {#each result.accounts as account}
                        <div class="account-item">
                          <a 
                            href="https://explorer.testnet.immutable.com/address/{account}" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            class="explorer-link"
                          >
                            {account}
                            <span class="external-link-icon">↗</span>
                          </a>
                        </div>
                      {/each}
                    </div>
                  {:else}
                    <p>No authorized accounts found.</p>
                  {/if}
                </div>
              {:else if type === 'storage'}
                <div class="token-container">
                  <h3>Get Storage At</h3>
                  <div class="storage-form">
                    <div class="form-group">
                      <label for="storage-address">Address:</label>
                      <input
                        type="text"
                        id="storage-address"
                        bind:value={storageParams.address}
                        placeholder={userAddress}
                      />
                    </div>
                    <div class="form-group">
                      <label for="storage-slot">Storage Slot:</label>
                      <input
                        type="text"
                        id="storage-slot"
                        bind:value={storageParams.slot}
                        placeholder="0x0"
                      />
                    </div>
                    <div class="form-group">
                      <label for="storage-block">Block Number:</label>
                      <input
                        type="text"
                        id="storage-block"
                        bind:value={storageParams.blockNumber}
                        placeholder="latest"
                      />
                    </div>
                    <div class="button-group">
                      <button on:click={() => handleRpcCall('eth_getStorageAt')}>Get Storage</button>
                    </div>
                  </div>
                  {#if result}
                    <div class="api-details">
                      <h4>Request Payload:</h4>
                      <pre class="token">{JSON.stringify(result.request, null, 2)}</pre>
                      <h4>Response Payload:</h4>
                      <pre class="token">{JSON.stringify(result.response, null, 2)}</pre>
                      <h4>Formatted Result:</h4>
                      <pre class="token">{result.formatted}</pre>
                    </div>
                  {/if}
                  <div class="note">
                    <span class="note-icon">💡</span>
                    <p>Returns the value from a storage position at the given address. If no address is provided, the connected wallet address will be used.</p>
                  </div>
                </div>
              {:else if type === 'estimateGas'}
                <div class="token-container">
                  <h3>Estimate Gas</h3>
                  <div class="storage-form">
                    <div class="form-group">
                      <label for="estimate-to">To Address:</label>
                      <input
                        type="text"
                        id="estimate-to"
                        bind:value={estimateGasParams.to}
                        placeholder={userAddress}
                      />
                    </div>
                    <div class="form-group">
                      <label for="estimate-data">Data (hex):</label>
                      <input
                        type="text"
                        id="estimate-data"
                        bind:value={estimateGasParams.data}
                        placeholder="0x"
                      />
                    </div>
                    <div class="form-group">
                      <label for="estimate-value">Value (wei in hex):</label>
                      <input
                        type="text"
                        id="estimate-value"
                        bind:value={estimateGasParams.value}
                        placeholder="0x0"
                      />
                    </div>
                    <div class="form-group">
                      <label for="estimate-block">Block Number:</label>
                      <input
                        type="text"
                        id="estimate-block"
                        bind:value={estimateGasParams.blockNumber}
                        placeholder="latest"
                      />
                    </div>
                    <div class="button-group">
                      <button on:click={() => handleRpcCall('eth_estimateGas')}>Estimate Gas</button>
                    </div>
                  </div>
                  {#if result}
                    <div class="api-details">
                      <h4>Request Payload:</h4>
                      <pre class="token">{JSON.stringify(result.request, null, 2)}</pre>
                      <h4>Response Payload:</h4>
                      <pre class="token">{JSON.stringify(result.response, null, 2)}</pre>
                      <h4>Formatted Result:</h4>
                      <pre class="token">{result.formatted}</pre>
                    </div>
                  {/if}
                  <div class="note">
                    <span class="note-icon">💡</span>
                    <p>Estimates the gas required for a transaction. If no address is provided, the connected wallet address will be used as the destination.</p>
                    <p>The data field can be used for contract interactions, and the value field specifies the amount of wei to send (in hex).</p>
                  </div>
                </div>
              {:else if type === 'call'}
                <div class="token-container">
                  <h3>Contract Call</h3>
                  <div class="storage-form">
                    <div class="form-group">
                      <label for="call-to">Contract Address:</label>
                      <input
                        type="text"
                        id="call-to"
                        bind:value={callParams.to}
                        placeholder="0x..."
                      />
                    </div>
                    <div class="form-group">
                      <label for="call-data">Call Data (hex):</label>
                      <input
                        type="text"
                        id="call-data"
                        bind:value={callParams.data}
                        placeholder="0x..."
                      />
                      <small class="helper-text">Example: 0x70a08231000000000000000000000000... (balanceOf)</small>
                    </div>
                    <div class="form-group">
                      <label for="call-value">Value (wei in hex):</label>
                      <input
                        type="text"
                        id="call-value"
                        bind:value={callParams.value}
                        placeholder="0x0"
                      />
                    </div>
                    <div class="form-group">
                      <label for="call-block">Block Number:</label>
                      <input
                        type="text"
                        id="call-block"
                        bind:value={callParams.blockNumber}
                        placeholder="latest"
                      />
                    </div>
                    <div class="button-group">
                      <button on:click={() => handleRpcCall('eth_call')}>Execute Call</button>
                    </div>
                  </div>
                  {#if result}
                    <div class="api-details">
                      <h4>Request Payload:</h4>
                      <pre class="token">{JSON.stringify(result.request, null, 2)}</pre>
                      <h4>Response Payload:</h4>
                      <pre class="token">{JSON.stringify(result.response, null, 2)}</pre>
                      <h4>Formatted Result:</h4>
                      <pre class="token">{result.formatted}</pre>
                    </div>
                  {/if}
                  <div class="note">
                    <span class="note-icon">💡</span>
                    <p>Executes a contract method call without creating a transaction. This is useful for reading data from smart contracts.</p>
                    <p>The data field should contain the encoded function signature and parameters. For example, to call balanceOf(address), use the encoded data starting with 0x70a08231...</p>
                  </div>
                </div>
              {:else if type === 'blockByHash'}
                <div class="token-container">
                  <h3>Get Block By Hash</h3>
                  <div class="storage-form">
                    <div class="form-group">
                      <label for="block-hash">Block Hash:</label>
                      <input
                        type="text"
                        id="block-hash"
                        bind:value={blockByHashParams.blockHash}
                        placeholder="0x..."
                      />
                      <small class="helper-text">Block hash must start with '0x'</small>
                    </div>
                    <div class="form-group">
                      <label class="checkbox-label">
                        <input
                          type="checkbox"
                          bind:checked={blockByHashParams.includeTransactions}
                        />
                        Include Full Transactions
                      </label>
                    </div>
                    <div class="button-group">
                      <button on:click={() => handleRpcCall('eth_getBlockByHash')}>
                        {showBlockByHashForm && blockByHashParams.blockHash ? 'Get Block' : 'Search Block By Hash'}
                      </button>
                    </div>
                  </div>
                  {#if result}
                    <div class="api-details">
                      {#if result.error}
                        <div class="error-message">
                          <span class="error-icon">⚠️</span>
                          {result.error}
                        </div>
                      {:else}
                        <h4>Request Payload:</h4>
                        <pre class="token">{JSON.stringify(result.request, null, 2)}</pre>
                        <h4>Response Payload:</h4>
                        <pre class="token">{JSON.stringify(result.response, null, 2)}</pre>
                        <h4>Formatted Result:</h4>
                        <pre class="token">{result.formatted}</pre>
                      {/if}
                    </div>
                  {/if}
                  <div class="note">
                    <span class="note-icon">💡</span>
                    <p>Returns information about a block by its hash. The block hash must start with '0x'.</p>
                    <p>When "Include Full Transactions" is checked, you'll see detailed transaction information including From, To, Value, and Gas.</p>
                  </div>
                </div>
              {:else if type === 'transactionByHash'}
                <div class="token-container">
                  <h3>Get Transaction By Hash</h3>
                  <div class="storage-form">
                    <div class="form-group">
                      <label for="transaction-hash">Transaction Hash:</label>
                      <input
                        type="text"
                        id="transaction-hash"
                        bind:value={transactionByHashParams.hash}
                        placeholder="0x..."
                      />
                      <small class="helper-text">Transaction hash must start with '0x'</small>
                    </div>
                    <div class="button-group">
                      <button on:click={() => handleRpcCall('eth_getTransactionByHash')}>
                        {showTransactionByHashForm && transactionByHashParams.hash ? 'Get Transaction' : 'Search Transaction By Hash'}
                      </button>
                    </div>
                  </div>
                  {#if result}
                    <div class="api-details">
                      {#if result.error}
                        <div class="error-message">
                          <span class="error-icon">⚠️</span>
                          {result.error}
                        </div>
                      {:else}
                        <h4>Request Payload:</h4>
                        <pre class="token">{JSON.stringify(result.request, null, 2)}</pre>
                        <h4>Response Payload:</h4>
                        <pre class="token">{JSON.stringify(result.response, null, 2)}</pre>
                        <h4>Formatted Result:</h4>
                        <pre class="token">{result.formatted}</pre>
                      {/if}
                    </div>
                  {/if}
                  <div class="note">
                    <span class="note-icon">💡</span>
                    <p>Returns information about a transaction by its hash. The transaction hash must start with '0x'.</p>
                    <p>All numeric values are automatically converted to human-readable format (IMX for value, Gwei for gas price).</p>
                  </div>
                </div>
              {:else if type === 'transactionReceipt'}
                <div class="token-container">
                  <h3>Transaction Receipt</h3>
                  <div class="storage-form">
                    <div class="form-group">
                      <label for="receipt-hash">Transaction Hash:</label>
                      <input
                        type="text"
                        id="receipt-hash"
                        bind:value={transactionState.hash}
                        placeholder="0x..."
                      />
                      <small class="helper-text">Transaction hash must start with '0x'</small>
                    </div>
                    <div class="button-group">
                      <button on:click={() => handleRpcCall('eth_getTransactionReceipt')}>
                        Get Receipt
                      </button>
                    </div>
                  </div>
                  {#if result}
                    <div class="api-details">
                      {#if result.error}
                        <div class="error-message">
                          <span class="error-icon">⚠️</span>
                          {result.error}
                        </div>
                      {:else}
                        <h4>Request Payload:</h4>
                        <pre class="token">{JSON.stringify(result.request, null, 2)}</pre>
                        <h4>Response Payload:</h4>
                        <pre class="token">{JSON.stringify(result.response, null, 2)}</pre>
                        <h4>Formatted Result:</h4>
                        <pre class="token">{result.formatted}</pre>
                      {/if}
                    </div>
                  {/if}
                  <div class="note">
                    <span class="note-icon">💡</span>
                    <p>Returns the receipt of a transaction by transaction hash. Receipt includes transaction execution status, gas used, logs, and other details.</p>
                  </div>
                </div>
              {:else if type === 'getCode'}
                <div class="token-container">
                  <h3>Get Contract Code</h3>
                  <div class="storage-form">
                    <div class="form-group">
                      <label for="code-address">Contract Address:</label>
                      <input
                        type="text"
                        id="code-address"
                        bind:value={getCodeParams.address}
                        placeholder="0x..."
                      />
                      <small class="helper-text">The address of the smart contract</small>
                    </div>
                    <div class="form-group">
                      <label for="code-block">Block Number (optional):</label>
                      <select
                        id="code-block"
                        bind:value={getCodeParams.blockNumber}
                      >
                        <option value="latest">latest - Most recent block</option>
                        <option value="earliest">earliest - Genesis block</option>
                        <option value="pending">pending - Pending block</option>
                        <option value="safe">safe - Latest safe head block</option>
                        <option value="finalized">finalized - Latest finalized block</option>
                        <option value="number">Block number (hex or decimal)</option>
                      </select>
                      {#if getCodeParams.blockNumber === 'number'}
                        <input
                          type="text"
                          placeholder="Enter block number (e.g. 1000 or 0x3e8)"
                          bind:value={getCodeParams.customBlockNumber}
                          class="mt-2"
                        />
                      {/if}
                      <small class="helper-text">Select block tag or enter a specific block number</small>
                    </div>
                    <div class="button-group">
                      <button on:click={() => handleRpcCall('eth_getCode')}>
                        Get Contract Code
                      </button>
                    </div>
                  </div>
                  {#if result}
                    <div class="api-details">
                      {#if result.error}
                        <div class="error-message">
                          <span class="error-icon">⚠️</span>
                          {result.error}
                        </div>
                      {:else}
                        <h4>Request Payload:</h4>
                        <pre class="token">{JSON.stringify(result.request, null, 2)}</pre>
                        <h4>Response Payload:</h4>
                        <pre class="token">{JSON.stringify(result.response, null, 2)}</pre>
                        <h4>Formatted Result:</h4>
                        <pre class="token">{result.formatted}</pre>
                      {/if}
                    </div>
                  {/if}
                  <div class="note">
                    <span class="note-icon">💡</span>
                    <p>Returns the bytecode of a smart contract at a given address. If the address is not a contract, returns '0x'.</p>
                    <p>The block number parameter is optional - if omitted, the latest block is used.</p>
                  </div>
                </div>
              {:else if type === 'signTypedData'}
                <div class="token-container">
                  <h3>Sign Typed Data (EIP-712)</h3>
                  <div class="storage-form">
                    <div class="form-group">
                      <label>From:</label>
                      <input
                        type="text"
                        placeholder="Sender's name"
                        bind:value={signTypedDataParams.typedData.message.from.name}
                      />
                      <input
                        type="text"
                        placeholder="Sender's wallet address (0x...)"
                        bind:value={signTypedDataParams.typedData.message.from.wallet}
                        class="mt-2"
                      />
                    </div>
                    <div class="form-group">
                      <label>To:</label>
                      <input
                        type="text"
                        placeholder="Recipient's name"
                        bind:value={signTypedDataParams.typedData.message.to.name}
                      />
                      <input
                        type="text"
                        placeholder="Recipient's wallet address (0x...)"
                        bind:value={signTypedDataParams.typedData.message.to.wallet}
                        class="mt-2"
                        disabled
                      />
                      <small class="helper-text">Your connected wallet address will be used</small>
                    </div>
                    <div class="form-group">
                      <label>Message:</label>
                      <textarea
                        placeholder="Enter your message"
                        bind:value={signTypedDataParams.typedData.message.contents}
                        rows="3"
                      ></textarea>
                    </div>
                    <div class="button-group">
                      <button on:click={() => handleRpcCall('eth_signTypedData_v4')}>
                        {showSignTypedDataForm ? 'Sign Message' : 'Create Typed Message'}
                      </button>
                    </div>
                  </div>
                  {#if result}
                    <div class="api-details">
                      {#if result.error}
                        <div class="error-message">
                          <span class="error-icon">⚠️</span>
                          {result.error}
                        </div>
                      {:else}
                        <div class="signature-details">
                          <h4>Formatted Result:</h4>
                          <pre class="token">{result.formatted}</pre>
                          
                          <div class="collapsible">
                            <h4>Request Payload:</h4>
                            <pre class="token">{JSON.stringify(result.request, null, 2)}</pre>
                          </div>
                          
                          <div class="collapsible">
                            <h4>Raw Signature:</h4>
                            <pre class="token break-all">{result.response}</pre>
                          </div>
                        </div>
                      {/if}
                    </div>
                  {/if}
                  <div class="note">
                    <span class="note-icon">💡</span>
                    <p>Signs an EIP-712 structured message. This is a secure way to sign structured data that is human-readable.</p>
                    <p>The signature can be verified on-chain using the EIP-712 standard.</p>
                  </div>
                </div>
              {:else if type === 'personalSign'}
                <div class="token-container">
                  <h3>Personal Sign (ERC-191)</h3>
                  <div class="storage-form">
                    <div class="form-group">
                      <label>Signer Address:</label>
                      <input
                        type="text"
                        placeholder="Enter signer address (0x...)"
                        bind:value={personalSignParams.fromAddress}
                      />
                      <small class="helper-text">The Ethereum address that will sign the message</small>
                    </div>
                    <div class="form-group">
                      <label>Message:</label>
                      <textarea
                        placeholder="Enter your message"
                        bind:value={personalSignParams.message}
                        rows="3"
                      ></textarea>
                      <small class="helper-text">Enter a message to sign using ERC-191 personal_sign standard</small>
                    </div>
                    <div class="button-group">
                      <button on:click={() => handleRpcCall('personal_sign')}>
                        {showPersonalSignForm ? 'Sign Message' : 'Create Personal Message'}
                      </button>
                    </div>
                  </div>
                  {#if result}
                    <div class="api-details">
                      {#if result.error}
                        <div class="error-message">
                          <span class="error-icon">⚠️</span>
                          {result.error}
                        </div>
                      {:else}
                        <div class="signature-details">
                          <h4>Formatted Result:</h4>
                          <pre class="token">{result.formatted}</pre>
                          
                          <div class="collapsible">
                            <h4>Request Payload:</h4>
                            <pre class="token">{JSON.stringify(result.request, null, 2)}</pre>
                          </div>
                          
                          <div class="collapsible">
                            <h4>Raw Signature:</h4>
                            <pre class="token break-all">{result.response}</pre>
                          </div>
                        </div>
                      {/if}
                    </div>
                  {/if}
                  <div class="note">
                    <span class="note-icon">💡</span>
                    <p>Signs a message using ERC-191 personal_sign standard. This is a simple way to sign arbitrary messages.</p>
                    <p>The message will be automatically prefixed with "\x19Ethereum Signed Message:\n" and the message length.</p>
                  </div>
                </div>
              {/if}
            {/each}
          </div>
        </div>
      {:else}
        <button class="passport-button" on:click={handleLogin}>
          <img src="/passport_btn_signin_light_small.svg" alt="Connect with Immutable Passport" />
        </button>
      {/if}
    </div>
  </div>
</main>

<style>
  .transaction-details {
    font-family: monospace;
    padding: 1rem;
    background-color: #f5f5f5;
    border-radius: 4px;
  }
  
  .detail-row {
    display: flex;
    margin: 0.5rem 0;
    padding: 0.5rem 0;
    border-bottom: 1px solid #eee;
  }
  
  .detail-label {
    flex: 0 0 200px;
    color: #666;
  }
  
  .detail-value {
    flex: 1;
    word-break: break-all;
  }

  .transaction-result {
    margin-top: 2rem;
    border-top: 1px solid #eee;
    padding-top: 1rem;
  }

  .description {
    color: #666;
    margin-bottom: 1rem;
    font-size: 0.9rem;
  }

  .accounts-list {
    background-color: #f5f5f5;
    padding: 1rem;
    border-radius: 4px;
  }

  .account-item {
    padding: 0.5rem 0;
    border-bottom: 1px solid #eee;
    font-family: monospace;
  }

  .account-item:last-child {
    border-bottom: none;
  }

  .api-details {
    margin: 1rem 0;
  }

  .api-details h4 {
    color: #666;
    margin: 1rem 0 0.5rem 0;
    font-size: 0.9rem;
  }

  .api-details pre {
    background-color: #f8f9fa;
    padding: 0.75rem;
    border-radius: 4px;
    margin: 0.5rem 0;
  }

  .storage-form {
    background-color: #fff;
    padding: 1rem;
    border-radius: 4px;
    margin: 1rem 0;
  }

  .storage-form .form-group {
    margin-bottom: 1rem;
  }

  .storage-form label {
    display: block;
    margin-bottom: 0.5rem;
    color: #333;
    font-size: 0.9rem;
  }

  .storage-form input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-family: monospace;
  }

  .button-group {
    margin-top: 1rem;
  }

  .button-group button {
    background-color: #4CAF50;
    color: white;
    border: none;
    padding: 0.75rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    width: 100%;
  }

  .button-group button:hover {
    background-color: #45a049;
  }

  .helper-text {
    font-size: 0.8rem;
    color: #666;
    margin-top: 0.25rem;
    font-style: italic;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }

  .checkbox-label input[type="checkbox"] {
    width: auto;
    margin: 0;
  }

  .action-buttons {
    margin-top: 1rem;
    display: flex;
    gap: 0.5rem;
  }

  .action-buttons button {
    background-color: #4CAF50;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
  }

  .action-buttons button:hover {
    background-color: #45a049;
  }

  .error-message {
    background-color: #ffebee;
    color: #c62828;
    padding: 1rem;
    border-radius: 4px;
    margin: 1rem 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .error-icon {
    font-size: 1.2rem;
  }

  textarea {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-family: inherit;
    resize: vertical;
  }

  .mt-2 {
    margin-top: 0.5rem;
  }

  .network-selector {
    margin-bottom: 2rem;
    padding: 1rem;
    background-color: #f5f5f5;
    border-radius: 4px;
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .network-label {
    font-weight: bold;
    color: #666;
  }

  .network-selector button {
    padding: 0.5rem 1rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    background-color: white;
    cursor: pointer;
    transition: all 0.2s;
  }

  .network-selector button:hover {
    background-color: #f0f0f0;
  }

  .network-selector button.active {
    background-color: #4CAF50;
    color: white;
    border-color: #4CAF50;
  }

  .menu-section {
    margin-bottom: 1.5rem;
    padding: 1rem;
    background: #f8f9fa;
    border-radius: 8px;
  }

  .network-buttons {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .network-buttons button {
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    background-color: white;
    cursor: pointer;
    transition: all 0.2s;
    width: 100%;
    text-align: left;
  }

  .network-buttons button:hover {
    background-color: #f0f0f0;
  }

  .network-buttons button.active {
    background-color: #4CAF50;
    color: white;
    border-color: #4CAF50;
  }

  .menu-section h3 {
    color: #333;
    margin: 0 0 0.5rem 0;
    font-size: 1rem;
  }

  .connection-status {
    margin-bottom: 1rem;
    padding: 1rem;
    background: #f8f9fa;
    border-radius: 8px;
  }

  .network-selector {
    display: flex;
    gap: 2px;
    margin-bottom: 0.5rem;
    background: #eee;
    padding: 2px;
    border-radius: 4px;
    width: 100%;
  }

  .network-selector button {
    flex: 1;
    padding: 3px 8px;
    font-size: 0.75rem;
    border: none;
    border-radius: 2px;
    background-color: transparent;
    cursor: pointer;
    transition: all 0.2s;
    color: #666;
    text-align: center;
  }

  .network-selector button:hover {
    background-color: rgba(255,255,255,0.5);
  }

  .network-selector button.active {
    background-color: white;
    color: #4CAF50;
    box-shadow: 0 1px 2px rgba(0,0,0,0.1);
  }

  .signature-details {
    background: #f8f9fa;
    padding: 1rem;
    border-radius: 4px;
    margin: 1rem 0;
  }

  .signature-details h4 {
    color: #333;
    margin: 1rem 0 0.5rem 0;
  }

  .signature-details pre {
    background: white;
    padding: 1rem;
    border-radius: 4px;
    overflow-x: auto;
  }

  .break-all {
    word-break: break-all;
    white-space: pre-wrap;
  }

  .collapsible {
    margin: 1rem 0;
  }

  .collapsible h4 {
    cursor: pointer;
    user-select: none;
  }

  .collapsible h4:hover {
    color: #4CAF50;
  }
</style>
