/**
 * ChainMind Synapse - Reactive State Store & Blockchain Simulation Engine
 * Manages active claims, audit history, Merkle root states, and scenario switches.
 */

export class StateStore {
  constructor() {
    this.listeners = [];
    this.activeScenario = 'clean';
    this.isTampered = false;
    this.claims = [];
    this.auditHistory = [];
    this.merkleRoot = '0x9d11e83c74b8801b7a2b910e34f77c86519284fa8e';
    this.stateHash = '0x4f8e9102c7a2b9109318b76e1029384918237abc';
    this.settlementTx = '0x71ba9842f1b0a99c43e019385834892c9029a8f2';
    
    this.initDefaultState();
  }

  initDefaultState() {
    this.loadScenario('clean');
    this.logAudit('GENESIS_SYNC', 'Multi-chain genesis snapshot verified across ETH & Polygon', '#19824');
    this.logAudit('STATE_SETTLED', 'State Merkle root committed to Sepolia testnet', '#19825');
  }

  subscribe(listener) {
    this.listeners.push(listener);
  }

  notify() {
    this.listeners.forEach(fn => fn(this));
  }

  logAudit(action, desc, block) {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    this.auditHistory.unshift({
      time,
      action,
      desc,
      block
    });
    if (this.auditHistory.length > 8) {
      this.auditHistory.pop();
    }
  }

  loadScenario(scenarioKey) {
    this.activeScenario = scenarioKey;
    this.isTampered = false;

    switch (scenarioKey) {
      case 'clean':
        this.claims = [
          {
            id: 'claim-01',
            title: 'zkKYC Level-3 Pass (Gov Verified)',
            chain: 'Ethereum',
            type: 'KYC Verification',
            issuer: '0x8a1b...3f91 (Kleros ID Oracle)',
            issuerReputation: 98,
            status: 'Active',
            blockNumber: 19824,
            timestamp: '2 mins ago',
            hash: '0x7b23...a911'
          },
          {
            id: 'claim-02',
            title: 'On-Chain DeFi Credit Score (780)',
            chain: 'Polygon',
            type: 'DeFi Credit Score',
            issuer: '0x32cf...9910 (Aave Credit DID)',
            issuerReputation: 94,
            status: 'Active',
            blockNumber: 58210,
            timestamp: '14 mins ago',
            hash: '0x19ca...bb32'
          },
          {
            id: 'claim-03',
            title: 'DAO Governance Voting Authority',
            chain: 'Arbitrum',
            type: 'DAO Governance Voting',
            issuer: '0x55d1...e004 (Uniswap Governance)',
            issuerReputation: 96,
            status: 'Active',
            blockNumber: 11029,
            timestamp: '1 hour ago',
            hash: '0x992e...44ff'
          },
          {
            id: 'claim-04',
            title: 'WorldID Proof-of-Humanity (Biometric)',
            chain: 'Solana',
            type: 'Sybil Proof-of-Humanity',
            issuer: '0x6e78...012a (Worldcoin Foundation)',
            issuerReputation: 92,
            status: 'Active',
            blockNumber: 20491,
            timestamp: '3 hours ago',
            hash: '0x55aa...3341'
          }
        ];
        this.merkleRoot = '0x9d11e83c74b8801b7a2b910e34f77c86519284fa8e';
        this.stateHash = '0x4f8e9102c7a2b9109318b76e1029384918237abc';
        this.logAudit('SCENARIO_LOAD', 'Loaded Clean Multi-Chain Sync preset', '#19826');
        break;

      case 'revocation-conflict':
        this.claims = [
          {
            id: 'claim-01',
            title: 'zkKYC Level-3 Pass (Gov Verified)',
            chain: 'Ethereum',
            type: 'KYC Verification',
            issuer: '0x8a1b...3f91 (Kleros ID Oracle)',
            issuerReputation: 98,
            status: 'Active',
            blockNumber: 19824,
            timestamp: '5 mins ago',
            hash: '0x7b23...a911'
          },
          {
            id: 'claim-02',
            title: 'zkKYC Revocation Notice (OFAC Flag)',
            chain: 'Polygon',
            type: 'KYC Verification',
            issuer: '0x8a1b...3f91 (Kleros ID Oracle)',
            issuerReputation: 98,
            status: 'Revoked',
            blockNumber: 58212,
            timestamp: 'Just now (RPC Event)',
            hash: '0xcc89...119b'
          },
          {
            id: 'claim-03',
            title: 'On-Chain DeFi Credit Score',
            chain: 'Arbitrum',
            type: 'DeFi Credit Score',
            issuer: '0x32cf...9910 (Aave Credit DID)',
            issuerReputation: 91,
            status: 'Active',
            blockNumber: 11030,
            timestamp: '40 mins ago',
            hash: '0x88bb...5521'
          }
        ];
        this.merkleRoot = '0xef0284ac918801237a884910294877c86519284f11';
        this.stateHash = '0x221a9102c7a2b9109318b76e1029384918237999';
        this.logAudit('REVOCATION_DETECTED', 'Polygon RPC emitted ClaimRevoked(0x742d...) event', '#58212');
        break;

      case 'sybil-anomaly':
        this.claims = [
          {
            id: 'claim-01',
            title: 'Anonymous Identity Token #8841',
            chain: 'Ethereum',
            type: 'Developer Credential',
            issuer: '0x0000...dead (Unknown Contract)',
            issuerReputation: 32,
            status: 'Under Dispute',
            blockNumber: 19827,
            timestamp: '1 min ago',
            hash: '0xbad0...0001'
          },
          {
            id: 'claim-02',
            title: 'Rapid Clone Identity Mint #8842',
            chain: 'Polygon',
            type: 'Developer Credential',
            issuer: '0x0000...dead (Unknown Contract)',
            issuerReputation: 32,
            status: 'Under Dispute',
            blockNumber: 58215,
            timestamp: '1 min ago',
            hash: '0xbad0...0002'
          },
          {
            id: 'claim-03',
            title: 'Rapid Clone Identity Mint #8843',
            chain: 'Arbitrum',
            type: 'Developer Credential',
            issuer: '0x0000...dead (Unknown Contract)',
            issuerReputation: 32,
            status: 'Under Dispute',
            blockNumber: 11032,
            timestamp: '1 min ago',
            hash: '0xbad0...0003'
          }
        ];
        this.merkleRoot = '0x111184ac918801237a884910294877c86519284111';
        this.stateHash = '0x00009102c7a2b9109318b76e1029384918237000';
        this.logAudit('SYBIL_ALERT', 'Heuristic filter flagged 3 burst identity mints', '#19827');
        break;

      case 'expired-credit':
        this.claims = [
          {
            id: 'claim-01',
            title: 'zkKYC Level-3 Pass',
            chain: 'Ethereum',
            type: 'KYC Verification',
            issuer: '0x8a1b...3f91 (Kleros ID Oracle)',
            issuerReputation: 98,
            status: 'Active',
            blockNumber: 19824,
            timestamp: '2 hours ago',
            hash: '0x7b23...a911'
          },
          {
            id: 'claim-02',
            title: 'Undercollateralized DeFi Tier-A',
            chain: 'Polygon',
            type: 'DeFi Credit Score',
            issuer: '0x32cf...9910 (Aave Credit DID)',
            issuerReputation: 88,
            status: 'Expired',
            blockNumber: 58200,
            timestamp: '380 days ago (Stale)',
            hash: '0xdead...beef'
          }
        ];
        this.merkleRoot = '0x7788e83c74b8801b7a2b910e34f77c86519284facc';
        this.stateHash = '0x66559102c7a2b9109318b76e1029384918237554';
        this.logAudit('EXPIRED_ALERT', 'Polygon DeFi credential failed TTL check (>365d)', '#58200');
        break;
    }

    this.notify();
  }

  tamperClaim() {
    this.isTampered = true;
    if (this.claims.length > 0) {
      this.claims[0].isTampered = true;
      this.claims[0].hash = '0xTAMPERED_HASH_9999999999999999999999';
    }
    this.merkleRoot = '0xINVALID_MERKLE_ROOT_MISMATCH_DETECTED';
    this.stateHash = '0xCORRUPT_STATE_VECTOR_404_ANOMALY';
    this.logAudit('SECURITY_TAMPER', 'Simulated cryptographic signature modification in memory', '#19828');
    this.notify();
  }

  restoreGenesis() {
    this.loadScenario(this.activeScenario);
    this.logAudit('RESTORE_GENESIS', 'Restored verified immutable Merkle state', '#19829');
  }

  addCustomClaim(claimData) {
    const newClaim = {
      id: 'claim-' + (this.claims.length + 1).toString().padStart(2, '0'),
      title: claimData.type + ' (' + claimData.chain + ')',
      chain: claimData.chain,
      type: claimData.type,
      issuer: claimData.issuer,
      issuerReputation: parseInt(claimData.reputation) || 90,
      status: claimData.status,
      blockNumber: Math.floor(20000 + Math.random() * 80000),
      timestamp: 'Just now',
      hash: '0x' + Math.random().toString(16).substring(2, 10) + '...' + Math.random().toString(16).substring(2, 6)
    };

    this.claims.push(newClaim);
    this.logAudit('CLAIM_INJECTED', `Injected [${newClaim.type}] from ${newClaim.chain}`, `#${newClaim.blockNumber}`);
    this.notify();
  }
}
