// Thin wrapper around the gateway API. All calls go through the Vite proxy.

async function handle(res) {
  const data = await res.json();
  if (!res.ok && data.status !== "denied") {
    throw new Error(data.error || data.reason || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  health: () => fetch("/health").then(handle),

  // ── Admin ──────────────────────────────────────────
  registerOrg: (address, name) =>
    fetch("/api/orgs/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, name }),
    }).then(handle),

  lookupOrg: (address) => fetch(`/api/orgs/${address}`).then(handle),

  assignRole: (hospital, staffAddress, role) =>
    fetch("/api/roles/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hospital, staffAddress, role }),
    }).then(handle),

  lookupRole: (organization, staff) =>
    fetch(`/api/roles/${organization}/${staff}`).then(handle),

  // ── Patient ────────────────────────────────────────
  signConsent: (patient, organization, scope) =>
    fetch("/api/consent/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patient, organization, scope }),
    }).then(handle),

  auditByPatient: (patient) => fetch(`/api/audit/${patient}`).then(handle),

  auditByOrg: (organization) =>
    fetch(`/api/audit/by-organization/${organization}`).then(handle),

  // ── Staff ──────────────────────────────────────────
  requestAccess: (payload) =>
    fetch("/api/access/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(handle),
};

// The seeded demo accounts (from Hardhat deterministic accounts).
export const ACCOUNTS = {
  admin:    { key: "admin",    address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" },
  hospital: { key: "hospital", address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" },
  doctor:   { key: "doctor",   address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" },
  patient:  { key: "patient",  address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906" },
};