<!-- AddressList: Displays a list of addresses with explorer links -->
<script lang="ts">
  export let addresses: string[] = [];
  export let explorerBase: string;
</script>

{#if addresses.length > 0}
  <div class="mt-4 space-y-2">
    <h5 class="text-sm font-medium text-gray-700">Explorer Links:</h5>
    {#each addresses as address}
      <a
        href={`${explorerBase}/address/${address}`}
        target="_blank"
        rel="noopener noreferrer"
        class="block text-sm text-indigo-600 hover:text-indigo-800 break-all"
      >
        {address} ↗
      </a>
    {/each}
  </div>
{/if} 