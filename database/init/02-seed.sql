-- Synthetic test data matching the Hardhat test accounts.
-- Patient = Hardhat account #3, Hospital = Hardhat account #1.

INSERT INTO patients (address, full_name, birth_date, gender) VALUES
('0x90F79bf6EB2c4f870365E785982E1f101E93b906', 'Aigerim Bekova',    '1985-03-12', 'female'),
('0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', 'Nurlan Tolegen',    '1972-11-08', 'male'),
('0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc', 'Daria Khassenova',  '1990-06-23', 'female');

INSERT INTO organizations (address, name) VALUES
('0x70997970C51812dc3A010C7d01b50e0d17dc79C8', 'Astana City Hospital'),
('0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', 'National Research Oncology Center');

-- Synthetic medical records for Aigerim Bekova (the "patient" in our tests)
INSERT INTO medical_records (id, patient_address, org_address, resource_type, payload, record_hash) VALUES
(
    'record-001',
    '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    'Observation',
    '{
        "resourceType": "Observation",
        "status": "final",
        "category": "vital-signs",
        "code": "blood-pressure",
        "valueQuantity": {"systolic": 128, "diastolic": 82, "unit": "mmHg"},
        "effectiveDateTime": "2025-11-15T08:30:00Z",
        "performer": "Dr. M. Kassenov"
    }'::jsonb,
    '0x54acfae1bd33bb8f3278121804bfd8e3bbd8dffde8998b4ec715bcb9e8dfbaa1'
),
(
    'record-002',
    '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    'Observation',
    '{
        "resourceType": "Observation",
        "status": "final",
        "category": "laboratory",
        "code": "hemoglobin-a1c",
        "valueQuantity": {"value": 5.8, "unit": "%"},
        "effectiveDateTime": "2025-11-10T14:15:00Z",
        "performer": "Dr. A. Suleimenov"
    }'::jsonb,
    '0xc6acd5f3a7c12b8a1f4d6e9b3a5c8d2e7f1b4a9c6d3e8f5a2b7c4d1e9f6a3b8d'
),
(
    'record-003',
    '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    'DocumentReference',
    '{
        "resourceType": "DocumentReference",
        "status": "current",
        "type": "discharge-summary",
        "date": "2025-10-28T16:00:00Z",
        "description": "Post-operative discharge after laparoscopic cholecystectomy"
    }'::jsonb,
    '0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
);