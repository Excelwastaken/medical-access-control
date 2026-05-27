import { Router } from "express";
import { keccak256, toBytes } from "viem";
import {
  getAccessController,
  getWalletClient,
  getAddress,
  publicClient,
} from "../services/blockchain.js";
import { getMedicalRecord } from "../services/database.js";

const router = Router();

router.post("/request", async (req, res) => {
  try {
    const { staff, organization, requiredRole, patient, recordId, consent } = req.body;

    if (!staff || !organization || !requiredRole || !patient || !recordId || !consent) {
      return res.status(400).json({
        error: "staff, organization, requiredRole, patient, recordId, and consent are required",
      });
    }

    // ── Step 1: On-chain authorization ────────────────────────────────────
    const staffWallet = getWalletClient(staff);
    const accessController = getAccessController(staffWallet);

    const roleHash = keccak256(toBytes(requiredRole));
    const recordHash = keccak256(toBytes(recordId));

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

    // ── Step 2: Off-chain record retrieval (only if authorization succeeded) ──
    const record = await getMedicalRecord(recordId);

    if (!record) {
      return res.status(404).json({
        status: "error",
        error: "Authorization succeeded but record not found in off-chain storage",
        transaction: { hash: txHash, blockNumber: receipt.blockNumber.toString() },
      });
    }

    // ── Step 3: Verify on-chain hash matches off-chain record ─────────────
    // The hash stored on-chain when the record was created should match
    // a re-computation now. Mismatch = tamper detection.
    const expectedHash = keccak256(toBytes(record.id));
    const hashesMatch = expectedHash === record.recordHash;

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
      integrity: {
        recordHashOnChain: recordHash,
        recordHashOffChain: record.recordHash,
        tamperCheck: hashesMatch ? "verified" : "MISMATCH — possible tampering",
      },
      record: {
        id: record.id,
        resourceType: record.resourceType,
        patientAddress: record.patientAddress,
        payload: record.payload,
      },
    });
  } catch (err: any) {
    res.status(403).json({
      status: "denied",
      reason: err.shortMessage || err.message,
    });
  }
});

export default router;