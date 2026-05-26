// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./OrganizationRegistry.sol";

/**
 * @title RoleManager
 * @notice Tracks staff role assignments scoped to a specific organization.
 *         A staff member's role only has meaning within their organization —
 *         being a "doctor" at Hospital A does NOT grant rights at Hospital B.
 */
contract RoleManager {
    // Roles are stored as bytes32 hashes for gas efficiency.
    // Use keccak256("DOCTOR"), keccak256("NURSE"), keccak256("AUDITOR"), etc.

    OrganizationRegistry public immutable orgRegistry;

    // organization => staff address => role hash
    mapping(address => mapping(address => bytes32)) public roles;

    event RoleAssigned(
        address indexed organization,
        address indexed staff,
        bytes32 indexed role,
        uint256 timestamp
    );

    event RoleRevoked(
        address indexed organization,
        address indexed staff,
        uint256 timestamp
    );

    constructor(address registryAddress) {
        orgRegistry = OrganizationRegistry(registryAddress);
    }

    /**
     * @notice Assign a role to a staff member. Only the organization itself
     *         can call this for its own staff (msg.sender == organization).
     */
    function assignRole(address staff, bytes32 role) external {
        require(orgRegistry.isActive(msg.sender), "Org not active");
        require(staff != address(0), "Invalid staff address");
        require(role != bytes32(0), "Invalid role");

        roles[msg.sender][staff] = role;

        emit RoleAssigned(msg.sender, staff, role, block.timestamp);
    }

    /**
     * @notice Revoke a staff member's role.
     */
    function revokeRole(address staff) external {
        require(orgRegistry.isActive(msg.sender), "Org not active");
        require(roles[msg.sender][staff] != bytes32(0), "No role assigned");

        delete roles[msg.sender][staff];

        emit RoleRevoked(msg.sender, staff, block.timestamp);
    }

    /**
     * @notice Check whether a staff member holds a given role at an organization.
     */
    function hasRole(
        address organization,
        address staff,
        bytes32 role
    ) external view returns (bool) {
        return roles[organization][staff] == role;
    }

    /**
     * @notice Get a staff member's current role at an organization (0 if none).
     */
    function getRole(address organization, address staff) external view returns (bytes32) {
        return roles[organization][staff];
    }
}