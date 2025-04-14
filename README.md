# Immutable Passport Demo

This project demonstrates the integration of Immutable Passport authentication and wallet functionality using SvelteKit.

## Features

- Passport Authentication
- Wallet Connection
- Token Management (ID Token, Access Token)
- User Information
- Transaction Management
- JSON-RPC API Methods

## Prerequisites

- Node.js (v16 or later)
- npm or yarn
- Immutable Developer Hub Account

## Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd passport-demo
```

2. Install dependencies:
```bash
npm install
# or
yarn
```

3. Configure environment variables:
   - Copy `.env.example` to `.env`
   - Fill in your Immutable Passport credentials:
     - `VITE_IMMUTABLE_CLIENT_ID`: Your Immutable client ID
     - `VITE_IMMUTABLE_PUBLISHABLE_KEY`: Your publishable key
     - `VITE_IMMUTABLE_ENVIRONMENT`: 'SANDBOX' or 'PRODUCTION'
     - `VITE_IMMUTABLE_REDIRECT_URI`: Your application's redirect URI
     - `VITE_IMMUTABLE_LOGOUT_URI`: Your application's logout redirect URI

4. Start the development server:
```bash
npm run dev
# or
yarn dev
```

5. Open your browser and navigate to `http://localhost:5173`

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
VITE_IMMUTABLE_CLIENT_ID=your_client_id_here
VITE_IMMUTABLE_PUBLISHABLE_KEY=your_publishable_key_here
VITE_IMMUTABLE_ENVIRONMENT=SANDBOX
VITE_IMMUTABLE_REDIRECT_URI=http://localhost:5173
VITE_IMMUTABLE_LOGOUT_URI=http://localhost:5173
```

## Development

The main application code is in `src/routes/+page.svelte`. This file contains:
- Passport initialization
- Authentication handling
- Wallet connection
- Transaction management
- JSON-RPC API method implementations

## License

MIT
