import { Router } from "express";
import { getWalletClient, getAddress } from "../services/blockchain.js";
import { EIP712_DOMAIN, CONSENT_TYPES } from "../config/contracts.js";

const router = Router();

/**
 * POST /api/consent/sign
 * Body: { patient: "patient", organization: "0x...", scope: "Observation", validForSeconds?: number }
 *
 * The patient signs an EIP-712 consent message off-chain.
 * Returns the signed payload (the hospital will submit it on the access request).
 *
 * NOTE: In a production system, the patient would sign with their own wallet
 * (MetaMask, hardware wallet, etc.) — not server-side. This is a prototype simulation.
 */
router.post("/sign", async (req, res) => {
  try {
    const { patient, organization, scope, validForSeconds } = req.body;

    if (!patient || !organization || !scope) {
      return res.status(400).json({
        error: "patient, organization, and scope are required",
      });
    }

    const patientWallet = getWalletClient(patient);
    const patientAddress = getAddress(patient);

    const expiresAt = BigInt(
      Math.floor(Date.now() / 1000) + (validForSeconds ?? 3600)
    );
    // Unique nonce — combines timestamp with random component
    const nonce = BigInt(Date.now()) * 1000n + BigInt(Math.floor(Math.random() * 1000));

    const message = {
      patient: patientAddress,
      organization: organization as `0x${string}`,
      scope,
      expiresAt,
      nonce,
    };

    const signature = await patientWallet.signTypedData({
      domain: EIP712_DOMAIN,
      types: CONSENT_TYPES,
      primaryType: "Consent",
      message,
      account: patientWallet.account,
    });

    res.json({
      status: "ok",
      consent: {
        patient: message.patient,
        organization: message.organization,
        scope: message.scope,
        expiresAt: message.expiresAt.toString(),
        nonce: message.nonce.toString(),
        signature,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      status: "error",
      error: err.shortMessage || err.message,
    });
  }
});

export default router;