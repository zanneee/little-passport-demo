<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { passport, config } from '@imtbl/sdk';

  let passportInstance: passport.Passport;

  onMount(() => {
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

    // Handle the redirect
    passportInstance.loginCallback().then(() => {
      window.close();
    }).catch((error: unknown) => {
      console.error('Error handling redirect:', error);
      window.close();
    });
  });
</script>

<main>
  <div class="container">
    <h1>Processing authentication...</h1>
  </div>
</main>

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