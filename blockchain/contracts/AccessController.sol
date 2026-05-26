// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./OrganizationRegistry.sol";
import "./RoleManager.sol";
import "./ConsentManager.sol";

/**
 * @title AccessController
 * @notice The orchestrator. Validates organization membership, staff role,
 *         and patient-signed consent. Emits an immutable AccessGranted event
 *         that serves as the on-chain audit trail.
 */
contract AccessController {
    OrganizationRegistry public immutable orgRegistry;
    RoleManager public immutable roleManager;
    ConsentManager public immutable consentManager;

    /**
     * @notice The audit event. Indexed fields make on-chain queries efficient
     *         (patient can list all their access history, auditor can filter by org).
     */
    event AccessGranted(
        address indexed organization,
        address indexed staff,
        address indexed patient,
        bytes32 role,
        string scope,
        bytes32 recordHash,
        uint256 timestamp
    );

    constructor(
        address registryAddress,
        address roleManagerAddress,
        address consentManagerAddress
    ) {
        orgRegistry = OrganizationRegistry(registryAddress);
        roleManager = RoleManager(roleManagerAddress);
        consentManager = ConsentManager(consentManagerAddress);
    }

    /**
     * @notice Authorize an access request. Reverts unless ALL checks pass.
     * @param organization The org the staff member is acting on behalf of.
     * @param staff The staff member requesting access.
     * @param requiredRole The role the staff must hold (e.g. keccak256("DOCTOR")).
     * @param patient The patient whose record is being accessed.
     * @param scope The FHIR resource type being accessed (must match consent).
     * @param recordHash A reference hash for the record (off-chain).
     * @param expiresAt The expiry timestamp from the patient's signed consent.
     * @param nonce The nonce from the patient's signed consent.
     * @param signature The patient's EIP-712 signature.
     */
    function authorizeAccess(
        address organization,
        address staff,
        bytes32 requiredRole,
        address patient,
        string calldata scope,
        bytes32 recordHash,
        uint256 expiresAt,
        uint256 nonce,
        bytes calldata signature
    ) external {
        // Check 1: organization must be active in the consortium.
        require(orgRegistry.isActive(organization), "Organization not active");

        // Check 2: staff must hold the required role at this organization.
        require(
            roleManager.hasRole(organization, staff, requiredRole),
            "Staff lacks required role"
        );

        // Check 3: patient consent must verify cryptographically.
        // verifyConsent() reverts on failure, so we only proceed if it succeeds.
        consentManager.verifyConsent(
            patient,
            organization,
            scope,
            expiresAt,
            nonce,
            signature
        );

        // All checks passed — emit the immutable audit event.
        emit AccessGranted(
            organization,
            staff,
            patient,
            requiredRole,
            scope,
            recordHash,
            block.timestamp
        );
    }
}