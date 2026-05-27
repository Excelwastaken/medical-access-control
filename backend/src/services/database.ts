import pg from "pg";

const { Pool } = pg;

/**
 * Connection pool for the off-chain medical records database.
 * Matches the credentials in database/docker-compose.yml.
 */
export const db = new Pool({
  host: "localhost",
  port: 5433,
  user: "medical_user",
  password: "medical_pass",
  database: "medical_records",
});

/**
 * Fetch a medical record by its ID.
 * Returns null if not found.
 */
export async function getMedicalRecord(recordId: string) {
  const result = await db.query(
    `SELECT id, patient_address, org_address, resource_type, payload, record_hash, created_at
     FROM medical_records
     WHERE id = $1`,
    [recordId]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    patientAddress: row.patient_address,
    organizationAddress: row.org_address,
    resourceType: row.resource_type,
    payload: row.payload,
    recordHash: row.record_hash,
    createdAt: row.created_at,
  };
}

/**
 * List all records for a patient.
 */
export async function getRecordsForPatient(patientAddress: string) {
  const result = await db.query(
    `SELECT id, resource_type, payload, created_at
     FROM medical_records
     WHERE patient_address = $1
     ORDER BY created_at DESC`,
    [patientAddress]
  );
  return result.rows;
}