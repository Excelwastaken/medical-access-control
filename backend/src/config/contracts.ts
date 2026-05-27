/**
 * Deployed contract addresses on local Hardhat node (chainId 31337).
 * Hardhat's deterministic deployment means these are stable across restarts
 * as long as we deploy in the same order.
 */
export const CONTRACT_ADDRESSES = {
  organizationRegistry: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  consentManager: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  roleManager: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
  accessController: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
} as const;

export const CHAIN_ID = 31337;
export const RPC_URL = "http://127.0.0.1:8545";

export const EIP712_DOMAIN = {
  name: "MedicalAccessControl",
  version: "1",
  chainId: CHAIN_ID,
  verifyingContract: CONTRACT_ADDRESSES.consentManager as `0x${string}`,
} as const;

export const CONSENT_TYPES = {
  Consent: [
    { name: "patient", type: "address" },
    { name: "organization", type: "address" },
    { name: "scope", type: "string" },
    { name: "expiresAt", type: "uint256" },
    { name: "nonce", type: "uint256" },
  ],
} as const;