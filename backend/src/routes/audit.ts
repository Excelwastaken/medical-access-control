import { Router } from "express";
import { parseAbiItem } from "viem";
import { publicClient } from "../services/blockchain.js";
import { CONTRACT_ADDRESSES } from "../config/contracts.js";

const router = Router();

// The AccessGranted event signature, parsed from a Solidity-style declaration.
const ACCESS_GRANTED_EVENT = parseAbiItem(
  "event AccessGranted(address indexed organization, address indexed staff, address indexed patient, bytes32 role, string scope, bytes32 recordHash, uint256 timestamp)"
);

/**
 * GET /api/audit/:patient
 * Returns the full access history for a patient — every time anyone successfully
 * accessed their records, with full context (who, when, what, where).
 *
 * The data comes directly from immutable on-chain events emitted by AccessController.
 */
router.get("/:patient", async (req, res) => {
  try {
    const { patient } = req.params;

    const logs = await publicClient.getLogs({
      address: CONTRACT_ADDRESSES.accessController as `0x${string}`,
      event: ACCESS_GRANTED_EVENT,
      args: { patient: patient as `0x${string}` },
      fromBlock: 0n,
      toBlock: "latest",
    });

    const accessHistory = logs.map((log) => ({
      organization: log.args.organization,
      staff: log.args.staff,
      patient: log.args.patient,
      roleHash: log.args.role,
      scope: log.args.scope,
      recordHash: log.args.recordHash,
      timestamp: log.args.timestamp?.toString(),
      blockNumber: log.blockNumber.toString(),
      transactionHash: log.transactionHash,
    }));

    res.json({
      status: "ok",
      patient,
      totalAccessEvents: accessHistory.length,
      history: accessHistory,
    });
  } catch (err: any) {
    res.status(500).json({
      status: "error",
      error: err.shortMessage || err.message,
    });
  }
});

/**
 * GET /api/audit/by-organization/:organization
 * Returns access events filtered by organization (useful for hospital-side audits).
 */
router.get("/by-organization/:organization", async (req, res) => {
  try {
    const { organization } = req.params;

    const logs = await publicClient.getLogs({
      address: CONTRACT_ADDRESSES.accessController as `0x${string}`,
      event: ACCESS_GRANTED_EVENT,
      args: { organization: organization as `0x${string}` },
      fromBlock: 0n,
      toBlock: "latest",
    });

    const accessHistory = logs.map((log) => ({
      organization: log.args.organization,
      staff: log.args.staff,
      patient: log.args.patient,
      scope: log.args.scope,
      timestamp: log.args.timestamp?.toString(),
      blockNumber: log.blockNumber.toString(),
      transactionHash: log.transactionHash,
    }));

    res.json({
      status: "ok",
      organization,
      totalAccessEvents: accessHistory.length,
      history: accessHistory,
    });
  } catch (err: any) {
    res.status(500).json({
      status: "error",
      error: err.shortMessage || err.message,
    });
  }
});

export default router;