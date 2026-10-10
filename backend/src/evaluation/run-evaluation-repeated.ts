/**
 * Repeated evaluation harness for reviewer-requested statistical robustness.
 * Runs the full S1–S5 evaluation N times and reports mean, standard
 * deviation, and range for latency/throughput metrics, plus pass/fail
 * counts for functional and security scenarios.
 *
 * Usage (from backend folder):
 *   npx tsx src/evaluation/run-evaluation-repeated.ts
 *
 * Requires: Hardhat node running, contracts deployed, backend running,
 * Postgres running — same as the original harness.
 */

import fs from "node:fs/promises";
import { keccak256, toBytes } from "viem";
import {
  getWalletClient, getAddress, publicClient,
} from "../services/blockchain.js";
import { EIP712_DOMAIN, CONSENT_TYPES, CONTRACT_ADDRESSES } from "../config/contracts.js";
import { parseAbiItem } from "viem";

const API_BASE = "http://localhost:3000";
const REPETITIONS = 10;

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
    domain: EIP712_DOMAIN, types: CONSENT_TYPES, primaryType: "Consent", message, account: patientWallet.account,
  });
  return {
    patient: message.patient, organization: message.organization, scope: message.scope,
    expiresAt: message.expiresAt.toString(), nonce: message.nonce.toString(), signature,
  };
}

async function makeAccessRequest(opts: { requiredRole: string; recordId: string; consent: any }) {
  const start = performance.now();
  const res = await fetch(`${API_BASE}/api/access/request`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      staff: "doctor", organization: getAddress("hospital"), requiredRole: opts.requiredRole,
      patient: getAddress("patient"), recordId: opts.recordId, consent: opts.consent,
    }),
  });
  const latencyMs = performance.now() - start;
  const body = await res.json();
  return { status: res.status, body, latencyMs };
}

async function runLoadBatch(requestCount: number) {
  const consents = [];
  for (let i = 0; i < requestCount; i++) consents.push(await signFreshConsent());
  const latencies: number[] = [];
  const start = performance.now();
  for (let i = 0; i < requestCount; i++) {
    const r = await makeAccessRequest({ requiredRole: "DOCTOR", recordId: "record-001", consent: consents[i] });
    if (r.body.status === "ok") latencies.push(r.latencyMs);
  }
  const totalSec = (performance.now() - start) / 1000;
  return { latencies, tps: latencies.length / totalSec };
}

function stats(arr: number[]) {
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
  const std = Math.sqrt(variance);
  return { mean: +mean.toFixed(2), std: +std.toFixed(2), min: +Math.min(...arr).toFixed(2), max: +Math.max(...arr).toFixed(2) };
}

async function runFullEvaluationOnce(runIndex: number) {
  const results: any = { run: runIndex };

  // S1 — valid access
  const s1consent = await signFreshConsent();
  const s1 = await makeAccessRequest({ requiredRole: "DOCTOR", recordId: "record-001", consent: s1consent });
  results.S1_pass = s1.body.status === "ok";

  // S2 — forged signature
  const attackerWallet = getWalletClient("admin");
  const msg = {
    patient: getAddress("patient"), organization: getAddress("hospital"), scope: "Observation",
    expiresAt: BigInt(Math.floor(Date.now() / 1000) + 3600),
    nonce: BigInt(Date.now()) * 1000n + BigInt(Math.floor(Math.random() * 1000000)),
  };
  const forgedSig = await attackerWallet.signTypedData({ domain: EIP712_DOMAIN, types: CONSENT_TYPES, primaryType: "Consent", message: msg, account: attackerWallet.account });
  const s2 = await makeAccessRequest({
    requiredRole: "DOCTOR", recordId: "record-001",
    consent: { patient: msg.patient, organization: msg.organization, scope: msg.scope, expiresAt: msg.expiresAt.toString(), nonce: msg.nonce.toString(), signature: forgedSig },
  });
  results.S2_pass = s2.body.status === "denied";

  // S3 — invalid role
  const s3consent = await signFreshConsent();
  const s3 = await makeAccessRequest({ requiredRole: "PHARMACIST", recordId: "record-001", consent: s3consent });
  results.S3_pass = s3.body.status === "denied";

  // S4 — load at three levels
  const low = await runLoadBatch(10);
  const med = await runLoadBatch(25);
  const high = await runLoadBatch(50);
  results.S4_low = { ...stats(low.latencies), tps: +low.tps.toFixed(2), n: low.latencies.length };
  results.S4_med = { ...stats(med.latencies), tps: +med.tps.toFixed(2), n: med.latencies.length };
  results.S4_high = { ...stats(high.latencies), tps: +high.tps.toFixed(2), n: high.latencies.length };

  // S5 — audit completeness
  const ACCESS_GRANTED = parseAbiItem(
    "event AccessGranted(address indexed organization, address indexed staff, address indexed patient, bytes32 role, string scope, bytes32 recordHash, uint256 timestamp)"
  );
  const logs = await publicClient.getLogs({
    address: CONTRACT_ADDRESSES.accessController as `0x${string}`,
    event: ACCESS_GRANTED, args: { patient: getAddress("patient") }, fromBlock: 0n, toBlock: "latest",
  });
  results.S5_totalEventsOnChain = logs.length;

  return results;
}

async function main() {
  console.log(`Running ${REPETITIONS} full repetitions of S1–S5...\n`);
  const allRuns = [];
  for (let i = 1; i <= REPETITIONS; i++) {
    console.log(`--- Run ${i}/${REPETITIONS} ---`);
    const r = await runFullEvaluationOnce(i);
    console.log(`  S1=${r.S1_pass} S2=${r.S2_pass} S3=${r.S3_pass}  low.mean=${r.S4_low.mean}ms med.mean=${r.S4_med.mean}ms high.mean=${r.S4_high.mean}ms`);
    allRuns.push(r);
  }

  // Aggregate across runs
  const asr = allRuns.filter(r => r.S1_pass).length / allRuns.length;
  const dcrS2 = allRuns.filter(r => r.S2_pass).length / allRuns.length;
  const dcrS3 = allRuns.filter(r => r.S3_pass).length / allRuns.length;

  const meansLow = allRuns.map(r => r.S4_low.mean);
  const meansMed = allRuns.map(r => r.S4_med.mean);
  const meansHigh = allRuns.map(r => r.S4_high.mean);
  const tpsLow = allRuns.map(r => r.S4_low.tps);
  const tpsMed = allRuns.map(r => r.S4_med.tps);
  const tpsHigh = allRuns.map(r => r.S4_high.tps);

  const summary = {
    repetitions: REPETITIONS,
    ASR: asr,
    DCR_forgedSignature: dcrS2,
    DCR_invalidRole: dcrS3,
    latency_low_ms: stats(meansLow),
    latency_med_ms: stats(meansMed),
    latency_high_ms: stats(meansHigh),
    tps_low: stats(tpsLow),
    tps_med: stats(tpsMed),
    tps_high: stats(tpsHigh),
  };

  console.log("\n============================================================");
  console.log(`AGGREGATE ACROSS ${REPETITIONS} REPETITIONS`);
  console.log("============================================================");
  console.log(JSON.stringify(summary, null, 2));

  await fs.writeFile("evaluation-results-repeated.json", JSON.stringify({ allRuns, summary }, null, 2));
  console.log("\n✓ Full results written to evaluation-results-repeated.json");
}

main().catch((e) => { console.error(e); process.exit(1); });