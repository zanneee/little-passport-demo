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

  // Constants
  const DEFAULT_TRANSACTION = {
    to: '0xacbe301e5b46f4dd532b74e209adac0c06d42f8c',
    value: '1000000000000000000'
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
  let showTransactionForm = false;

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
          await handleSendTransaction();
          break;
        case 'eth_requestAccounts':
          result = await passportProvider.request({ method: 'eth_requestAccounts' });
          addToDisplayOrder('requestAccounts');
          break;
        case 'eth_chainId':
          result = await passportProvider.request({ method: 'eth_chainId' });
          addToDisplayOrder('chainId');
          break;
        case 'eth_blockNumber':
          result = await passportProvider.request({ method: 'eth_blockNumber' });
          addToDisplayOrder('blockNumber');
          break;
        case 'eth_gasPrice':
          result = await passportProvider.request({ method: 'eth_gasPrice' });
          addToDisplayOrder('gasPrice');
          break;
        case 'eth_getTransactionCount':
          if (!userAddress) return;
          result = await passportProvider.request({ 
            method: 'eth_getTransactionCount',
            params: [userAddress, 'latest']
          });
          addToDisplayOrder('transactionCount');
          break;
      }
    } catch (error: any) {
      console.error(`RPC call failed (${method}):`, error);
      if (error.code === 4001) {
        console.error('User rejected request');
      }
      result = null;
    }
  }

  async function handleSendTransaction() {
    if (!showTransactionForm) {
      showTransactionForm = true;
      result = null;
      transactionState = {
        ...transactionState,
        params: {
          to: '',
          data: '',
          value: ''
        }
      };
      addToDisplayOrder('sendTransaction');
      return;
    }

    try {
      const inputTo = transactionState.params.to || DEFAULT_TRANSACTION.to;
      const inputValue = transactionState.params.value || DEFAULT_TRANSACTION.value;

      if (!inputTo) {
        result = ERROR_MESSAGES.INVALID_PARAMS;
        return;
      }

      const value = inputValue ? 
        (inputValue.startsWith('0x') ? inputValue : `0x${BigInt(inputValue).toString(16)}`) : 
        undefined;

      const data = transactionState.params.data ? 
        (transactionState.params.data.startsWith('0x') ? transactionState.params.data : `0x${transactionState.params.data}`) : 
        undefined;

      const params = {
        to: inputTo.startsWith('0x') ? inputTo : `0x${inputTo}`,
        ...(data && { data }),
        ...(value && { value })
      };

      result = await passportProvider.request({
        method: 'eth_sendTransaction',
        params: [params]
      });

      showTransactionForm = false;
      transactionState = {
        ...transactionState,
        params: {
          to: '',
          data: '',
          value: ''
        }
      };
    } catch (error: any) {
      if (error.code === 4100) {
        result = ERROR_MESSAGES.UNAUTHORIZED;
      } else if (error.code === -32602) {
        result = ERROR_MESSAGES.INVALID_PARAMS;
      } else {
        result = `Error: ${error.message || ERROR_MESSAGES.TRANSACTION_FAILED}`;
      }
    }
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
        <h3>Wallet</h3>
        <button on:click={() => handleRpcCall('eth_requestAccounts')}>Request Accounts</button>
        <button on:click={() => {
          showTransactionForm = true;
          result = null;
          addToDisplayOrder('sendTransaction');
        }}>Send Transaction</button>
        <button on:click={() => handleRpcCall('eth_accounts')}>Get Accounts</button>
        <button on:click={() => handleRpcCall('eth_gasPrice')}>Gas Price</button>
        <button on:click={() => handleRpcCall('eth_getBalance')}>Get Balance</button>
        <button on:click={() => handleRpcCall('eth_getStorageAt')}>Get Storage At</button>
        <button on:click={() => handleRpcCall('eth_estimateGas')}>Estimate Gas</button>
        <button on:click={() => handleRpcCall('eth_call')}>Call</button>
        <button on:click={() => handleRpcCall('eth_blockNumber')}>Block Number</button>
        <button on:click={() => handleRpcCall('eth_chainId')}>Chain ID</button>
        <button on:click={() => handleRpcCall('eth_getBlockByHash')}>Get Block By Hash</button>
        <button on:click={() => handleRpcCall('eth_getBlockByNumber')}>Get Block By Number</button>
        <button on:click={() => handleRpcCall('eth_getTransactionByHash')}>Get Transaction By Hash</button>
        <button on:click={() => handleRpcCall('eth_getTransactionReceipt')}>Get Transaction Receipt</button>
        <button on:click={() => handleRpcCall('eth_getTransactionCount')}>Get Transaction Count</button>
        <button on:click={() => handleRpcCall('eth_getCode')}>Get Code</button>
        <button on:click={() => handleRpcCall('eth_signTypedData_v4')}>Sign Typed Data v4</button>
        <button on:click={() => handleRpcCall('personal_sign')}>Personal Sign</button>
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
                  <pre class="token">{JSON.stringify(result, null, 2)}</pre>
                  <div class="note">
                    <span class="note-icon">💡</span>
                    <p>Returns an array of wallet addresses after authenticating the user and initializing their Passport wallet.</p>
                  </div>
                </div>
              {:else if type === 'chainId'}
                <div class="token-container">
                  <h3>Chain ID</h3>
                  <pre class="token">{result}</pre>
                </div>
              {:else if type === 'blockNumber'}
                <div class="token-container">
                  <h3>Block Number</h3>
                  <pre class="token">{result}</pre>
                </div>
              {:else if type === 'gasPrice'}
                <div class="token-container">
                  <h3>Gas Price</h3>
                  <pre class="token">{result} Wei</pre>
                </div>
              {:else if type === 'transactionCount'}
                <div class="token-container">
                  <h3>Transaction Count</h3>
                  <pre class="token">{result}</pre>
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
                  {#if showTransactionForm}
                    <div class="transaction-form">
                      <div class="form-group">
                        <label for="to">To Address (required):</label>
                        <input 
                          type="text" 
                          id="to" 
                          bind:value={transactionState.params.to} 
                          placeholder="0xacbe301e5b46f4dd532b74e209adac0c06d42f8c"
                        />
                        <small>The destination address of the message</small>
                      </div>
                      <div class="form-group">
                        <label for="data">Data (optional):</label>
                        <input 
                          type="text" 
                          id="data" 
                          bind:value={transactionState.params.data} 
                          placeholder="0x..."
                        />
                        <small>Byte string containing the associated data or contract initialization code</small>
                      </div>
                      <div class="form-group">
                        <label for="value">Value in Wei (optional):</label>
                        <input 
                          type="text" 
                          id="value" 
                          bind:value={transactionState.params.value} 
                          placeholder="1000000000000000000"
                        />
                        <small>The value transferred for the transaction in wei (1 IMX = 1,000,000,000,000,000,000 Wei)</small>
                      </div>
                      <button class="submit-transaction" on:click={() => handleRpcCall('eth_sendTransaction')}>
                        Submit Transaction
                      </button>
                    </div>
                  {/if}
                  {#if result}
                    <div class="transaction-result">
                      <h4>{result.startsWith('Error:') ? 'Error' : 'Transaction Hash'}:</h4>
                      {#if !result.startsWith('Error:')}
                        <a 
                          href="https://explorer.testnet.immutable.com/tx/{result}" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          class="explorer-link"
                        >
                          <pre class="token">{result}</pre>
                          <span class="external-link-icon">↗</span>
                        </a>
                      {:else}
                        <pre class="token error">{result}</pre>
                      {/if}
                    </div>
                  {/if}
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
