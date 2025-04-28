<!-- InputField: Generic input or textarea component -->
<script lang="ts">
  export let label: string;
  export let id: string;
  export let value: string;
  export let placeholder: string = '';
  export let type: string = 'text';
  export let disabled: boolean = false;
  export let textarea: boolean = false;
  export let rows: number = 2;
  export let onInput: (e: Event) => void;
</script>

<div>
  <label class="block text-sm font-medium text-gray-700 mb-1" for={id}>
    {label}
  </label>
  {#if textarea}
    <textarea
      id={id}
      rows={rows}
      class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
      placeholder={placeholder}
      bind:value={value}
      disabled={disabled}
      on:input={onInput}
    ></textarea>
  {:else}
    <input
      type={type}
      id={id}
      class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
      placeholder={placeholder}
      bind:value={value}
      disabled={disabled}
      on:input={onInput}
    />
  {/if}
</div> 