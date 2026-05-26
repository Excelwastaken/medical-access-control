import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";

describe("ConsentManager", async function () {
  const { viem } = await network.connect();

  async function deployFixture() {
    const [admin, patient, hospital, attacker] = await viem.getWalletClients();

    const consentManager = await viem.deployContract("ConsentManager");
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

    return { consentManager, admin, patient, hospital, attacker, domain, types };
  }

  it("accepts a valid patient-signed consent", async function () {
    const { consentManager, patient, hospital, domain, types } = await deployFixture();

    const message = {
      patient: patient.account.address,
      organization: hospital.account.address,
      scope: "Observation",
      expiresAt: BigInt(Math.floor(Date.now() / 1000) + 3600),
      nonce: 1n,
    };

    const signature = await patient.signTypedData({
      domain,
      types,
      primaryType: "Consent",
      message,
    });

    const txHash = await consentManager.write.verifyConsent([
      message.patient,
      message.organization,
      message.scope,
      message.expiresAt,
      message.nonce,
      signature,
    ]);

    assert.ok(txHash);

    const isUsed = await consentManager.read.usedNonces([message.patient, message.nonce]);
    assert.equal(isUsed, true);
  });

  it("rejects a forged signature from an attacker", async function () {
    const { consentManager, patient, hospital, attacker, domain, types } = await deployFixture();

    const message = {
      patient: patient.account.address,
      organization: hospital.account.address,
      scope: "Observation",
      expiresAt: BigInt(Math.floor(Date.now() / 1000) + 3600),
      nonce: 2n,
    };

    const forgedSignature = await attacker.signTypedData({
      domain,
      types,
      primaryType: "Consent",
      message,
    });

    await assert.rejects(
      consentManager.write.verifyConsent([
        message.patient,
        message.organization,
        message.scope,
        message.expiresAt,
        message.nonce,
        forgedSignature,
      ]),
      /Invalid signature/
    );
  });

  it("rejects an expired consent", async function () {
    const { consentManager, patient, hospital, domain, types } = await deployFixture();

    const message = {
      patient: patient.account.address,
      organization: hospital.account.address,
      scope: "Observation",
      expiresAt: BigInt(Math.floor(Date.now() / 1000) - 10),
      nonce: 3n,
    };

    const signature = await patient.signTypedData({
      domain,
      types,
      primaryType: "Consent",
      message,
    });

    await assert.rejects(
      consentManager.write.verifyConsent([
        message.patient,
        message.organization,
        message.scope,
        message.expiresAt,
        message.nonce,
        signature,
      ]),
      /Consent expired/
    );
  });

  it("rejects a replayed nonce", async function () {
    const { consentManager, patient, hospital, domain, types } = await deployFixture();

    const message = {
      patient: patient.account.address,
      organization: hospital.account.address,
      scope: "Observation",
      expiresAt: BigInt(Math.floor(Date.now() / 1000) + 3600),
      nonce: 4n,
    };

    const signature = await patient.signTypedData({
      domain,
      types,
      primaryType: "Consent",
      message,
    });

    await consentManager.write.verifyConsent([
      message.patient,
      message.organization,
      message.scope,
      message.expiresAt,
      message.nonce,
      signature,
    ]);

    await assert.rejects(
      consentManager.write.verifyConsent([
        message.patient,
        message.organization,
        message.scope,
        message.expiresAt,
        message.nonce,
        signature,
      ]),
      /Nonce already used/
    );
  });
});