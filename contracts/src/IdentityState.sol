// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Append-only fused identity commitments. Operator is a documented liveness concession.
contract IdentityState is Ownable {
    event StateCommitted(
        bytes32 indexed commitId,
        address indexed subject,
        bytes32 stateHash,
        uint16 scoreBps,
        bytes32 modelVersion,
        uint64 issuedAt
    );

    struct Commit {
        bytes32 commitId;
        bytes32 stateHash;
        uint16 scoreBps;
        bytes32 modelVersion;
        uint64 issuedAt;
        uint64 blockNumber;
    }

    mapping(bytes32 => bool) public usedCommitId;
    mapping(address => Commit) private _latest;
    mapping(address => bytes32[]) private _history;

    error EmptySubject();
    error EmptyCommitId();
    error EmptyStateHash();
    error ScoreOutOfRange();
    error DuplicateCommit();

    constructor(address operator) Ownable(operator) {}

    function commit(
        address subject,
        bytes32 commitId,
        bytes32 stateHash,
        uint16 scoreBps,
        bytes32 modelVersion
    ) external onlyOwner {
        if (subject == address(0)) revert EmptySubject();
        if (commitId == bytes32(0)) revert EmptyCommitId();
        if (stateHash == bytes32(0)) revert EmptyStateHash();
        if (scoreBps > 10_000) revert ScoreOutOfRange();
        if (usedCommitId[commitId]) revert DuplicateCommit();

        usedCommitId[commitId] = true;
        uint64 issuedAt = uint64(block.timestamp);
        Commit memory row = Commit({
            commitId: commitId,
            stateHash: stateHash,
            scoreBps: scoreBps,
            modelVersion: modelVersion,
            issuedAt: issuedAt,
            blockNumber: uint64(block.number)
        });
        _latest[subject] = row;
        _history[subject].push(commitId);
        emit StateCommitted(commitId, subject, stateHash, scoreBps, modelVersion, issuedAt);
    }

    function latest(address subject)
        external
        view
        returns (
            bytes32 commitId,
            bytes32 stateHash,
            uint16 scoreBps,
            bytes32 modelVersion,
            uint64 issuedAt,
            uint64 blockNumber
        )
    {
        Commit memory row = _latest[subject];
        return (row.commitId, row.stateHash, row.scoreBps, row.modelVersion, row.issuedAt, row.blockNumber);
    }

    function historyCount(address subject) external view returns (uint256) {
        return _history[subject].length;
    }

    function historyAt(address subject, uint256 index) external view returns (bytes32) {
        return _history[subject][index];
    }
}
