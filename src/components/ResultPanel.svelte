<!-- ResultPanel: Displays transaction results, errors, and formatted output -->
<script lang="ts">
  import { transactionState } from '../utils/transactionStore';
  import { onDestroy } from 'svelte';
  export let result: any;

  // Subscribe to transaction state
  let hash: string | null = null;
  let error: string | null = null;
  const unsubscribe = transactionState.subscribe(state => {
    hash = state.hash;
    error = state.error;
  });
  onDestroy(unsubscribe);
</script>

<div class="mt-6 bg-gray-50 rounded-md p-4">
  {#if error}
    <h4 class="text-sm font-medium text-red-900 mb-2">Error:</h4>
    <p class="text-red-600 text-sm">{error}</p>
  {:else if hash}
    <h4 class="text-sm font-medium text-green-900 mb-2">Transaction Hash:</h4>
    <p class="text-green-600 text-sm">{hash}</p>
  {:else}
    {#if result?.error}
      <h4 class="text-sm font-medium text-red-900 mb-2">Error:</h4>
      <p class="text-red-600 text-sm">{result.error}</p>
    {/if}
    {#if result?.request}
      <div>
        <h4 class="text-sm font-medium text-gray-900 mb-2">Request Payload:</h4>
        <pre class="text-xs font-mono bg-white/50 p-2 rounded overflow-x-auto whitespace-pre-wrap break-all">{JSON.stringify(result.request, null, 2)}</pre>
      </div>
    {/if}
    {#if result?.response}
      <div class="mt-4">
        <h4 class="text-sm font-medium text-gray-900 mb-2">Response Payload:</h4>
        <pre class="text-xs font-mono bg-white/50 p-2 rounded overflow-x-auto whitespace-pre-wrap break-all">{JSON.stringify(result.response, null, 2)}</pre>
      </div>
    {/if}
    {#if result?.decoded}
      <div class="mt-4">
        <h4 class="text-sm font-medium text-gray-900 mb-2">Decoded Result:</h4>
        <pre class="text-xs font-mono bg-white/50 p-2 rounded overflow-x-auto whitespace-pre-wrap break-all">{result.decoded}</pre>
      </div>
    {/if}
    {#if result?.formatted}
      <div class="mt-4">
        <h4 class="text-sm font-medium text-gray-900 mb-2">Formatted:</h4>
        <pre class="text-xs font-mono bg-white/50 p-2 rounded overflow-x-auto whitespace-pre-wrap break-all">{result.formatted}</pre>
      </div>
    {/if}
  {/if}
</div> 