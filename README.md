# Passport Demo

A demonstration of Immutable Passport integration with SvelteKit.

## Features

- Passport authentication integration
- Network switching (Testnet/Mainnet)
- RPC method demonstrations
- Token management
- User profile information
- Linked addresses management

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Immutable Developer Console account

## Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# Testnet Configuration
VITE_IMMUTABLE_TESTNET_CLIENT_ID=your_testnet_client_id
VITE_IMMUTABLE_TESTNET_PUBLISHABLE_KEY=your_testnet_publishable_key
VITE_IMMUTABLE_TESTNET_REDIRECT_URI=http://localhost:5173
VITE_IMMUTABLE_TESTNET_LOGOUT_URI=http://localhost:5173/silent-logout

# Mainnet Configuration
VITE_IMMUTABLE_MAINNET_CLIENT_ID=your_mainnet_client_id
VITE_IMMUTABLE_MAINNET_PUBLISHABLE_KEY=your_mainnet_publishable_key
VITE_IMMUTABLE_MAINNET_REDIRECT_URI=http://localhost:5173
VITE_IMMUTABLE_MAINNET_LOGOUT_URI=http://localhost:5173/silent-logout
```

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/passport-demo.git
cd passport-demo
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

## Project Structure

```
src/
├── components/         # Reusable UI components
├── constants/         # Network configuration and constants
├── routes/           # SvelteKit routes
│   ├── +page.svelte  # Main application page
│   ├── redirect/     # Authentication redirect handler
│   └── logout/       # Logout handler
├── types/            # TypeScript type definitions
└── utils/            # Utility functions
```

## Available RPC Methods

- `eth_requestAccounts`: Request user accounts
- `eth_accounts`: Get connected accounts
- `eth_chainId`: Get current chain ID
- `eth_blockNumber`: Get latest block number
- `eth_gasPrice`: Get current gas price
- `eth_getBalance`: Get account balance
- `eth_getStorageAt`: Get storage at address
- `eth_estimateGas`: Estimate gas for transaction
- `eth_call`: Call contract method
- `eth_getBlockByHash`: Get block by hash
- `eth_getBlockByNumber`: Get block by number
- `eth_getTransactionByHash`: Get transaction by hash
- `eth_getTransactionReceipt`: Get transaction receipt
- `eth_getTransactionCount`: Get transaction count
- `eth_getCode`: Get contract code
- `eth_signTypedData_v4`: Sign typed data
- `personal_sign`: Sign message

## Recent Changes

- Optimized redirect and logout pages
- Improved error handling
- Enhanced network switching functionality
- Added better environment variable validation

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
