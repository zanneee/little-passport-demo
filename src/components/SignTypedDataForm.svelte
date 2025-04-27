<!-- SignTypedDataForm: Form for signing EIP-712 typed data using PassportProvider -->
<script lang="ts">
  import { transactionState } from '../utils/transactionStore';
  import { derived } from 'svelte/store';
  export let typedData: any;
  export let disabled: boolean = false;

  // Subscribe to transaction state
  let hash: string | null = null;
  let error: string | null = null;
  let sending: boolean = false;
  transactionState.subscribe(state => {
    hash = state.hash;
    error = state.error;
    sending = state.sending;
  });

  // Simulate a signTypedData transaction
  async function handleSign() {
    transactionState.update(state => ({ ...state, sending: true, error: null, hash: null }));
    try {
      // Simulate async signing (replace with real RPC call)
      await new Promise(res => setTimeout(res, 1500));
      // Simulate a fake tx hash
      const fakeHash = '0x' + Math.random().toString(16).slice(2, 10).padEnd(8, '0');
      transactionState.update(state => ({ ...state, hash: fakeHash, sending: false, error: null }));
    } catch (err) {
      transactionState.update(state => ({ ...state, error: err instanceof Error ? err.message : 'Transaction failed', sending: false, hash: null }));
    }
  }
</script>

<div class="space-y-4 mb-4">
  <div>
    <label class="block text-sm font-medium text-gray-700 mb-1" for="sign-typed-data-address">
      Address <span class="text-red-600">*</span>
    </label>
    <input
      type="text"
      id="sign-typed-data-address"
      value={typedData?.message?.from?.wallet || ''}
      disabled
      class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50"
    />
    <p class="mt-1 text-xs text-gray-500">The address that will sign the message (automatically set to your connected wallet address)</p>
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
      value={JSON.stringify(typedData, null, 2)}
      readonly
    ></textarea>
    <p class="mt-1 text-xs text-gray-500">A JSON in either string or object form that conforms to the EIP-712 TypedData JSON schema.</p>
  </div>

  <button
    class="w-full bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
    on:click={handleSign}
    disabled={disabled || sending}
  >
    {#if sending}
      Signing...
    {:else}
      Sign Message
    {/if}
  </button>
</div>

{#if hash}
  <div class="mt-2 p-2 bg-green-100 text-green-800 rounded">Transaction Hash: {hash}</div>
{/if}
{#if error}
  <div class="mt-2 p-2 bg-red-100 text-red-800 rounded">Error: {error}</div>
{/if} 