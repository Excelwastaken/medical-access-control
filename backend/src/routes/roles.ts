import { Router } from "express";
import { keccak256, toBytes } from "viem";
import { getRoleManager, getWalletClient, publicClient } from "../services/blockchain.js";

const router = Router();

/**
 * POST /api/roles/assign
 * Body: { hospital: "hospital", staffAddress: "0x...", role: "DOCTOR" }
 * The 'hospital' field is the role key from TEST_ACCOUNTS (e.g. "hospital").
 * In real production this would be authenticated via the hospital's own key.
 */
router.post("/assign", async (req, res) => {
  try {
    const { hospital, staffAddress, role } = req.body;

    if (!hospital || !staffAddress || !role) {
      return res.status(400).json({
        error: "hospital, staffAddress, and role are required",
      });
    }

    const hospitalWallet = getWalletClient(hospital);
    const roleManager = getRoleManager(hospitalWallet);
    const roleHash = keccak256(toBytes(role));

    const txHash = await roleManager.write.assignRole(
      [staffAddress, roleHash],
      { account: hospitalWallet.account, chain: hospitalWallet.chain }
    );
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    res.json({
      status: "ok",
      assignment: {
        organization: hospitalWallet.account.address,
        staff: staffAddress,
        role,
        roleHash,
      },
      transaction: {
        hash: txHash,
        blockNumber: receipt.blockNumber.toString(),
      },
    });
  } catch (err: any) {
    res.status(500).json({
      status: "error",
      error: err.shortMessage || err.message,
    });
  }
});

/**
 * GET /api/roles/:organization/:staff
 * Returns the role hash held by a staff member at a given organization.
 */
router.get("/:organization/:staff", async (req, res) => {
  try {
    const { organization, staff } = req.params;
    const roleManager = getRoleManager();

    const roleHash = await roleManager.read.getRole([
      organization as `0x${string}`,
      staff as `0x${string}`,
    ]);

    res.json({
      status: "ok",
      organization,
      staff,
      roleHash,
      hasRole: roleHash !== "0x0000000000000000000000000000000000000000000000000000000000000000",
    });
  } catch (err: any) {
    res.status(500).json({
      status: "error",
      error: err.shortMessage || err.message,
    });
  }
});

export default router;