// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {UniswapV4Adapter} from "../../src/arc/adapters/UniswapV4Adapter.sol";
import {ZenoIndexVault} from "../../src/arc/ZenoIndexVault.sol";

contract DeployArcAdapter is Script {
    uint256 internal constant ARC_TESTNET_CHAIN_ID = 5042002;

    function run() external {
        require(block.chainid == ARC_TESTNET_CHAIN_ID, "Arc testnet only");

        uint256 pk = vm.envUint("ARC_PRIVATE_KEY");
        address admin = vm.addr(pk);

        address factoryAddress = vm.envAddress("ARC_FACTORY_ADDRESS");
        address poolManagerAddress = vm.envAddress("ARC_POOL_MANAGER");
        address stablecoin = vm.envAddress("ARC_USDC");

        require(factoryAddress.code.length > 0, "Factory not deployed");
        require(poolManagerAddress.code.length > 0, "PoolManager not deployed");
        require(stablecoin.code.length > 0, "USDC not deployed");

        ZenoIndexVault factory = ZenoIndexVault(factoryAddress);

        require(factory.superAdmin() == admin, "Wrong factory super-admin");
        require(factory.router() == address(0), "Router already configured");
        require(factory.usdcToken() == stablecoin, "Unexpected USDC");

        console2.log("Arc chain id:", block.chainid);
        console2.log("Admin:", admin);
        console2.log("Factory:", factoryAddress);
        console2.log("PoolManager:", poolManagerAddress);
        console2.log("USDC:", stablecoin);

        vm.startBroadcast(pk);

        UniswapV4Adapter adapter = new UniswapV4Adapter(poolManagerAddress, admin);

        adapter.setAuthorizedCaller(factoryAddress, true);
        factory.setSwapRouter(address(adapter));

        vm.stopBroadcast();

        require(adapter.isAuthorizedCaller(factoryAddress), "Factory authorization failed");
        require(factory.router() == address(adapter), "Router configuration failed");

        console2.log("Adapter deployed:", address(adapter));
        console2.log("Factory authorized:", adapter.isAuthorizedCaller(factoryAddress));
        console2.log("Factory router:", factory.router());
    }
}
