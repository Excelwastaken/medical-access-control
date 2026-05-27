/**
 * Master's dissertation evaluation harness.
 * Runs scenarios S1–S5 from Section 4.8 and produces metrics for tables 4.3 and 4.4.
 *
 * Usage (from backend folder):
 *   npx tsx src/evaluation/run-evaluation.ts
 *
 * Output: evaluation-results.json + console summary.
 */

import fs from "node:fs/promises";
import { keccak256, toBytes } from "viem";
import {
  getOrgRegistry, getRoleManager, getAccessController,
  getWalletClient, getAddress, publicClient,
} from "../services/blockchain.js";
import { EIP712_DOMAIN, CONSENT_TYPES, CONTRACT_ADDRESSES } from "../config/contracts.js";
import { parseAbiItem } from "viem";

const API_BASE = "http://localhost:3000";

// ── Helpers ─────────────────────────────────────────────────────────────

async function signFreshConsent(scope = "Observation", validForSeconds = 3600) {
  const patientWallet = getWalletClient("patient");
  const hospitalAddress = getAddress("hospital");

  const message = {
    patient: getAddress("patient"),
    organization: hospitalAddress,
    scope,
    expiresAt: BigInt(Math.floor(Date.now() / 1000) + validForSeconds),
    nonce: BigInt(Date.now()) * 1000n + BigInt(Math.floor(Math.random() * 1000000)),
  };

  const signature = await patientWallet.signTypedData({
    domain: EIP712_DOMAIN,
    types: CONSENT_TYPES,
    primaryType: "Consent",
    message,
    account: patientWallet.account,
  });

  return {
    patient: message.patient,
    organization: message.organization,
    scope: message.scope,
    expiresAt: message.expiresAt.toString(),
    nonce: message.nonce.toString(),
    signature,
  };
}

async function makeAccessRequest(opts: {
  requiredRole: string;
  recordId: string;
  consent: any;
}) {
  const start = performance.now();
  const res = await fetch(`${API_BASE}/api/access/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      staff: "doctor",
      organization: getAddress("hospital"),
      requiredRole: opts.requiredRole,
      patient: getAddress("patient"),
      recordId: opts.recordId,
      consent: opts.consent,
    }),
  });
  const latencyMs = performance.now() - start;
  const body = await res.json();
  return { status: res.status, body, latencyMs };
}

function percentile(arr: number[], p: number) {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function summarize(label: string, latencies: number[], throughputTps: number) {
  return {
    label,
    samples: latencies.length,
    averageMs: +(latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2),
    p50Ms: +percentile(latencies, 50).toFixed(2),
    p95Ms: +percentile(latencies, 95).toFixed(2),
    maxMs: +Math.max(...latencies).toFixed(2),
    minMs: +Math.min(...latencies).toFixed(2),
    throughputTps: +throughputTps.toFixed(2),
  };
}

// ── Scenarios ───────────────────────────────────────────────────────────

async function scenarioS1_validAccess() {
  console.log("\n── S1: Valid Authorized Access ──");
  const consent = await signFreshConsent();
  const r = await makeAccessRequest({ requiredRole: "DOCTOR", recordId: "record-001", consent });
  const passed = r.status === 200 && r.body.status === "ok" && r.body.record;
  console.log(passed ? "✓ PASS" : "✗ FAIL", `(${r.latencyMs.toFixed(1)}ms)`);
  return { scenario: "S1", expected: "granted + record returned", observed: r.body.status, latencyMs: r.latencyMs, pass: passed };
}

async function scenarioS2_noConsent() {
  console.log("\n── S2: Access Without Valid Consent ──");
  // Forge a signature by having the WRONG account sign (attacker pretending to be patient)
  const attackerWallet = getWalletClient("admin"); // anyone non-patient
  const message = {
    patient: getAddress("patient"),
    organization: getAddress("hospital"),
    scope: "Observation",
    expiresAt: BigInt(Math.floor(Date.now() / 1000) + 3600),
    nonce: BigInt(Date.now()) * 1000n + BigInt(Math.floor(Math.random() * 1000000)),
  };
  const forgedSignature = await attackerWallet.signTypedData({
    domain: EIP712_DOMAIN,
    types: CONSENT_TYPES,
    primaryType: "Consent",
    message,
    account: attackerWallet.account,
  });
  const r = await makeAccessRequest({
    requiredRole: "DOCTOR",
    recordId: "record-001",
    consent: {
      patient: message.patient,
      organization: message.organization,
      scope: message.scope,
      expiresAt: message.expiresAt.toString(),
      nonce: message.nonce.toString(),
      signature: forgedSignature,
    },
  });
  const passed = r.body.status === "denied" && /Invalid signature/.test(r.body.reason ?? "");
  console.log(passed ? "✓ PASS" : "✗ FAIL", "—", r.body.reason ?? r.body.status);
  return { scenario: "S2", expected: "denied (invalid consent)", observed: r.body.reason ?? r.body.status, latencyMs: r.latencyMs, pass: passed };
}

async function scenarioS3_invalidRole() {
  console.log("\n── S3: Access With Invalid Role ──");
  const consent = await signFreshConsent();
  const r = await makeAccessRequest({ requiredRole: "PHARMACIST", recordId: "record-001", consent });
  const passed = r.body.status === "denied" && /role/i.test(r.body.reason ?? "");
  console.log(passed ? "✓ PASS" : "✗ FAIL", "—", r.body.reason ?? r.body.status);
  return { scenario: "S3", expected: "denied (invalid role)", observed: r.body.reason ?? r.body.status, latencyMs: r.latencyMs, pass: passed };
}

async function scenarioS4_loadTest(label: string, requestCount: number) {
  console.log(`\n── S4: Load Test (${label} = ${requestCount} requests) ──`);

  // Pre-generate fresh consents — each needs a unique nonce
  const consents = [];
  for (let i = 0; i < requestCount; i++) {
    consents.push(await signFreshConsent());
  }

  const latencies: number[] = [];
  const errors: string[] = [];
  const start = performance.now();

  // Sequential — Hardhat node is single-threaded; concurrent would queue anyway
  for (let i = 0; i < requestCount; i++) {
    const r = await makeAccessRequest({
      requiredRole: "DOCTOR",
      recordId: "record-001",
      consent: consents[i],
    });
    if (r.body.status === "ok") {
      latencies.push(r.latencyMs);
    } else {
      errors.push(r.body.reason ?? "unknown");
    }
  }

  const totalSec = (performance.now() - start) / 1000;
  const tps = latencies.length / totalSec;
  const summary = summarize(label, latencies, tps);
  console.log(`  avg=${summary.averageMs}ms  p50=${summary.p50Ms}ms  p95=${summary.p95Ms}ms  tps=${summary.throughputTps}  errors=${errors.length}`);
  return { ...summary, errors: errors.length };
}

async function scenarioS5_auditVerification(expectedMinimumEvents: number) {
  console.log("\n── S5: Audit Verification ──");
  const ACCESS_GRANTED = parseAbiItem(
    "event AccessGranted(address indexed organization, address indexed staff, address indexed patient, bytes32 role, string scope, bytes32 recordHash, uint256 timestamp)"
  );
  const logs = await publicClient.getLogs({
    address: CONTRACT_ADDRESSES.accessController as `0x${string}`,
    event: ACCESS_GRANTED,
    args: { patient: getAddress("patient") },
    fromBlock: 0n,
    toBlock: "latest",
  });
  const recorded = logs.length;
  const passed = recorded >= expectedMinimumEvents;
  console.log(passed ? "✓ PASS" : "✗ FAIL", `— ${recorded} audit events on chain (expected ≥ ${expectedMinimumEvents})`);
  return { scenario: "S5", recordedEvents: recorded, expectedMinimum: expectedMinimumEvents, pass: passed };
}

// ── Run all ─────────────────────────────────────────────────────────────

async function main() {
  console.log("=".repeat(60));
  console.log("MASTER'S DISSERTATION EVALUATION HARNESS");
  console.log("Section 4.8 — Scenarios S1–S5");
  console.log("=".repeat(60));

  const results: any = { startedAt: new Date().toISOString() };

  // Functional scenarios
  results.S1 = await scenarioS1_validAccess();
  results.S2 = await scenarioS2_noConsent();
  results.S3 = await scenarioS3_invalidRole();

  // Performance — S4 at three load levels
  results.S4_low = await scenarioS4_loadTest("Low load",    10);
  results.S4_med = await scenarioS4_loadTest("Medium load", 25);
  results.S4_high = await scenarioS4_loadTest("High load",  50);

  // Audit verification — should reflect all successful S1 + S4 requests
  const expectedAuditEvents = 1 + 10 + 25 + 50; // S1 + S4 low + med + high
  results.S5 = await scenarioS5_auditVerification(expectedAuditEvents);

  // Aggregate metrics
  const validRequests = 1 + 10 + 25 + 50;
  const correctlyAuthorized = [results.S1, ...["S4_low","S4_med","S4_high"].map(k => ({ pass: results[k].errors === 0 }))].filter(x => x.pass).length;
  const ASR = ((results.S1.pass ? 1 : 0) + results.S4_low.samples + results.S4_med.samples + results.S4_high.samples) / validRequests;
  const DCR = ((results.S2.pass ? 1 : 0) + (results.S3.pass ? 1 : 0)) / 2;
  const AC = results.S5.recordedEvents >= expectedAuditEvents ? 1.0 : results.S5.recordedEvents / expectedAuditEvents;

  results.aggregateMetrics = {
    authorizationSuccessRate: +ASR.toFixed(4),
    denialCorrectnessRate: +DCR.toFixed(4),
    auditCompleteness: +AC.toFixed(4),
  };
  results.finishedAt = new Date().toISOString();

  console.log("\n" + "=".repeat(60));
  console.log("AGGREGATE METRICS");
  console.log("=".repeat(60));
  console.log(`  ASR  (Authorization Success Rate):   ${(ASR * 100).toFixed(2)}%`);
  console.log(`  DCR  (Denial Correctness Rate):      ${(DCR * 100).toFixed(2)}%`);
  console.log(`  AC   (Audit Completeness):           ${(AC * 100).toFixed(2)}%`);

  await fs.writeFile(
    "evaluation-results.json",
    JSON.stringify(results, null, 2)
  );
  console.log("\n✓ Full results written to evaluation-results.json");
}

main().catch((e) => { console.error(e); process.exit(1); });