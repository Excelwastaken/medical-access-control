import express from "express";
import { publicClient } from "./services/blockchain.js";
import orgRoutes from "./routes/organizations.js";
import roleRoutes from "./routes/roles.js";
import consentRoutes from "./routes/consent.js";
import accessRoutes from "./routes/access.js";

const app = express();
app.use(express.json());

const PORT = 3000;

app.get("/health", async (_req, res) => {
  try {
    const blockNumber = await publicClient.getBlockNumber();
    const chainId = await publicClient.getChainId();
    res.json({
      status: "ok",
      backend: "running",
      blockchain: {
        connected: true,
        chainId,
        currentBlock: blockNumber.toString(),
      },
    });
  } catch (err: any) {
    res.status(500).json({
      status: "error",
      backend: "running",
      blockchain: { connected: false, error: err.message },
    });
  }
});

// Mount API routes
app.use("/api/orgs", orgRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/consent", consentRoutes);
app.use("/api/access", accessRoutes);
app.listen(PORT, () => {
  console.log(`🏥 Medical Access Control gateway listening on http://localhost:${PORT}`);
});