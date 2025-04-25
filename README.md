# Immutable Passport Demo

A demo application showcasing Immutable Passport authentication and wallet functionality using SvelteKit.

## Features

- Passport Authentication
- Wallet Connection
- Token Management
- User Information
- Transaction Management
- JSON-RPC API Methods

## Prerequisites

- Node.js v20 or later
- npm or yarn
- Immutable Developer Hub Account

## Setup Instructions

1. Clone the repository
```bash
git clone https://github.com/zanneee/little-passport-demo.git
cd little-passport-demo
```

2. Install dependencies
```bash
yarn install
```

3. Configure Environment Variables
   - Copy `.env.example` to `.env`
   - Set up your Immutable Hub project and get your API keys by following the [official setup guide](https://docs.immutable.com/tutorials/zkEVM/build-web-game/setting-up)
   - Update the following variables in your `.env` file:
     ```
     VITE_IMMUTABLE_CLIENT_ID=         # Your Client ID from Immutable Hub
     VITE_IMMUTABLE_PUBLISHABLE_KEY=   # Your Publishable Key
     VITE_IMMUTABLE_ENVIRONMENT=SANDBOX # or PRODUCTION
     VITE_IMMUTABLE_REDIRECT_URI=http://localhost:5173
     VITE_IMMUTABLE_LOGOUT_URI=http://localhost:5173
     ```

4. Start the development server
```bash
yarn dev
```

Visit https://little-passport-demo.vercel.app/ to see the application running.

## Development

The main application code is located in `src/routes/+page.svelte`. This file contains the implementation of:
- Passport authentication
- Wallet connection
- Transaction handling
- User information display

## License

MIT
