// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ClaimSource} from "../src/ClaimSource.sol";
import {ChainGuard} from "../src/ChainGuard.sol";

contract DeployClaimSource is Script {
    function run() external {
        ChainGuard.requireTestnet(block.chainid);
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(pk);
        ClaimSource source = new ClaimSource();
        vm.stopBroadcast();
        console2.log("ClaimSource", address(source));
        console2.log("chainId", block.chainid);
    }
}
