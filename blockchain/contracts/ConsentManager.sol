// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title ConsentManager
 * @notice Verifies EIP-712 patient-signed consent for medical data access.
 *         The patient signs a structured message off-chain with their private key.
 *         This contract verifies the signature on-chain — no admin can fake consent.
 */
contract ConsentManager is EIP712 {
    using ECDSA for bytes32;

    // The structured message the patient signs.
    // keccak256 of the type definition — required by EIP-712.
    bytes32 private constant CONSENT_TYPEHASH = keccak256(
        "Consent(address patient,address organization,string scope,uint256 expiresAt,uint256 nonce)"
    );

    // Tracks which nonces have already been used (prevents replay attacks).
    // patient address => nonce => used?
    mapping(address => mapping(uint256 => bool)) public usedNonces;

    // Emitted whenever a consent is successfully verified and recorded.
    event ConsentVerified(
        address indexed patient,
        address indexed organization,
        string scope,
        uint256 expiresAt,
        uint256 nonce
    );

    constructor() EIP712("MedicalAccessControl", "1") {}

    /**
     * @notice Verifies a patient's signed consent message.
     * @param patient The address of the patient who signed.
     * @param organization The healthcare organization being granted access.
     * @param scope The FHIR resource type (e.g. "Observation", "Patient").
     * @param expiresAt Unix timestamp when this consent expires.
     * @param nonce Unique number to prevent replay (one-time use per patient).
     * @param signature The patient's EIP-712 signature over the above fields.
     * @return valid True if signature is authentic and consent is still valid.
     */
    function verifyConsent(
        address patient,
        address organization,
        string calldata scope,
        uint256 expiresAt,
        uint256 nonce,
        bytes calldata signature
    ) external returns (bool valid) {
        // Check 1: consent must not be expired.
        require(block.timestamp < expiresAt, "Consent expired");

        // Check 2: nonce must not have been used before.
        require(!usedNonces[patient][nonce], "Nonce already used");

        // Rebuild the exact message the patient signed.
        bytes32 structHash = keccak256(
            abi.encode(
                CONSENT_TYPEHASH,
                patient,
                organization,
                keccak256(bytes(scope)),
                expiresAt,
                nonce
            )
        );

        // Hash it together with EIP-712 domain separator.
        bytes32 digest = _hashTypedDataV4(structHash);

        // Recover the address that signed the message.
        address recovered = digest.recover(signature);

        // Check 3: signer must be the claimed patient.
        require(recovered == patient, "Invalid signature");

        // Mark nonce as used.
        usedNonces[patient][nonce] = true;

        emit ConsentVerified(patient, organization, scope, expiresAt, nonce);

        return true;
    }
}