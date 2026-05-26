import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";

describe("OrganizationRegistry", async function () {
  const { viem } = await network.connect();

  async function deployFixture() {
    const [admin, hospital1, hospital2, attacker] = await viem.getWalletClients();
    const registry = await viem.deployContract("OrganizationRegistry");
    return { registry, admin, hospital1, hospital2, attacker };
  }

  it("registers a new organization", async function () {
    const { registry, hospital1 } = await deployFixture();

    await registry.write.registerOrganization([
      hospital1.account.address,
      "Astana City Hospital",
    ]);

    const isActive = await registry.read.isActive([hospital1.account.address]);
    assert.equal(isActive, true);
  });

  it("rejects registration from non-admin", async function () {
    const { registry, hospital1, attacker } = await deployFixture();

    await assert.rejects(
      registry.write.registerOrganization(
        [hospital1.account.address, "Fake Hospital"],
        { account: attacker.account }
      ),
      /Only admin/
    );
  });

  it("rejects duplicate registration", async function () {
    const { registry, hospital1 } = await deployFixture();

    await registry.write.registerOrganization([
      hospital1.account.address,
      "Astana City Hospital",
    ]);

    await assert.rejects(
      registry.write.registerOrganization([
        hospital1.account.address,
        "Astana City Hospital",
      ]),
      /Already registered/
    );
  });

  it("deactivates an organization", async function () {
    const { registry, hospital1 } = await deployFixture();

    await registry.write.registerOrganization([
      hospital1.account.address,
      "Astana City Hospital",
    ]);

    await registry.write.deactivateOrganization([hospital1.account.address]);

    const isActive = await registry.read.isActive([hospital1.account.address]);
    assert.equal(isActive, false);
  });

  it("rejects empty name", async function () {
    const { registry, hospital1 } = await deployFixture();

    await assert.rejects(
      registry.write.registerOrganization([hospital1.account.address, ""]),
      /Name required/
    );
  });
});