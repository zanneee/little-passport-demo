<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  let error: string | null = null;
  let countdown = 5;

  onMount(async () => {
    try {
      const timer = setInterval(() => {
        countdown--;
        if (countdown <= 0) {
          clearInterval(timer);
          goto('/');
        }
      }, 1000);
    } catch (err) {
      console.error('Redirect failed:', err);
      error = err instanceof Error ? err.message : 'Unknown error occurred';
    }
  });
</script>

<div class="min-h-screen bg-gray-50 flex items-center justify-center">
  <div class="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
    {#if error}
      <div class="text-red-600">
        <h2 class="text-xl font-bold mb-2">Redirect Failed</h2>
        <p>{error}</p>
      </div>
    {:else}
      <div class="text-center">
        <h2 class="text-xl font-bold mb-2">Redirecting...</h2>
        <p class="text-gray-600">You will be redirected to the main page in {countdown} seconds.</p>
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
