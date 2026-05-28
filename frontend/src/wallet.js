import { createWalletClient, custom } from "viem";

// Must match ConsentManager's EIP712("MedicalAccessControl", "1") + chainId 31337.
const DOMAIN = {
  name: "MedicalAccessControl",
  version: "1",
  chainId: 31337,
  verifyingContract: "0x5FbDB2315678afecb367f032d93F642f64180aa3", // ConsentManager
};

const TYPES = {
  Consent: [
    { name: "patient", type: "address" },
    { name: "organization", type: "address" },
    { name: "scope", type: "string" },
    { name: "expiresAt", type: "uint256" },
    { name: "nonce", type: "uint256" },
  ],
};

// True if MetaMask (or any injected wallet) is present.
export function hasWallet() {
  return typeof window !== "undefined" && !!window.ethereum;
}

// Ask MetaMask to connect; returns the selected address.
export async function connectWallet() {
  if (!hasWallet()) throw new Error("MetaMask not detected. Install the extension.");
  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  return accounts[0];
}

// Returns the chainId MetaMask is currently on (as a number).
export async function getChainId() {
  const hex = await window.ethereum.request({ method: "eth_chainId" });
  return parseInt(hex, 16);
}

/**
 * Ask MetaMask to sign an EIP-712 consent message.
 * The private key never leaves the browser — only the signature is returned.
 */
export async function signConsentWithWallet(account, organization, scope, validForSeconds = 3600) {
  const client = createWalletClient({
    account,
    transport: custom(window.ethereum),
  });

  const expiresAt = BigInt(Math.floor(Date.now() / 1000) + validForSeconds);
  const nonce = BigInt(Date.now()) * 1000n + BigInt(Math.floor(Math.random() * 1000000));

  const message = {
    patient: account,
    organization,
    scope,
    expiresAt,
    nonce,
  };

  const signature = await client.signTypedData({
    account,
    domain: DOMAIN,
    types: TYPES,
    primaryType: "Consent",
    message,
  });

  // Return in the same shape the backend's /consent/sign returned,
  // so the Staff tab consumes it identically.
  return {
    patient: message.patient,
    organization: message.organization,
    scope: message.scope,
    expiresAt: message.expiresAt.toString(),
    nonce: message.nonce.toString(),
    signature,
  };
}