/**
 * ChainMind Synapse — State Store & Chain Event Simulator
 * Strict adherence to SCHEMA.html (NormalizedClaim, GET /v1/identity/{subject}, verify_hash.py preimage)
 */

export class StateStore {
  constructor() {
    this.listeners = [];
    this.activeScenario = 'revocation-conflict';
    this.subject = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
    this.subjectDid = 'did:ethr:sepolia:0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
    this.modelVersion = '0x9a8f23b1c70e284910294877c86519284fa8e9102c7a2b9109318b76e1029384';
    this.issuedAt = 1750000100;
    this.claims = [];
    this.commitId = '0xef0284ac918801237a884910294877c86519284f11';
    this.stateHash = '0x221a9102c7a2b9109318b76e1029384918237999';
    this.settlementTx = '0x71ba9842f1b0a99c43e019385834892c9029a8f2';
    this.isTampered = false;

    this.init();
  }

  init() {
    this.loadScenario('revocation-conflict');
  }

  subscribe(listener) {
    this.listeners.push(listener);
  }

  notify() {
    this.listeners.forEach(fn => fn(this));
  }

  loadScenario(scenarioKey) {
    this.activeScenario = scenarioKey;
    this.isTampered = false;

    switch (scenarioKey) {
      case 'revocation-conflict':
        this.claims = [
          {
            claimId: '0x01a9b83c4d7e2f1098234567abcdef0123456789abcdef0123456789abcdef01',
            chainId: 11155111,
            chainName: 'Sepolia',
            subject: this.subject,
            subjectDid: this.subjectDid,
            issuer: '0x8a1b3f91c0284a71928374829102948572819201',
            issuerDid: 'did:ethr:sepolia:0x8a1b...9201',
            topic: 'kyc.adult',
            polarity: 1,
            pCredible: 0.84,
            mass: 3.5,
            expiresAt: 1767225600,
            postedAt: 1750000000,
            revoked: false,
            revokedAt: null,
            txHash: '0x3a4b5c6d7e8f90123456789abcdef0123456789abcdef0123456789abcdef01',
            blockNumber: 19824,
            confirmations: 34,
            signatureValid: true
          },
          {
            claimId: '0x02c4e6a8b0d2f41638507294abcdef023456789abcdef0123456789abcdef02',
            chainId: 80002,
            chainName: 'Amoy',
            subject: this.subject,
            subjectDid: this.subjectDid,
            issuer: '0x8a1b3f91c0284a71928374829102948572819201',
            issuerDid: 'did:ethr:amoy:0x8a1b...9201',
            topic: 'kyc.adult',
            polarity: -1,
            pCredible: 0.81,
            mass: 3.0,
            expiresAt: 1767225600,
            postedAt: 1750000050,
            revoked: true,
            revokedAt: 1750000080,
            txHash: '0x8f90123456789abcdef0123456789abcdef0123456789abcdef0123456789ab',
            blockNumber: 58212,
            confirmations: 18,
            signatureValid: true
          },
          {
            claimId: '0x03d7f9b1c3e5a72849608305abcdef03456789abcdef0123456789abcdef03',
            chainId: 11155111,
            chainName: 'Sepolia',
            subject: this.subject,
            subjectDid: this.subjectDid,
            issuer: '0x55d1e00492837481920394857182938475819203',
            issuerDid: 'did:ethr:sepolia:0x55d1...9203',
            topic: 'residency.eu',
            polarity: 1,
            pCredible: 0.92,
            mass: 4.0,
            expiresAt: 1770000000,
            postedAt: 1749900000,
            revoked: false,
            revokedAt: null,
            txHash: '0x123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0',
            blockNumber: 19820,
            confirmations: 42,
            signatureValid: true
          }
        ];
        this.commitId = '0xef0284ac918801237a884910294877c86519284f11';
        this.stateHash = '0x221a9102c7a2b9109318b76e1029384918237999';
        break;

      case 'clean':
        this.claims = [
          {
            claimId: '0x01a9b83c4d7e2f1098234567abcdef0123456789abcdef0123456789abcdef01',
            chainId: 11155111,
            chainName: 'Sepolia',
            subject: this.subject,
            subjectDid: this.subjectDid,
            issuer: '0x8a1b3f91c0284a71928374829102948572819201',
            issuerDid: 'did:ethr:sepolia:0x8a1b...9201',
            topic: 'kyc.adult',
            polarity: 1,
            pCredible: 0.95,
            mass: 5.0,
            expiresAt: 1767225600,
            postedAt: 1750000000,
            revoked: false,
            revokedAt: null,
            txHash: '0x3a4b5c6d7e8f90123456789abcdef0123456789abcdef0123456789abcdef01',
            blockNumber: 19824,
            confirmations: 34,
            signatureValid: true
          },
          {
            claimId: '0x02c4e6a8b0d2f41638507294abcdef023456789abcdef0123456789abcdef02',
            chainId: 80002,
            chainName: 'Amoy',
            subject: this.subject,
            subjectDid: this.subjectDid,
            issuer: '0x32cf991092837481920394857182938475819202',
            issuerDid: 'did:ethr:amoy:0x32cf...9202',
            topic: 'kyc.adult',
            polarity: 1,
            pCredible: 0.91,
            mass: 4.5,
            expiresAt: 1767225600,
            postedAt: 1750000020,
            revoked: false,
            revokedAt: null,
            txHash: '0x8f90123456789abcdef0123456789abcdef0123456789abcdef0123456789ab',
            blockNumber: 58210,
            confirmations: 22,
            signatureValid: true
          },
          {
            claimId: '0x03d7f9b1c3e5a72849608305abcdef03456789abcdef0123456789abcdef03',
            chainId: 11155111,
            chainName: 'Sepolia',
            subject: this.subject,
            subjectDid: this.subjectDid,
            issuer: '0x55d1e00492837481920394857182938475819203',
            issuerDid: 'did:ethr:sepolia:0x55d1...9203',
            topic: 'residency.eu',
            polarity: 1,
            pCredible: 0.94,
            mass: 4.8,
            expiresAt: 1770000000,
            postedAt: 1749900000,
            revoked: false,
            revokedAt: null,
            txHash: '0x123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0',
            blockNumber: 19820,
            confirmations: 42,
            signatureValid: true
          }
        ];
        this.commitId = '0x889984ac918801237a884910294877c86519284f22';
        this.stateHash = '0x99119102c7a2b9109318b76e1029384918237111';
        break;

      case 'expired-credit':
        this.claims = [
          {
            claimId: '0x01a9b83c4d7e2f1098234567abcdef0123456789abcdef0123456789abcdef01',
            chainId: 11155111,
            chainName: 'Sepolia',
            subject: this.subject,
            subjectDid: this.subjectDid,
            issuer: '0x8a1b3f91c0284a71928374829102948572819201',
            issuerDid: 'did:ethr:sepolia:0x8a1b...9201',
            topic: 'kyc.adult',
            polarity: 1,
            pCredible: 0.92,
            mass: 4.0,
            expiresAt: 1767225600,
            postedAt: 1750000000,
            revoked: false,
            revokedAt: null,
            txHash: '0x3a4b5c6d7e8f90123456789abcdef0123456789abcdef0123456789abcdef01',
            blockNumber: 19824,
            confirmations: 34,
            signatureValid: true
          },
          {
            claimId: '0x02c4e6a8b0d2f41638507294abcdef023456789abcdef0123456789abcdef02',
            chainId: 80002,
            chainName: 'Amoy',
            subject: this.subject,
            subjectDid: this.subjectDid,
            issuer: '0x32cf991092837481920394857182938475819202',
            issuerDid: 'did:ethr:amoy:0x32cf...9202',
            topic: 'kyc.active',
            polarity: 1,
            pCredible: 0.40,
            mass: 2.0,
            expiresAt: 1740000000, // Expired TTL
            postedAt: 1700000000,
            revoked: false,
            expired: true,
            revokedAt: null,
            txHash: '0x8f90123456789abcdef0123456789abcdef0123456789abcdef0123456789ab',
            blockNumber: 58200,
            confirmations: 200,
            signatureValid: true
          }
        ];
        this.commitId = '0x334484ac918801237a884910294877c86519284f33';
        this.stateHash = '0x55669102c7a2b9109318b76e1029384918237333';
        break;
    }

    this.notify();
  }

  tamperHash() {
    this.isTampered = !this.isTampered;
    if (this.isTampered) {
      this.stateHash = '0xTAMPERED_HASH_MISMATCH_KECCAK256_FAILED';
      this.commitId = '0xINVALID_COMMIT_ID_CORRUPTED_PREIMAGE';
    } else {
      this.loadScenario(this.activeScenario);
    }
    this.notify();
  }
}
