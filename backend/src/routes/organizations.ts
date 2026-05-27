import { Router } from "express";
import { getOrgRegistry, getWalletClient, publicClient } from "../services/blockchain.js";

const router = Router();

/**
 * POST /api/orgs/register
 * Body: { address: "0x...", name: "Hospital Name" }
 */
router.post("/register", async (req, res) => {
  try {
    const { address, name } = req.body;

    if (!address || !name) {
      return res.status(400).json({ error: "address and name are required" });
    }

    const adminWallet = getWalletClient("admin");
    const registry = getOrgRegistry(adminWallet);

    const txHash = await registry.write.registerOrganization(
      [address, name],
      { account: adminWallet.account, chain: adminWallet.chain }
    );
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    res.json({
      status: "ok",
      organization: { address, name },
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
 * GET /api/orgs/:address
 * Returns whether an org is registered and active.
 */
router.get("/:address", async (req, res) => {
  try {
    const { address } = req.params;
    const registry = getOrgRegistry();

    const isActive = await registry.read.isActive([address as `0x${string}`]);
    const org = await registry.read.organizations([address as `0x${string}`]);

    res.json({
      status: "ok",
      address,
      isActive,
      name: org[0],
      registeredAt: org[2].toString(),
    });
  } catch (err: any) {
    res.status(500).json({
      status: "error",
      error: err.shortMessage || err.message,
    });
  }
});

export default router;