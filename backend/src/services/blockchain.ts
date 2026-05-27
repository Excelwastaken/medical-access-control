import { createPublicClient, createWalletClient, http, getContract, type WalletClient } from "viem";
import { hardhat } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

import { CONTRACT_ADDRESSES, RPC_URL } from "../config/contracts.js";
import { abi as orgRegistryAbi } from "../abi/OrganizationRegistry.js";
import { abi as roleManagerAbi } from "../abi/RoleManager.js";
import { abi as consentManagerAbi } from "../abi/ConsentManager.js";
import { abi as accessControllerAbi } from "../abi/AccessController.js";

export const TEST_ACCOUNTS = {
  admin:    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  hospital: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  doctor:   "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  patient:  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
} as const;

export const publicClient = createPublicClient({
  chain: hardhat,
  transport: http(RPC_URL),
});

export function getWalletClient(role: keyof typeof TEST_ACCOUNTS) {
  const account = privateKeyToAccount(TEST_ACCOUNTS[role] as `0x${string}`);
  return createWalletClient({
    account,
    chain: hardhat,
    transport: http(RPC_URL),
  });
}

export function getAddress(role: keyof typeof TEST_ACCOUNTS): `0x${string}` {
  return privateKeyToAccount(TEST_ACCOUNTS[role] as `0x${string}`).address;
}

// Contract factories — always include both public + wallet so write methods are always available.
// If no wallet is needed, just don't call .write methods.
export function getOrgRegistry(walletClient: WalletClient = getWalletClient("admin")) {
  return getContract({
    address: CONTRACT_ADDRESSES.organizationRegistry as `0x${string}`,
    abi: orgRegistryAbi,
    client: { public: publicClient, wallet: walletClient },
  });
}

export function getRoleManager(walletClient: WalletClient = getWalletClient("admin")) {
  return getContract({
    address: CONTRACT_ADDRESSES.roleManager as `0x${string}`,
    abi: roleManagerAbi,
    client: { public: publicClient, wallet: walletClient },
  });
}

export function getConsentManager(walletClient: WalletClient = getWalletClient("admin")) {
  return getContract({
    address: CONTRACT_ADDRESSES.consentManager as `0x${string}`,
    abi: consentManagerAbi,
    client: { public: publicClient, wallet: walletClient },
  });
}

export function getAccessController(walletClient: WalletClient = getWalletClient("admin")) {
  return getContract({
    address: CONTRACT_ADDRESSES.accessController as `0x${string}`,
    abi: accessControllerAbi,
    client: { public: publicClient, wallet: walletClient },
  });
}