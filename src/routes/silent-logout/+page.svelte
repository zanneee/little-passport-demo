<script lang="ts">
  import { onMount } from 'svelte';
  import { passport, config } from '@imtbl/sdk';

  let error: string | null = null;
  let passportInstance: passport.Passport;

  // Initialize Passport instance
  function initializePassportInstance(isMainnet: boolean) {
    const prefix = isMainnet ? 'MAINNET' : 'TESTNET';
    const envVars = {
      clientId: import.meta.env[`VITE_IMMUTABLE_${prefix}_CLIENT_ID`],
      publishableKey: import.meta.env[`VITE_IMMUTABLE_${prefix}_PUBLISHABLE_KEY`],
      redirectUri: import.meta.env[`VITE_IMMUTABLE_${prefix}_REDIRECT_URI`],
      logoutUri: import.meta.env[`VITE_IMMUTABLE_${prefix}_LOGOUT_URI`]
    };

    try {
      return new passport.Passport({
        baseConfig: {
          environment: isMainnet ? config.Environment.PRODUCTION : config.Environment.SANDBOX,
          publishableKey: envVars.publishableKey
        },
        clientId: envVars.clientId,
        redirectUri: envVars.redirectUri,
        logoutRedirectUri: envVars.logoutUri,
        logoutMode: 'silent',
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
      // Initialize Passport instance (using testnet)
      const instance = initializePassportInstance(false);
      if (!instance) return;
      passportInstance = instance;

      // Use window.location.origin as the initiator URL
      const initiatorUrl = window.location.origin;

      // Call logoutSilentCallback with the initiator URL
      console.log('Calling logoutSilentCallback with initiator:', initiatorUrl);
      await passportInstance.logoutSilentCallback(initiatorUrl);
      console.log('LogoutSilentCallback completed successfully');

      // Send message to parent window that logout is complete
      //window.parent.postMessage({ type: 'LOGOUT_COMPLETE' }, initiatorUrl);
    } catch (err) {
      console.error('Silent logout callback failed:', err);
      error = err instanceof Error ? err.message : 'Unknown error occurred';
    }
  });
</script>
