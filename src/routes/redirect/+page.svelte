<script lang="ts">
  import { onMount } from 'svelte';

  onMount(() => {
    // Simply close the window after a short delay
    setTimeout(() => window.close(), 1000);
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