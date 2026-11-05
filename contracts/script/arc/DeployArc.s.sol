// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {ZenoIndexVault} from "../../src/arc/ZenoIndexVault.sol";
import {Vault} from "../../src/arc/Vault.sol";
import {AccessMaster} from "../../src/arc/AccessMaster.sol";
import {FeeEscrow} from "../../src/arc/FeeEscrow.sol";

interface IERC20MetadataArc {
    function decimals() external view returns (uint8);
}

contract DeployArc is Script {
    uint256 internal constant ARC_TESTNET_CHAIN_ID = 5042002;

    function run() external {
        require(block.chainid == ARC_TESTNET_CHAIN_ID, "Arc testnet only");

        uint256 pk = vm.envUint("ARC_PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address superAdmin = vm.envAddress("ARC_SUPER_ADMIN");
        address treasury = vm.envAddress("ARC_TREASURY");

        require(superAdmin != address(0), "ARC_SUPER_ADMIN=0");
        require(treasury != address(0), "ARC_TREASURY=0");
        require(deployer == superAdmin, "Deployer must be super-admin");

        address stablecoin = vm.envAddress("ARC_USDC");
        require(stablecoin != address(0), "ARC_USDC=0");

        uint8 stablecoinDecimals = IERC20MetadataArc(stablecoin).decimals();
        require(stablecoinDecimals == 6, "Arc USDC must have 6 decimals");

        address[5] memory mints = [
            vm.envAddress("ARC_ASSET_0"),
            vm.envAddress("ARC_ASSET_1"),
            vm.envAddress("ARC_ASSET_2"),
            vm.envAddress("ARC_ASSET_3"),
            vm.envAddress("ARC_ASSET_4")
        ];

        for (uint256 i; i < mints.length; ++i) {
            require(mints[i] != address(0), "Missing Arc asset address");
            require(mints[i] != stablecoin, "Asset equals USDC");

            for (uint256 j; j < i; ++j) {
                require(mints[i] != mints[j], "Duplicate Arc asset");
            }
        }

        console2.log("Arc chain id:", block.chainid);
        console2.log("Deployer:", deployer);
        console2.log("SuperAdmin:", superAdmin);
        console2.log("Treasury:", treasury);
        console2.log("ERC20 USDC:", stablecoin);
        console2.log("USDC decimals:", stablecoinDecimals);

        vm.startBroadcast(pk);

        Vault vaultImpl = new Vault();
        AccessMaster accessMaster = new AccessMaster(superAdmin, treasury);

        ZenoIndexVault factory = new ZenoIndexVault(stablecoin, address(vaultImpl), address(accessMaster));

        FeeEscrow feeEscrow = new FeeEscrow(address(factory), address(accessMaster));

        factory.setFeeEscrow(address(feeEscrow));

        uint64 stablecoinId = factory.createAsset(stablecoin);
        require(stablecoinId == 0, "Unexpected USDC asset ID");

        for (uint256 i; i < mints.length; ++i) {
            uint64 assetId = factory.createAsset(mints[i]);
            require(assetId == i + 1, "Unexpected Arc asset ID");

            console2.log("Registered asset ID:", assetId);
            console2.log("Asset address:", mints[i]);
        }

        vm.stopBroadcast();

        console2.log("Factory:", address(factory));
        console2.log("Vault implementation:", address(vaultImpl));
        console2.log("AccessMaster:", address(accessMaster));
        console2.log("FeeEscrow:", address(feeEscrow));
        console2.log("Configured FeeEscrow:", factory.feeEscrow());
        console2.log("Configured superAdmin:", factory.superAdmin());
    }
}
