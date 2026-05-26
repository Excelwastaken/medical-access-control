// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title OrganizationRegistry
 * @notice Maintains the list of healthcare organizations authorized to participate
 *         in the consortium. Only the admin can register or deactivate organizations.
 */
contract OrganizationRegistry {
    address public admin;

    struct Organization {
        string name;        // e.g. "Astana City Hospital"
        bool active;        // can be deactivated without losing history
        uint256 registeredAt;
    }

    // organization address => details
    mapping(address => Organization) public organizations;

    event OrganizationRegistered(address indexed org, string name, uint256 timestamp);
    event OrganizationDeactivated(address indexed org, uint256 timestamp);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    /**
     * @notice Register a new healthcare organization.
     * @param org The blockchain address representing the organization.
     * @param name Human-readable name of the organization.
     */
    function registerOrganization(address org, string calldata name) external onlyAdmin {
        require(org != address(0), "Invalid address");
        require(!organizations[org].active, "Already registered");
        require(bytes(name).length > 0, "Name required");

        organizations[org] = Organization({
            name: name,
            active: true,
            registeredAt: block.timestamp
        });

        emit OrganizationRegistered(org, name, block.timestamp);
    }

    /**
     * @notice Deactivate an organization (e.g. license revoked, breach).
     */
    function deactivateOrganization(address org) external onlyAdmin {
        require(organizations[org].active, "Not active");

        organizations[org].active = false;

        emit OrganizationDeactivated(org, block.timestamp);
    }

    /**
     * @notice Quick check used by other contracts to validate org membership.
     */
    function isActive(address org) external view returns (bool) {
        return organizations[org].active;
    }
}