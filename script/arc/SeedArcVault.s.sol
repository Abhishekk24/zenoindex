// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Vault} from "../../src/arc/Vault.sol";
import {ZenoIndexVault} from "../../src/arc/ZenoIndexVault.sol";
import {Constants} from "../../src/arc/libraries/Constants.sol";

contract SeedArcVault is Script {
    uint256 internal constant ARC_TESTNET_CHAIN_ID = 5042002;
    uint256 internal constant DEFAULT_BASELINE_SHARE_PRICE = 1_000_000_000;

    function run() external {
        require(block.chainid == ARC_TESTNET_CHAIN_ID, "Arc testnet only");

        uint256 pk = vm.envUint("ARC_PRIVATE_KEY");
        address signer = vm.addr(pk);
        address vaultAddress = vm.envAddress("ARC_VAULT_ADDRESS");

        require(vaultAddress.code.length > 0, "Vault not deployed");

        Vault vault = Vault(vaultAddress);
        address factoryAddress = vault.zenoIndexVault();

        require(factoryAddress.code.length > 0, "Factory not deployed");

        ZenoIndexVault factory = ZenoIndexVault(factoryAddress);
        address stablecoin = factory.usdcToken();
        IERC20 usdc = IERC20(stablecoin);

        require(vault.vaultManager() == signer, "Signer is not vault manager");
        require(!vault.genesisDone(), "Genesis already completed");
        require(!vault.paused() && !vault.adminLocked(), "Vault locked");
        require(!factory.isEmergency(), "Protocol emergency active");
        require(usdc.balanceOf(signer) >= Constants.GENESIS_SEED_USDC, "Insufficient Arc USDC");

        uint256 baselineSharePrice = vm.envOr("ARC_BASELINE_SHARE_PRICE", DEFAULT_BASELINE_SHARE_PRICE);

        require(
            baselineSharePrice >= Constants.MIN_BASELINE_SHARE_PRICE
                && baselineSharePrice <= Constants.MAX_BASELINE_SHARE_PRICE,
            "Baseline share price out of bounds"
        );

        uint256 genesisShares = (Constants.GENESIS_SEED_USDC * Constants.PRICE_SCALE) / baselineSharePrice;

        require(genesisShares > 0, "Genesis shares are zero");

        console2.log("Arc chain id:", block.chainid);
        console2.log("Vault:", vaultAddress);
        console2.log("Vault manager:", signer);
        console2.log("ERC20 USDC:", stablecoin);
        console2.log("Genesis seed (raw USDC):", Constants.GENESIS_SEED_USDC);
        console2.log("Baseline share price:", baselineSharePrice);
        console2.log("Expected genesis shares:", genesisShares);

        vm.startBroadcast(pk);
        require(usdc.approve(vaultAddress, Constants.GENESIS_SEED_USDC), "USDC approval failed");
        vault.genesisDeposit(baselineSharePrice);
        vm.stopBroadcast();

        require(vault.genesisDone(), "Genesis deposit not completed");

        console2.log("Genesis seeded successfully:", vaultAddress);
    }
}
