<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  onMount(() => {
    // Simply redirect to home page after a short delay
    setTimeout(() => goto('/'), 1000);
  });
</script>

<main>
  <div class="container">
    <h1>Logging out...</h1>
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