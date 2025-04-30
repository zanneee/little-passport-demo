<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { slide } from 'svelte/transition';

  export let title: string;
  export let items: Array<{ label: string; onClick: () => void }>;

  const dispatch = createEventDispatcher();
  let isOpen = false;

  function toggleMenu() {
    isOpen = !isOpen;
    dispatch('stateChange', isOpen);
  }
</script>

<div class="border border-gray-200 rounded-md">
  <button
    class="w-full px-4 py-2 flex items-center justify-between text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
    on:click={toggleMenu}
  >
    <span>{title}</span>
    <svg
      class="h-5 w-5 transform transition-transform {isOpen ? 'rotate-180' : ''}"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fill-rule="evenodd"
        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
        clip-rule="evenodd"
      ></path>
    </svg>
  </button>

  {#if isOpen}
    <div transition:slide={{ duration: 200 }} class="border-t border-gray-200">
      <div class="py-2">
        {#each items as item}
          <button
            class="w-full px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors text-left"
            on:click={item.onClick}
          >
            {item.label}
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .accordion {
    width: 100%;
    border: 1px solid #ddd;
    border-radius: 4px;
    margin-bottom: 8px;
  }

  .accordion-header {
    width: 100%;
    padding: 12px 16px;
    background-color: #f8f9fa;
    border: none;
    text-align: left;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 500;
  }

  .accordion-header:hover {
    background-color: #e9ecef;
  }

  .accordion-content {
    padding: 16px;
    background-color: white;
  }

  .icon {
    font-size: 12px;
  }

  .menu-item {
    width: 100%;
    padding: 8px 12px;
    background: none;
    border: none;
    text-align: left;
    cursor: pointer;
    border-radius: 4px;
  }

  .menu-item:hover {
    background-color: #f8f9fa;
  }
</style>
