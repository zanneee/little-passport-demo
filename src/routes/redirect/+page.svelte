<script lang="ts">
  import { onMount } from 'svelte';
  import { passport, config } from '@imtbl/sdk';
  import { goto } from '$app/navigation';

  let error: string | null = null;
  let passportInstance: passport.Passport | null;

  // Passport 인스턴스 초기화
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
      error = `Missing required environment variables: ${missingVars.join(', ')}. Please check your .env file.`;
      return null;
    }

    try {
      return new passport.Passport({
        baseConfig: {
          environment: isMainnet ? config.Environment.PRODUCTION : config.Environment.SANDBOX,
          publishableKey: envVars.publishableKey
        },
        clientId: envVars.clientId,
        redirectUri: envVars.redirectUri,
        logoutRedirectUri: envVars.logoutUri,
        audience: 'platform_api',
        scope: 'openid offline_access email transact'
      });
    } catch (error) {
      console.error('Failed to initialize Passport:', error);
      error = `Failed to initialize Passport: ${error instanceof Error ? error.message : 'Unknown error'}`;
      return null;
    }
  }

  onMount(async () => {
    try {
      // Passport 인스턴스 초기화 (테스트넷 사용)
      passportInstance = initializePassportInstance(false);
      if (!passportInstance) {
        throw new Error('Failed to initialize Passport instance');
      }

      console.log('Processing login callback...');
      await passportInstance.loginCallback();
      console.log('Login callback processed successfully');

      // 메인 페이지로 리다이렉트
      goto('/');
    } catch (err) {
      console.error('Login callback failed:', err);
      error = err instanceof Error ? err.message : 'Unknown error occurred';
    }
  });
</script>

<div class="min-h-screen bg-gray-50 flex items-center justify-center">
  <div class="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
    {#if error}
      <div class="text-red-600">
        <h2 class="text-xl font-bold mb-2">Login Failed</h2>
        <p>{error}</p>
      </div>
    {:else}
      <div class="text-center">
        <h2 class="text-xl font-bold mb-2">Processing Login...</h2>
        <p class="text-gray-600">Please wait while we complete your login.</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .container {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
    text-align: center;
  }

  h1 {
    color: #333;
  }
</style>
