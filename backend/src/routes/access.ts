import { Router } from "express";
import { keccak256, toBytes } from "viem";
import {
  getAccessController,
  getWalletClient,
  getAddress,
  publicClient,
} from "../services/blockchain.js";

const router = Router();

/**
 * POST /api/access/request
 * Body: {
 *   staff: "doctor",                    // role key from TEST_ACCOUNTS
 *   organization: "0x...",              // hospital address
 *   requiredRole: "DOCTOR",             // role name (will be hashed)
 *   patient: "0x...",                   // patient address
 *   recordId: "record-001",             // identifier of the medical record
 *   consent: { ...payload from /api/consent/sign }
 * }
 *
 * This is the main enforcement endpoint. It calls AccessController.authorizeAccess()
 * which performs ALL three checks on-chain:
 *   1. Organization is active
 *   2. Staff has required role
 *   3. Patient signature is valid, not expired, not replayed
 *
 * Only if ALL pass does the on-chain audit event get emitted, and only then
 * does the gateway return the record (placeholder for now — PostgreSQL is next).
 */
router.post("/request", async (req, res) => {
  try {
    const { staff, organization, requiredRole, patient, recordId, consent } = req.body;

    if (!staff || !organization || !requiredRole || !patient || !recordId || !consent) {
      return res.status(400).json({
        error: "staff, organization, requiredRole, patient, recordId, and consent are required",
      });
    }

    const staffWallet = getWalletClient(staff);
    const accessController = getAccessController(staffWallet);

    const roleHash = keccak256(toBytes(requiredRole));
    const recordHash = keccak256(toBytes(recordId));

    // Call the on-chain authorization. This will revert if any check fails.
    const txHash = await accessController.write.authorizeAccess(
      [
        organization as `0x${string}`,
        getAddress(staff),
        roleHash,
        patient as `0x${string}`,
        consent.scope,
        recordHash,
        BigInt(consent.expiresAt),
        BigInt(consent.nonce),
        consent.signature as `0x${string}`,
      ],
      { account: staffWallet.account, chain: staffWallet.chain }
    );

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    // Placeholder for off-chain record retrieval (PostgreSQL comes next).
    // In the real system, we'd query the database here using recordId.
    const placeholderRecord = {
      id: recordId,
      type: consent.scope,
      patientId: patient,
      data: "[ENCRYPTED PLACEHOLDER — PostgreSQL integration pending]",
    };

    res.json({
      status: "ok",
      authorization: {
        granted: true,
        organization,
        staff: getAddress(staff),
        patient,
        scope: consent.scope,
      },
      transaction: {
        hash: txHash,
        blockNumber: receipt.blockNumber.toString(),
        auditEventsEmitted: receipt.logs.length,
      },
      record: placeholderRecord,
    });
  } catch (err: any) {
    res.status(403).json({
      status: "denied",
      reason: err.shortMessage || err.message,
    });
  }
});

export default router;