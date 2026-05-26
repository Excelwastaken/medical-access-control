import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";
import { keccak256, toBytes } from "viem";

describe("RoleManager", async function () {
  const { viem } = await network.connect();

  // Helper: convert role string to bytes32 hash
  const DOCTOR = keccak256(toBytes("DOCTOR"));
  const NURSE = keccak256(toBytes("NURSE"));

  async function deployFixture() {
    const [admin, hospital, doctor, nurse, attacker] = await viem.getWalletClients();

    // Deploy registry first
    const registry = await viem.deployContract("OrganizationRegistry");

    // Register the hospital
    await registry.write.registerOrganization([
      hospital.account.address,
      "Astana City Hospital",
    ]);

    // Deploy RoleManager pointing to registry
    const roleManager = await viem.deployContract("RoleManager", [registry.address]);

    return { registry, roleManager, admin, hospital, doctor, nurse, attacker };
  }

  it("allows a registered org to assign a role", async function () {
    const { roleManager, hospital, doctor } = await deployFixture();

    await roleManager.write.assignRole(
      [doctor.account.address, DOCTOR],
      { account: hospital.account }
    );

    const hasRole = await roleManager.read.hasRole([
      hospital.account.address,
      doctor.account.address,
      DOCTOR,
    ]);
    assert.equal(hasRole, true);
  });

  it("rejects role assignment from unregistered org", async function () {
    const { roleManager, attacker, doctor } = await deployFixture();

    await assert.rejects(
      roleManager.write.assignRole(
        [doctor.account.address, DOCTOR],
        { account: attacker.account }
      ),
      /Org not active/
    );
  });

  it("scopes roles to a single organization", async function () {
    const { roleManager, hospital, doctor, attacker } = await deployFixture();

    await roleManager.write.assignRole(
      [doctor.account.address, DOCTOR],
      { account: hospital.account }
    );

    // Doctor has role at hospital, but NOT at attacker's address
    const hasRoleAtOther = await roleManager.read.hasRole([
      attacker.account.address,
      doctor.account.address,
      DOCTOR,
    ]);
    assert.equal(hasRoleAtOther, false);
  });

  it("revokes a previously assigned role", async function () {
    const { roleManager, hospital, doctor } = await deployFixture();

    await roleManager.write.assignRole(
      [doctor.account.address, DOCTOR],
      { account: hospital.account }
    );

    await roleManager.write.revokeRole(
      [doctor.account.address],
      { account: hospital.account }
    );

    const hasRole = await roleManager.read.hasRole([
      hospital.account.address,
      doctor.account.address,
      DOCTOR,
    ]);
    assert.equal(hasRole, false);
  });

  it("distinguishes between different roles", async function () {
    const { roleManager, hospital, doctor } = await deployFixture();

    await roleManager.write.assignRole(
      [doctor.account.address, DOCTOR],
      { account: hospital.account }
    );

    // Doctor has DOCTOR role, not NURSE role
    const isDoctor = await roleManager.read.hasRole([
      hospital.account.address,
      doctor.account.address,
      DOCTOR,
    ]);
    const isNurse = await roleManager.read.hasRole([
      hospital.account.address,
      doctor.account.address,
      NURSE,
    ]);

    assert.equal(isDoctor, true);
    assert.equal(isNurse, false);
  });

  it("blocks role assignment from a deactivated org", async function () {
    const { registry, roleManager, hospital, doctor } = await deployFixture();

    // Deactivate the hospital
    await registry.write.deactivateOrganization([hospital.account.address]);

    await assert.rejects(
      roleManager.write.assignRole(
        [doctor.account.address, DOCTOR],
        { account: hospital.account }
      ),
      /Org not active/
    );
  });
});