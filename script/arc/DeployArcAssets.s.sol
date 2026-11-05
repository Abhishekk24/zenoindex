// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {MockERC20} from "../../src/arc/mocks/MockERC20.sol";

contract DeployArcAssets is Script {
    uint256 internal constant ARC_TESTNET_CHAIN_ID = 5042002;
    uint256 internal constant INITIAL_SUPPLY = 1_000_000 ether;

    function run() external {
        require(block.chainid == ARC_TESTNET_CHAIN_ID, "Arc testnet only");

        uint256 pk = vm.envUint("ARC_PRIVATE_KEY");
        address deployer = vm.addr(pk);

        vm.startBroadcast(pk);

        MockERC20 nvda = new MockERC20("NVIDIA Test Token", "NVDA", 18);
        MockERC20 tsla = new MockERC20("Tesla Test Token", "TSLA", 18);
        MockERC20 meta = new MockERC20("Meta Test Token", "META", 18);
        MockERC20 mu = new MockERC20("Micron Test Token", "MU", 18);
        MockERC20 spcx = new MockERC20("SpaceX Test Token", "SPCX", 18);

        nvda.mint(deployer, INITIAL_SUPPLY);
        tsla.mint(deployer, INITIAL_SUPPLY);
        meta.mint(deployer, INITIAL_SUPPLY);
        mu.mint(deployer, INITIAL_SUPPLY);
        spcx.mint(deployer, INITIAL_SUPPLY);

        vm.stopBroadcast();

        console2.log("NVDA:", address(nvda));
        console2.log("TSLA:", address(tsla));
        console2.log("META:", address(meta));
        console2.log("MU:", address(mu));
        console2.log("SPCX:", address(spcx));
        console2.log("Initial supply per asset:", INITIAL_SUPPLY);
    }
}
