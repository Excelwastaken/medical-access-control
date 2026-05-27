export const abi = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "registryAddress",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "roleManagerAddress",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "consentManagerAddress",
        "type": "address"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "organization",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "staff",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "patient",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "scope",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "recordHash",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256"
      }
    ],
    "name": "AccessGranted",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "organization",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "staff",
        "type": "address"
      },
      {
        "internalType": "bytes32",
        "name": "requiredRole",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "patient",
        "type": "address"
      },
      {
        "internalType": "string",
        "name": "scope",
        "type": "string"
      },
      {
        "internalType": "bytes32",
        "name": "recordHash",
        "type": "bytes32"
      },
      {
        "internalType": "uint256",
        "name": "expiresAt",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "nonce",
        "type": "uint256"
      },
      {
        "internalType": "bytes",
        "name": "signature",
        "type": "bytes"
      }
    ],
    "name": "authorizeAccess",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "consentManager",
    "outputs": [
      {
        "internalType": "contract ConsentManager",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "orgRegistry",
    "outputs": [
      {
        "internalType": "contract OrganizationRegistry",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "roleManager",
    "outputs": [
      {
        "internalType": "contract RoleManager",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;
