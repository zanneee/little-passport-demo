<!-- InputField: Generic input or textarea component -->
<script lang="ts">
  export let id: string;
  export let value: string;
  export let label: string;
  export let placeholder: string = '';
  export let className: string = '';
  export let textarea: boolean = false;
  export let rows: number = 4;
  export let required: boolean = false;
  export let description: string = '';
</script>

<div class="space-y-1">
  <label for={id} class="block text-sm font-medium text-gray-700">
    {label}
    {#if required}
      <span class="text-red-600">*</span>
    {/if}
  </label>

  {#if textarea}
    <textarea
      id={id}
      bind:value={value}
      rows={rows}
      placeholder={placeholder}
      class={className}
      on:input
      on:change
      on:focus
      on:blur
    ></textarea>
  {:else}
    <input
      id={id}
      type="text"
      bind:value={value}
      placeholder={placeholder}
      class={className}
      on:input
      on:change
      on:focus
      on:blur
    />
  {/if}

  {#if description}
    <p class="mt-1 text-xs text-gray-500">{description}</p>
  {/if}
</div>
