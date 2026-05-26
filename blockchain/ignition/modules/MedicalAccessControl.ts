import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Deploys the four contracts in the correct order:
 *   1. OrganizationRegistry (no dependencies)
 *   2. ConsentManager (no dependencies)
 *   3. RoleManager (depends on OrganizationRegistry)
 *   4. AccessController (depends on all three above)
 */
export default buildModule("MedicalAccessControl", (m) => {
  const orgRegistry = m.contract("OrganizationRegistry");
  const consentManager = m.contract("ConsentManager");

  const roleManager = m.contract("RoleManager", [orgRegistry]);

  const accessController = m.contract("AccessController", [
    orgRegistry,
    roleManager,
    consentManager,
  ]);

  return { orgRegistry, consentManager, roleManager, accessController };
});