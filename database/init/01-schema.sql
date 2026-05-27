-- Medical Records Schema
-- FHIR-inspired structure for synthetic medical data
-- Used by the AccessController off-chain storage layer

CREATE TABLE patients (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    address     TEXT UNIQUE NOT NULL,  -- blockchain address of the patient
    full_name   TEXT NOT NULL,
    birth_date  DATE,
    gender      TEXT,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE organizations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    address     TEXT UNIQUE NOT NULL,  -- blockchain address of the org
    name        TEXT NOT NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Medical records — modeled loosely after FHIR resources
CREATE TABLE medical_records (
    id              TEXT PRIMARY KEY,                -- e.g. "record-001" — matches recordId in API
    patient_address TEXT NOT NULL REFERENCES patients(address),
    org_address     TEXT NOT NULL REFERENCES organizations(address),
    resource_type   TEXT NOT NULL,                   -- "Observation", "Patient", "DocumentReference"
    payload         JSONB NOT NULL,                  -- the actual record contents (FHIR-style)
    record_hash     TEXT NOT NULL,                   -- keccak256(id) — links to on-chain reference
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_records_patient ON medical_records(patient_address);
CREATE INDEX idx_records_org     ON medical_records(org_address);
CREATE INDEX idx_records_type    ON medical_records(resource_type);