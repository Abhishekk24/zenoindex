// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";

interface IZenoSetup {
    function usdcToken() external view returns (address);
    function router() external view returns (address);
    function totalAssets() external view returns (uint64);
    function totalVaults() external view returns (uint64);
    function isEmergency() external view returns (bool);
    function accessMaster() external view returns (address);
    function priceDen(address) external view returns (uint256);
    function createAsset(address) external returns (uint64);
    function setPriceWhole(address, uint256) external;
}

interface ISetupAccessMaster {
    function superAdmin() external view returns (address);
}

contract SetupAssetsAndPrices is Script {
    address constant FACTORY = 0xD00ABbC1d1555a173c5081b2204579b057B05378;
    address constant USDG = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;

    address constant NVDA = 0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC;
    address constant TSLA = 0x322F0929c4625eD5bAd873c95208D54E1c003b2d;
    address constant META = 0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35;
    address constant MU = 0xfF080c8ce2E5feadaCa0Da81314Ae59D232d4afD;
    address constant SPCX = 0x4a0E65A3EcceC6dBe60AE065F2e7bb85Fae35eEa;

    function run() external {
        require(block.chainid == 4663, "Wrong chain");
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address sender = vm.addr(pk);
        IZenoSetup f = IZenoSetup(FACTORY);

        require(ISetupAccessMaster(f.accessMaster()).superAdmin() == sender, "Signer is not superAdmin");
        require(f.usdcToken() == USDG, "Unexpected base token");
        require(f.router() != address(0), "Router missing");
        require(!f.isEmergency(), "Emergency mode active");
        require(f.totalAssets() == 0, "Assets already registered");
        require(f.totalVaults() == 0, "Vaults already exist");

        address[6] memory tokens = [USDG, NVDA, TSLA, META, MU, SPCX];

        uint256[5] memory prices = [uint256(228431933), 382425000, 729184610, 1005595236, 164285000];

        for (uint256 i; i < tokens.length; ++i) {
            require(f.priceDen(tokens[i]) == 0, "Existing price found");
        }

        vm.startBroadcast(pk);

        for (uint256 i; i < tokens.length; ++i) {
            uint64 id = f.createAsset(tokens[i]);
            require(id == i, "Unexpected asset ID");
            console2.log("Registered asset ID:", id);
            console2.log("Token:", tokens[i]);
        }

        for (uint256 i; i < prices.length; ++i) {
            f.setPriceWhole(tokens[i + 1], prices[i]);
            console2.log("Price set for:", tokens[i + 1]);
            console2.log("USDG units per whole token:", prices[i]);
        }

        vm.stopBroadcast();
    }
}
