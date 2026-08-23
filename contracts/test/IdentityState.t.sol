// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IdentityState} from "../src/IdentityState.sol";
import {ChainGuard} from "../src/ChainGuard.sol";

contract IdentityStateTest is Test {
    IdentityState internal state;
    address internal operator = address(0x333);
    address internal subject = address(0xB0B);

    function setUp() public {
        state = new IdentityState(operator);
    }

    function test_commit_and_latest() public {
        bytes32 commitId = keccak256("c1");
        bytes32 hash = keccak256("h1");
        vm.prank(operator);
        state.commit(subject, commitId, hash, 4100, keccak256("model"));
        (bytes32 gotId, bytes32 gotHash, uint16 bps,, uint64 issuedAt, uint64 blockNumber) = state.latest(subject);
        assertEq(gotId, commitId);
        assertEq(gotHash, hash);
        assertEq(bps, 4100);
        assertTrue(issuedAt != 0);
        assertEq(blockNumber, uint64(block.number));
        assertEq(state.historyCount(subject), 1);
    }

    function test_duplicate_commitId_reverts() public {
        bytes32 commitId = keccak256("c1");
        vm.startPrank(operator);
        state.commit(subject, commitId, keccak256("h1"), 1000, keccak256("m"));
        vm.expectRevert(IdentityState.DuplicateCommit.selector);
        state.commit(subject, commitId, keccak256("h2"), 2000, keccak256("m"));
        vm.stopPrank();
    }

    function test_second_commit_updates_latest_keeps_history() public {
        vm.startPrank(operator);
        state.commit(subject, keccak256("c1"), keccak256("h1"), 1000, keccak256("m"));
        state.commit(subject, keccak256("c2"), keccak256("h2"), 2000, keccak256("m"));
        vm.stopPrank();
        (bytes32 gotId,,,,,) = state.latest(subject);
        assertEq(gotId, keccak256("c2"));
        assertEq(state.historyCount(subject), 2);
        assertEq(state.historyAt(subject, 0), keccak256("c1"));
    }

    function test_non_operator_cannot_commit() public {
        vm.expectRevert();
        state.commit(subject, keccak256("c1"), keccak256("h1"), 1, keccak256("m"));
    }

    function test_score_over_10000_reverts() public {
        vm.prank(operator);
        vm.expectRevert(IdentityState.ScoreOutOfRange.selector);
        state.commit(subject, keccak256("c1"), keccak256("h1"), 10001, keccak256("m"));
    }

    function test_chainguard_rejects_mainnet_ids() public {
        vm.expectRevert(abi.encodeWithSelector(ChainGuard.MainnetForbidden.selector, 1));
        this.wrapRequire(1);
        vm.expectRevert(abi.encodeWithSelector(ChainGuard.MainnetForbidden.selector, 137));
        this.wrapRequire(137);
        ChainGuard.requireTestnet(11155111);
        ChainGuard.requireTestnet(1301);
    }

    function wrapRequire(uint256 chainId) external pure {
        ChainGuard.requireTestnet(chainId);
    }
}
