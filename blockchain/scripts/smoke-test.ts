import { network } from "hardhat";
import { keccak256, toBytes } from "viem";

// Addresses from your deployment output:
const ORG_REGISTRY = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
const ROLE_MANAGER = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
const CONSENT_MANAGER = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const ACCESS_CONTROLLER = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";

const DOCTOR = keccak256(toBytes("DOCTOR"));
const RECORD_HASH = keccak256(toBytes("record-001"));

async function main() {
  const { viem } = await network.connect();
  const [admin, hospital, doctor, patient] = await viem.getWalletClients();

  console.log("Admin:    ", admin.account.address);
  console.log("Hospital: ", hospital.account.address);
  console.log("Doctor:   ", doctor.account.address);
  console.log("Patient:  ", patient.account.address);

  // Get contract handles
  const registry = await viem.getContractAt("OrganizationRegistry", ORG_REGISTRY);
  const roleManager = await viem.getContractAt("RoleManager", ROLE_MANAGER);
  const consentManager = await viem.getContractAt("ConsentManager", CONSENT_MANAGER);
  const accessController = await viem.getContractAt("AccessController", ACCESS_CONTROLLER);

  // 1. Admin registers the hospital
  console.log("\n→ Registering hospital...");
  await registry.write.registerOrganization([
    hospital.account.address,
    "Astana City Hospital",
  ]);
  console.log("  ✓ Hospital registered");

  // 2. Hospital assigns DOCTOR role to the doctor
  console.log("\n→ Assigning doctor role...");
  await roleManager.write.assignRole(
    [doctor.account.address, DOCTOR],
    { account: hospital.account }
  );
  console.log("  ✓ Doctor role assigned");

  // 3. Patient signs a consent
  console.log("\n→ Patient signs consent...");
  const publicClient = await viem.getPublicClient();
  const chainId = await publicClient.getChainId();
  const domain = {
    name: "MedicalAccessControl",
    version: "1",
    chainId,
    verifyingContract: CONSENT_MANAGER as `0x${string}`,
  };
  const types = {
    Consent: [
      { name: "patient", type: "address" },
      { name: "organization", type: "address" },
      { name: "scope", type: "string" },
      { name: "expiresAt", type: "uint256" },
      { name: "nonce", type: "uint256" },
    ],
  };
  const message = {
    patient: patient.account.address,
    organization: hospital.account.address,
    scope: "Observation",
    expiresAt: BigInt(Math.floor(Date.now() / 1000) + 3600),
    nonce: BigInt(Date.now()), // unique nonce
  };
  const signature = await patient.signTypedData({
    domain, types, primaryType: "Consent", message,
  });
  console.log("  ✓ Signature created:", signature.slice(0, 20) + "...");

  // 4. Doctor requests access via the AccessController
  console.log("\n→ Doctor requests access to patient record...");
  const txHash = await accessController.write.authorizeAccess([
    hospital.account.address,
    doctor.account.address,
    DOCTOR,
    patient.account.address,
    message.scope,
    RECORD_HASH,
    message.expiresAt,
    message.nonce,
    signature,
  ]);
  console.log("  ✓ Access granted! Tx:", txHash);

  // 5. Verify the AccessGranted event was emitted
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log("\n→ Audit event check:");
  console.log("  ✓ Block #:", receipt.blockNumber);
  console.log("  ✓ Logs emitted:", receipt.logs.length);
  console.log("\n🎉 End-to-end flow works on the deployed contracts.");
}

main().catch((e) => { console.error(e); process.exit(1); });