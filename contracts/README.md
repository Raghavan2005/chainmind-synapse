# Contracts

Minimal claim bulletin boards plus an append-only identity commitment. Not an identity provider.

| Contract | Role | Where |
| --- | --- | --- |
| `ClaimSource` | `postClaim` / `revokeClaim`, emit `ClaimPosted` / `ClaimRevoked` | Sepolia + Unichain Sepolia (FR-01) and optional Superchain L2s |
| `IdentityState` | `commit(subject, commitId, stateHash, scoreBps, modelVersion)` | Sepolia only |

`claimId = keccak256(abi.encode(chainid, subject, issuer, topic, polarity, expiresAt, evidenceURI))`. `msg.sender` is the issuer. Revoke only by issuer. `IdentityState` is append-only; a duplicate `commitId` reverts.

Deploy scripts revert on chain id `1` and `137`. Live addresses and the demo subject live in the [root README](../README.md). Interfaces and structs: [`instructions/SCHEMA.html`](../instructions/SCHEMA.html).

```bash
forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts@v5.4.0 --no-git --shallow
forge test -vv
forge script script/DeployClaimSource.s.sol:DeployClaimSource --rpc-url $SEPOLIA_RPC_URL --broadcast --private-key $DEPLOYER_PRIVATE_KEY
forge script script/DeployIdentityState.s.sol:DeployIdentityState --rpc-url $SEPOLIA_RPC_URL --broadcast --private-key $DEPLOYER_PRIVATE_KEY
```
