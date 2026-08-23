// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ClaimSource} from "../src/ClaimSource.sol";

contract ClaimSourceTest is Test {
    ClaimSource internal source;
    address internal issuer = address(0xA11CE);
    address internal subject = address(0xB0B);
    bytes32 internal topic = keccak256("kyc.adult");

    function setUp() public {
        source = new ClaimSource();
    }

    function test_post_emits_and_stores() public {
        vm.prank(issuer);
        bytes32 id = source.postClaim(subject, topic, 1, 1_900_000_000, "data:application/json,{\"note\":\"a\"}");
        (bool exists, bool revoked, uint64 expiresAt, address storedIssuer) = source.claims(id);
        assertTrue(exists);
        assertFalse(revoked);
        assertEq(expiresAt, 1_900_000_000);
        assertEq(storedIssuer, issuer);
    }

    function test_claimId_stable_and_includes_chainid() public {
        string memory uri = "data:application/json,{\"note\":\"a\"}";
        bytes32 expected =
            keccak256(abi.encode(block.chainid, subject, issuer, topic, int8(1), uint64(1_900_000_000), uri));
        vm.prank(issuer);
        bytes32 id = source.postClaim(subject, topic, 1, 1_900_000_000, uri);
        assertEq(id, expected);
        assertEq(source.claimIdOf(subject, issuer, topic, 1, 1_900_000_000, uri), expected);
    }

    function test_duplicate_post_reverts() public {
        vm.startPrank(issuer);
        source.postClaim(subject, topic, 1, 1_900_000_000, "uri");
        vm.expectRevert(ClaimSource.ClaimAlreadyExists.selector);
        source.postClaim(subject, topic, 1, 1_900_000_000, "uri");
        vm.stopPrank();
    }

    function test_only_issuer_revokes() public {
        vm.prank(issuer);
        bytes32 id = source.postClaim(subject, topic, 1, 1_900_000_000, "uri");
        vm.prank(subject);
        vm.expectRevert(ClaimSource.NotIssuer.selector);
        source.revokeClaim(id);
        vm.prank(issuer);
        source.revokeClaim(id);
        (, bool revoked,,) = source.claims(id);
        assertTrue(revoked);
    }

    function test_invalid_polarity_reverts() public {
        vm.prank(issuer);
        vm.expectRevert(ClaimSource.InvalidPolarity.selector);
        source.postClaim(subject, topic, 0, 1_900_000_000, "uri");
    }
}
