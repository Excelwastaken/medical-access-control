import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";
import { keccak256, toBytes } from "viem";

describe("AccessController", async function () {
  const { viem } = await network.connect();

  const DOCTOR = keccak256(toBytes("DOCTOR"));
  const NURSE = keccak256(toBytes("NURSE"));

  async function deployFixture() {
    const [admin, hospital, doctor, patient, attacker] = await viem.getWalletClients();

    // Deploy all three dependency contracts
    const registry = await viem.deployContract("OrganizationRegistry");
    const roleManager = await viem.deployContract("RoleManager", [registry.address]);
    const consentManager = await viem.deployContract("ConsentManager");

    // Deploy the orchestrator
    const accessController = await viem.deployContract("AccessController", [
      registry.address,
      roleManager.address,
      consentManager.address,
    ]);

    // Set up the scenario:
    // 1. Register the hospital
    await registry.write.registerOrganization([
      hospital.account.address,
      "Astana City Hospital",
    ]);

    // 2. Assign DOCTOR role to the doctor at this hospital
    await roleManager.write.assignRole(
      [doctor.account.address, DOCTOR],
      { account: hospital.account }
    );

    // EIP-712 domain for signing consent
    const publicClient = await viem.getPublicClient();
    const chainId = await publicClient.getChainId();
    const domain = {
      name: "MedicalAccessControl",
      version: "1",
      chainId,
      verifyingContract: consentManager.address,
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

    return {
      registry, roleManager, consentManager, accessController,
      admin, hospital, doctor, patient, attacker, domain, types,
    };
  }

  // Helper: build & sign a consent message
  async function signConsent(patient: any, hospital: any, domain: any, types: any, nonce: bigint, scope = "Observation", offsetSeconds = 3600) {
    const message = {
      patient: patient.account.address,
      organization: hospital.account.address,
      scope,
      expiresAt: BigInt(Math.floor(Date.now() / 1000) + offsetSeconds),
      nonce,
    };
    const signature = await patient.signTypedData({
      domain, types, primaryType: "Consent", message,
    });
    return { message, signature };
  }

  const RECORD_HASH = keccak256(toBytes("record-001"));

  it("authorizes a valid end-to-end request", async function () {
    const { accessController, hospital, doctor, patient, domain, types } = await deployFixture();

    const { message, signature } = await signConsent(patient, hospital, domain, types, 1n);

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

    assert.ok(txHash);
  });

  it("rejects access from an unregistered organization", async function () {
    const { accessController, doctor, patient, attacker, domain, types } = await deployFixture();

    // Sign consent for the attacker org (which isn't registered)
    const message = {
      patient: patient.account.address,
      organization: attacker.account.address,
      scope: "Observation",
      expiresAt: BigInt(Math.floor(Date.now() / 1000) + 3600),
      nonce: 2n,
    };
    const signature = await patient.signTypedData({ domain, types, primaryType: "Consent", message });

    await assert.rejects(
      accessController.write.authorizeAccess([
        attacker.account.address, // not registered
        doctor.account.address,
        DOCTOR,
        patient.account.address,
        message.scope,
        RECORD_HASH,
        message.expiresAt,
        message.nonce,
        signature,
      ]),
      /Organization not active/
    );
  });

  it("rejects access when staff lacks the required role", async function () {
    const { accessController, hospital, doctor, patient, domain, types } = await deployFixture();

    // Doctor has DOCTOR role, but we'll require NURSE
    const { message, signature } = await signConsent(patient, hospital, domain, types, 3n);

    await assert.rejects(
      accessController.write.authorizeAccess([
        hospital.account.address,
        doctor.account.address,
        NURSE, // doctor doesn't have this role
        patient.account.address,
        message.scope,
        RECORD_HASH,
        message.expiresAt,
        message.nonce,
        signature,
      ]),
      /Staff lacks required role/
    );
  });

  it("rejects access with a forged patient signature", async function () {
    const { accessController, hospital, doctor, patient, attacker, domain, types } = await deployFixture();

    // Attacker signs pretending to be patient
    const message = {
      patient: patient.account.address,
      organization: hospital.account.address,
      scope: "Observation",
      expiresAt: BigInt(Math.floor(Date.now() / 1000) + 3600),
      nonce: 4n,
    };
    const forgedSignature = await attacker.signTypedData({ domain, types, primaryType: "Consent", message });

    await assert.rejects(
      accessController.write.authorizeAccess([
        hospital.account.address,
        doctor.account.address,
        DOCTOR,
        patient.account.address,
        message.scope,
        RECORD_HASH,
        message.expiresAt,
        message.nonce,
        forgedSignature,
      ]),
      /Invalid signature/
    );
  });

  it("rejects access with expired consent", async function () {
    const { accessController, hospital, doctor, patient, domain, types } = await deployFixture();

    const { message, signature } = await signConsent(patient, hospital, domain, types, 5n, "Observation", -10);

    await assert.rejects(
      accessController.write.authorizeAccess([
        hospital.account.address,
        doctor.account.address,
        DOCTOR,
        patient.account.address,
        message.scope,
        RECORD_HASH,
        message.expiresAt,
        message.nonce,
        signature,
      ]),
      /Consent expired/
    );
  });

  it("rejects a replayed consent nonce", async function () {
    const { accessController, hospital, doctor, patient, domain, types } = await deployFixture();

    const { message, signature } = await signConsent(patient, hospital, domain, types, 6n);

    // First request succeeds
    await accessController.write.authorizeAccess([
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

    // Replay must fail
    await assert.rejects(
      accessController.write.authorizeAccess([
        hospital.account.address,
        doctor.account.address,
        DOCTOR,
        patient.account.address,
        message.scope,
        RECORD_HASH,
        message.expiresAt,
        message.nonce,
        signature,
      ]),
      /Nonce already used/
    );
  });

  it("emits an AccessGranted event on success", async function () {
    const { accessController, hospital, doctor, patient, domain, types } = await deployFixture();
    const publicClient = await viem.getPublicClient();

    const { message, signature } = await signConsent(patient, hospital, domain, types, 7n);

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

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    assert.equal(receipt.logs.length > 0, true, "Expected at least one event");
  });
});