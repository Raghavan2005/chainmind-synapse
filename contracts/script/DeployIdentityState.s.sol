// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IdentityState} from "../src/IdentityState.sol";
import {ChainGuard} from "../src/ChainGuard.sol";

contract DeployIdentityState is Script {
    function run() external {
        ChainGuard.requireTestnet(block.chainid);
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address operator = vm.envOr("OPERATOR_ADDRESS", vm.addr(pk));
        vm.startBroadcast(pk);
        IdentityState state = new IdentityState(operator);
        vm.stopBroadcast();
        console2.log("IdentityState", address(state));
        console2.log("operator", operator);
        console2.log("chainId", block.chainid);
    }
}
