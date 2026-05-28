import { useState, useEffect } from "react";
import { api, ACCOUNTS } from "./api";
import { hasWallet, connectWallet, getChainId, signConsentWithWallet } from "./wallet";


function Result({ data }) {
  if (!data) return null;
  const cls = data.status === "ok" ? "ok" : data.status === "denied" ? "denied" : "error";
  return <div className={`result ${cls}`}>{JSON.stringify(data, null, 2)}</div>;
}

// ── Admin panel ────────────────────────────────────────────
function AdminPanel() {
  const [orgAddr, setOrgAddr] = useState(ACCOUNTS.hospital.address);
  const [orgName, setOrgName] = useState("Astana City Hospital");
  const [regResult, setRegResult] = useState(null);

  const [lookupAddr, setLookupAddr] = useState(ACCOUNTS.hospital.address);
  const [lookupResult, setLookupResult] = useState(null);

  const [staffAddr, setStaffAddr] = useState(ACCOUNTS.doctor.address);
  const [role, setRole] = useState("DOCTOR");
  const [roleResult, setRoleResult] = useState(null);

  const run = (fn, setter) => async () => {
    try { setter(await fn()); }
    catch (e) { setter({ status: "error", error: e.message }); }
  };

  return (
    <div className="grid">
      <div className="card">
        <h2>Register organization</h2>
        <p className="hint">Admin adds a hospital to the consortium.</p>
        <label>Organization address</label>
        <input value={orgAddr} onChange={(e) => setOrgAddr(e.target.value)} className="mono" />
        <label>Name</label>
        <input value={orgName} onChange={(e) => setOrgName(e.target.value)} />
        <button className="action" onClick={run(() => api.registerOrg(orgAddr, orgName), setRegResult)}>
          Register
        </button>
        <Result data={regResult} />
      </div>

      <div className="card">
        <h2>Look up organization</h2>
        <p className="hint">Check whether an org is active on-chain.</p>
        <label>Organization address</label>
        <input value={lookupAddr} onChange={(e) => setLookupAddr(e.target.value)} className="mono" />
        <button className="action" onClick={run(() => api.lookupOrg(lookupAddr), setLookupResult)}>
          Look up
        </button>
        <Result data={lookupResult} />
      </div>

      <div className="card full">
        <h2>Assign staff role</h2>
        <p className="hint">The hospital assigns a role to a staff member. Roles are scoped to the issuing organization.</p>
        <label>Staff address</label>
        <input value={staffAddr} onChange={(e) => setStaffAddr(e.target.value)} className="mono" />
        <label>Role</label>
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option>DOCTOR</option>
          <option>NURSE</option>
          <option>PHARMACIST</option>
          <option>AUDITOR</option>
        </select>
        <button className="action" onClick={run(() => api.assignRole("hospital", staffAddr, role), setRoleResult)}>
          Assign role (as hospital)
        </button>
        <Result data={roleResult} />
      </div>
    </div>
  );
}

// ── Patient panel ──────────────────────────────────────────
function PatientPanel({ onConsentSigned }) {
  const [account, setAccount] = useState(null);
  const [chainOk, setChainOk] = useState(true);
  const [org, setOrg] = useState(ACCOUNTS.hospital.address);
  const [scope, setScope] = useState("Observation");
  const [consentResult, setConsentResult] = useState(null);
  const [audit, setAudit] = useState(null);
  const [busy, setBusy] = useState(false);

  const connect = async () => {
    try {
      const addr = await connectWallet();
      setAccount(addr);
      const cid = await getChainId();
      setChainOk(cid === 31337);
    } catch (e) {
      setConsentResult({ status: "error", error: e.message });
    }
  };

  const sign = async () => {
    setBusy(true);
    setConsentResult(null);
    try {
      const cid = await getChainId();
      if (cid !== 31337) {
        setChainOk(false);
        throw new Error("MetaMask is not on the Hardhat Local network (chainId 31337).");
      }
      const consent = await signConsentWithWallet(account, org, scope);
      setConsentResult({ status: "ok", consent });
      onConsentSigned(consent);
    } catch (e) {
      setConsentResult({ status: "error", error: e.shortMessage || e.message });
    } finally {
      setBusy(false);
    }
  };

  const loadAudit = async () => {
    const addr = account || ACCOUNTS.patient.address;
    try { setAudit(await api.auditByPatient(addr)); }
    catch (e) { setAudit({ status: "error", error: e.message }); }
  };

  const noWallet = !hasWallet();

  return (
    <div className="grid">
      <div className="card">
        <h2>Sign consent</h2>
        <p className="hint">
          The patient signs an EIP-712 consent with their own MetaMask wallet. The private key never
          leaves the browser — the backend cannot forge this signature.
        </p>

        {noWallet && (
          <div className="result error">MetaMask not detected. Install the browser extension and reload.</div>
        )}

        {!noWallet && !account && (
          <button className="action" onClick={connect}>Connect MetaMask</button>
        )}

        {account && (
          <>
            <div className="result ok" style={{ marginTop: 0 }}>
              Connected: {account}
              {!chainOk && "  ⚠ wrong network — switch MetaMask to Hardhat Local"}
            </div>
            <label>Organization (grantee)</label>
            <input value={org} onChange={(e) => setOrg(e.target.value)} className="mono" />
            <label>Data scope (FHIR resource)</label>
            <select value={scope} onChange={(e) => setScope(e.target.value)}>
              <option>Observation</option>
              <option>DocumentReference</option>
              <option>Patient</option>
            </select>
            <button className="action" onClick={sign} disabled={busy || !chainOk}>
              {busy ? "Waiting for MetaMask…" : "Sign consent in MetaMask"}
            </button>
          </>
        )}

        <Result data={consentResult} />
      </div>

      <div className="card">
        <h2>My access history</h2>
        <p className="hint">Every time someone accessed your records — read directly from immutable on-chain audit events.</p>
        <button className="action" onClick={loadAudit}>Load my audit log</button>
        {audit?.status === "ok" && (
          <div style={{ marginTop: 14 }}>
            <p className="hint">Total events: <strong>{audit.totalAccessEvents}</strong></p>
            {audit.history.map((h, i) => (
              <div className="audit-row" key={i}>
                <div><span className="badge ok">{h.scope}</span> accessed by staff</div>
                <div className="meta">staff: {h.staff}</div>
                <div className="meta">block #{h.blockNumber} · tx {h.transactionHash.slice(0, 18)}…</div>
              </div>
            ))}
          </div>
        )}
        {audit && audit.status !== "ok" && <Result data={audit} />}
      </div>
    </div>
  );
}
// ── Staff panel ────────────────────────────────────────────
function StaffPanel({ lastConsent }) {
  const [consentJson, setConsentJson] = useState("");
  const [recordId, setRecordId] = useState("record-001");
  const [requiredRole, setRequiredRole] = useState("DOCTOR");
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (lastConsent) setConsentJson(JSON.stringify(lastConsent, null, 2));
  }, [lastConsent]);

  const submit = async () => {
    try {
      const consent = JSON.parse(consentJson);
      const payload = {
        staff: "doctor",
        organization: ACCOUNTS.hospital.address,
        requiredRole,
        patient: consent.patient,
        recordId,
        consent,
      };
      setResult(await api.requestAccess(payload));
    } catch (e) {
      setResult({ status: "error", error: e.message });
    }
  };

  return (
    <div className="grid">
      <div className="card full">
        <h2>Request medical record</h2>
        <p className="hint">
          Staff submits a patient's signed consent to request a record. The gateway calls the AccessController
          on-chain (org check → role check → signature check), and only returns the record if all pass.
        </p>
        <label>Patient consent (paste, or auto-filled from Patient tab)</label>
        <textarea rows={9} value={consentJson} onChange={(e) => setConsentJson(e.target.value)}
          placeholder="Sign a consent in the Patient tab first, or paste a consent object here." />
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label>Record ID</label>
            <input value={recordId} onChange={(e) => setRecordId(e.target.value)} className="mono" />
          </div>
          <div style={{ flex: 1 }}>
            <label>Required role</label>
            <select value={requiredRole} onChange={(e) => setRequiredRole(e.target.value)}>
              <option>DOCTOR</option>
              <option>NURSE</option>
              <option>PHARMACIST</option>
            </select>
          </div>
        </div>
        <button className="action" onClick={submit} disabled={!consentJson}>Request access</button>
        <Result data={result} />
      </div>
    </div>
  );
}

// ── Root ───────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("admin");
  const [health, setHealth] = useState(null);
  const [lastConsent, setLastConsent] = useState(null);

  useEffect(() => {
    const check = () => api.health().then(setHealth).catch(() => setHealth(null));
    check();
    const id = setInterval(check, 5000);
    return () => clearInterval(id);
  }, []);

  const connected = health?.blockchain?.connected;

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>Decentralized Medical Access Control</h1>
          <div className="sub">Blockchain-based authorization &amp; immutable audit · research prototype</div>
        </div>
        <div className="status">
          <span className={`dot ${connected ? "ok" : "bad"}`} />
          {connected ? `chain ${health.blockchain.chainId} · block ${health.blockchain.currentBlock}` : "disconnected"}
        </div>
      </header>

      <nav className="tabs">
        <button className={`tab ${tab === "admin" ? "active" : ""}`} onClick={() => setTab("admin")}>Admin</button>
        <button className={`tab ${tab === "patient" ? "active" : ""}`} onClick={() => setTab("patient")}>Patient</button>
        <button className={`tab ${tab === "staff" ? "active" : ""}`} onClick={() => setTab("staff")}>Staff</button>
      </nav>

      {tab === "admin" && <AdminPanel />}
      {tab === "patient" && <PatientPanel onConsentSigned={setLastConsent} />}
      {tab === "staff" && <StaffPanel lastConsent={lastConsent} />}
    </div>
  );
}