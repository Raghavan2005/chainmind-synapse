// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal claim bulletin board. Not an identity provider.
/// @dev claimId is a pure function of public fields so ingest is idempotent.
contract ClaimSource {
    event ClaimPosted(
        bytes32 indexed claimId,
        address indexed subject,
        address indexed issuer,
        bytes32 topic,
        int8 polarity,
        uint64 expiresAt,
        string evidenceURI
    );
    event ClaimRevoked(bytes32 indexed claimId, address indexed issuer, uint64 at);

    struct Meta {
        bool exists;
        bool revoked;
        uint64 expiresAt;
        address issuer;
    }

    mapping(bytes32 => Meta) public claims;

    error InvalidPolarity();
    error EmptySubject();
    error EmptyTopic();
    error ClaimAlreadyExists();
    error UnknownClaim();
    error NotIssuer();
    error AlreadyRevoked();
    error EvidenceTooLong();

    uint256 public constant MAX_EVIDENCE_URI = 512;

    function postClaim(
        address subject,
        bytes32 topic,
        int8 polarity,
        uint64 expiresAt,
        string calldata evidenceURI
    ) external returns (bytes32 claimId) {
        if (subject == address(0)) revert EmptySubject();
        if (topic == bytes32(0)) revert EmptyTopic();
        if (polarity != 1 && polarity != -1) revert InvalidPolarity();
        if (bytes(evidenceURI).length > MAX_EVIDENCE_URI) revert EvidenceTooLong();

        claimId = claimIdOf(subject, msg.sender, topic, polarity, expiresAt, evidenceURI);
        if (claims[claimId].exists) revert ClaimAlreadyExists();

        claims[claimId] = Meta({exists: true, revoked: false, expiresAt: expiresAt, issuer: msg.sender});
        emit ClaimPosted(claimId, subject, msg.sender, topic, polarity, expiresAt, evidenceURI);
    }

    function revokeClaim(bytes32 claimId) external {
        Meta storage meta = claims[claimId];
        if (!meta.exists) revert UnknownClaim();
        if (meta.issuer != msg.sender) revert NotIssuer();
        if (meta.revoked) revert AlreadyRevoked();
        meta.revoked = true;
        emit ClaimRevoked(claimId, msg.sender, uint64(block.timestamp));
    }

    function claimIdOf(
        address subject,
        address issuer,
        bytes32 topic,
        int8 polarity,
        uint64 expiresAt,
        string calldata evidenceURI
    ) public view returns (bytes32) {
        return keccak256(abi.encode(block.chainid, subject, issuer, topic, polarity, expiresAt, evidenceURI));
    }
}
