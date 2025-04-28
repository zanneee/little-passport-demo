// Passport instance creation and token retrieval helpers

import { passport, config } from '@imtbl/sdk';

export function createPassportInstance(envVars: any) {
  const environment = envVars.VITE_IMMUTABLE_ENVIRONMENT === 'PRODUCTION'
    ? config.Environment.PRODUCTION
    : config.Environment.SANDBOX;

  return new passport.Passport({
    baseConfig: {
      environment,
      publishableKey: envVars.VITE_IMMUTABLE_PUBLISHABLE_KEY,
    },
    clientId: envVars.VITE_IMMUTABLE_CLIENT_ID,
    redirectUri: envVars.VITE_IMMUTABLE_REDIRECT_URI,
    logoutRedirectUri: envVars.VITE_IMMUTABLE_LOGOUT_URI,
    audience: 'platform_api',
    scope: 'openid offline_access email transact',
  });
}

export async function getIdToken(passportInstance: any) {
  return await passportInstance.getIdToken();
}

export async function getAccessToken(passportInstance: any) {
  return await passportInstance.getAccessToken();
}

export async function getUserInfo(passportInstance: any) {
  return await passportInstance.getUserInfo();
}

export async function getLinkedAddresses(passportInstance: any) {
  return await passportInstance.getLinkedAddresses();
} 