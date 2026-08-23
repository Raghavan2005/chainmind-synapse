// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Shared testnet-only guard used by deploy scripts.
library ChainGuard {
    error MainnetForbidden(uint256 chainId);

    function requireTestnet(uint256 chainId) internal pure {
        if (chainId == 1 || chainId == 137) revert MainnetForbidden(chainId);
    }
}
