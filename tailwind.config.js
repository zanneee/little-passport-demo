/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {}
  },
  plugins: [
    function({ addComponents }) {
      addComponents({
        '.btn-primary': {
          '@apply w-full bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors': {}
        },
        '.select-field': {
          '@apply w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white': {}
        },
        '.form-label': {
          '@apply block text-sm font-medium text-gray-700 mb-1': {}
        },
        '.form-container': {
          '@apply space-y-4 mb-4': {}
        },
        '.input-field': {
          '@apply w-full px-3 py-2 border border-gray-300 rounded-md text-sm': {}
        },
        '.checkbox-field': {
          '@apply h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded': {}
        },
        '.result-pre': {
          '@apply text-xs font-mono bg-gray-50 p-4 rounded-md overflow-x-auto whitespace-pre-wrap break-all': {}
        },
        '.note-message': {
          '@apply text-sm text-gray-500 mt-4 p-4 bg-blue-50 rounded-md': {}
        },
        '.warning-message': {
          '@apply text-sm text-gray-500 mt-4 p-4 bg-yellow-50 rounded-md': {}
        }
      })
    }
  ],
  safelist: [
    'btn-primary',
    'select-field',
    'form-label',
    'form-container',
    'input-field',
    'checkbox-field',
    'result-pre',
    'note-message',
    'warning-message'
  ]
}

