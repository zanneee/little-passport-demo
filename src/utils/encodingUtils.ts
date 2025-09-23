import { ethers } from 'ethers';

/**
 * Calculate Keccak-256 hash for input text
 */
export function calculateKeccak256Hash(
    input: string,
    inputType: 'utf8' | 'hex' = 'utf8'
): { hash: string; selector: string } | { error: string } {
    if (!input.trim()) {
        return { error: 'Input is required' };
    }

    try {
        let inputData: string | Uint8Array;

        if (inputType === 'hex') {
            // Remove 0x prefix if present and validate hex
            const cleanInput = input.replace(/^0x/, '');
            if (!/^[0-9a-fA-F]*$/.test(cleanInput)) {
                throw new Error('Invalid hex input');
            }
            // Convert hex to bytes
            inputData = ethers.hexlify('0x' + cleanInput);
        } else {
            // UTF-8 input
            inputData = ethers.toUtf8Bytes(input);
        }

        // Calculate Keccak-256 hash
        const hash = ethers.keccak256(inputData);

        // Extract function selector (first 4 bytes)
        const selector = hash.slice(0, 10); // 0x + 8 hex chars = 4 bytes

        return { hash, selector };
    } catch (error) {
        return {
            error: error instanceof Error ? error.message : 'Invalid input'
        };
    }
}

/**
 * Encode function call data using ethers.js Interface
 */
export function encodeFunctionCall(
    functionSignature: string,
    parameters: unknown[] = []
): { encodedData: string } | { error: string } {
    if (!functionSignature.trim()) {
        return { error: 'Function signature is required' };
    }

    try {
        // Create ABI from function signature
        const abi = [`function ${functionSignature}`];
        const iface = new ethers.Interface(abi);

        // Extract function name from signature
        const functionName = functionSignature.split('(')[0];

        // Encode function data
        const encodedData = iface.encodeFunctionData(functionName, parameters);

        return { encodedData };
    } catch (error) {
        return {
            error: error instanceof Error ? error.message : 'Encoding failed'
        };
    }
}

/**
 * Decode transaction data using ABI
 */
export function decodeTransaction(
    transactionData: string,
    abi?: string
): { decodedData: Record<string, unknown> } | { error: string } {
    if (!transactionData.trim()) {
        return { error: 'Transaction data is required' };
    }

    try {
        let decodedData: Record<string, unknown> = {};

        // Try to decode with provided ABI
        if (abi?.trim()) {
            try {
                const parsedAbi = JSON.parse(abi);
                const iface = new ethers.Interface(parsedAbi);

                // Try to decode the transaction data
                const decoded = iface.parseTransaction({ data: transactionData });

                if (decoded) {
                    decodedData = {
                        functionName: decoded.name,
                        functionSignature: decoded.signature,
                        selector: decoded.selector,
                        args: decoded.args.map((arg, index) => ({
                            name: decoded.fragment.inputs[index]?.name || `param${index}`,
                            type: decoded.fragment.inputs[index]?.type || 'unknown',
                            value: arg.toString()
                        }))
                    };
                } else {
                    throw new Error('Could not decode with provided ABI');
                }
            } catch (abiError) {
                console.warn('ABI decoding failed, trying basic decoding:', abiError);
                // Fall back to basic decoding
                decodedData = basicDecodeTransactionData(transactionData);
            }
        } else {
            // Basic decoding without ABI
            decodedData = basicDecodeTransactionData(transactionData);
        }

        return { decodedData };
    } catch (error) {
        return {
            error: error instanceof Error ? error.message : 'Decoding failed'
        };
    }
}

/**
 * Basic transaction data decoding without ABI
 */
function basicDecodeTransactionData(data: string): Record<string, unknown> {
    // Remove 0x prefix
    const cleanData = data.replace(/^0x/, '');

    if (cleanData.length < 8) {
        throw new Error('Transaction data too short');
    }

    // Extract function selector (first 4 bytes)
    const selector = '0x' + cleanData.slice(0, 8);

    // Extract parameters (remaining bytes)
    const params = cleanData.slice(8);

    return {
        selector: selector,
        parametersHex: '0x' + params,
        parametersLength: params.length / 2,
        note: 'Basic decoding - provide ABI for detailed parameter parsing'
    };
}

/**
 * Validate and parse JSON parameters
 */
export function parseParameters(parametersJson: string): unknown[] | { error: string } {
    if (!parametersJson.trim()) {
        return [];
    }

    try {
        const parameters = JSON.parse(parametersJson);
        if (!Array.isArray(parameters)) {
            return { error: 'Parameters must be an array' };
        }
        return parameters;
    } catch {
        return {
            error: 'Invalid JSON format'
        };
    }
}

/**
 * Common function signatures and their selectors for reference
 */
export const COMMON_FUNCTION_SELECTORS = {
    // ERC-20
    'transfer(address,uint256)': '0xa9059cbb',
    'approve(address,uint256)': '0x095ea7b3',
    'balanceOf(address)': '0x70a08231',
    'allowance(address,address)': '0xdd62ed3e',

    // ERC-721
    'setApprovalForAll(address,bool)': '0xa22cb465',
    'ownerOf(uint256)': '0x6352211e',
    'safeTransferFrom(address,address,uint256)': '0x42842e0e',
    'transferFrom(address,address,uint256)': '0x23b872dd',

    // Common
    'name()': '0x06fdde03',
    'symbol()': '0x95d89b41',
    'decimals()': '0x313ce567'
} as const;
