// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {ZenoIndexVault} from "../../src/arc/ZenoIndexVault.sol";

contract CreateArcVault is Script {
    uint256 internal constant ARC_TESTNET_CHAIN_ID = 5042002;
    uint256 internal constant ASSET_COUNT = 6;
    uint256 internal constant BPS_DENOM = 10_000;

    function run() external {
        require(block.chainid == ARC_TESTNET_CHAIN_ID, "Arc testnet only");

        uint256 pk = vm.envUint("ARC_PRIVATE_KEY");
        address signer = vm.addr(pk);

        address factoryAddress = vm.envAddress("ARC_FACTORY_ADDRESS");
        address feeRecipient = vm.envAddress("ARC_FEE_RECIPIENT");

        require(factoryAddress.code.length > 0, "Factory not deployed");
        require(feeRecipient != address(0), "ARC_FEE_RECIPIENT=0");

        ZenoIndexVault factory = ZenoIndexVault(factoryAddress);

        require(factory.superAdmin() == signer, "Signer is not super-admin");
        require(!factory.isEmergency(), "Protocol emergency active");
        require(factory.router() != address(0), "Router not configured");
        require(factory.totalAssets() == ASSET_COUNT, "Unexpected asset count");
        require(factory.totalVaults() == 0, "Vault already exists");

        uint64[] memory assetIds = new uint64[](ASSET_COUNT);
        uint16[] memory allocationBps = new uint16[](ASSET_COUNT);
        uint256 allocationTotal;

        for (uint256 i; i < ASSET_COUNT; ++i) {
            assetIds[i] = uint64(i);

            uint256 allocation = vm.envUint(string.concat("ARC_ALLOCATION_BPS_", vm.toString(i)));

            require(allocation <= BPS_DENOM, "Allocation exceeds 10000 BPS");
            allocationBps[i] = uint16(allocation);
            allocationTotal += allocation;
        }

        require(allocationTotal == BPS_DENOM, "Allocations must total 10000 BPS");

        string memory vaultName = vm.envString("ARC_VAULT_NAME");
        string memory vaultSymbol = vm.envString("ARC_VAULT_SYMBOL");

        ZenoIndexVault.CreateVaultParams memory params = ZenoIndexVault.CreateVaultParams({
            feeRecipient: feeRecipient,
            depositFeeBps: 0,
            redeemFeeBps: 50,
            assetIds: assetIds,
            allocationBps: allocationBps,
            fundType: 1,
            maxShares: 0,
            name: vaultName,
            symbol: vaultSymbol
        });

        console2.log("Arc chain id:", block.chainid);
        console2.log("Factory:", factoryAddress);
        console2.log("Creator:", signer);
        console2.log("Vault manager (creator):", signer);
        console2.log("Fee recipient:", feeRecipient);
        console2.log("Allocation total:", allocationTotal);

        vm.startBroadcast(pk);
        uint64 vaultId = factory.createVault(params);
        vm.stopBroadcast();

        address vaultAddress = factory.vaultClones(vaultId);
        require(vaultAddress.code.length > 0, "Vault clone not deployed");

        console2.log("Created vault ID:", vaultId);
        console2.log("Vault address:", vaultAddress);
    }
}
