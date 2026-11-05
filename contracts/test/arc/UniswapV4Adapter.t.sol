// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Test} from "forge-std/Test.sol";
import {MockERC20} from "../../src/arc/mocks/MockERC20.sol";
import {UniswapV4Adapter} from "../../src/arc/adapters/UniswapV4Adapter.sol";

import {PoolManager} from "v4-core/PoolManager.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolModifyLiquidityTest} from "v4-core/test/PoolModifyLiquidityTest.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {DeltaReturningHook} from "v4-core/test/DeltaReturningHook.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";

contract UniswapV4AdapterTest is Test {
    PoolManager internal manager;
    PoolModifyLiquidityTest internal liquidityRouter;
    UniswapV4Adapter internal adapter;

    MockERC20 internal tokenA;
    MockERC20 internal tokenB;
    MockERC20 internal tokenC;
    address internal currency0Addr;
    address internal currency1Addr;

    address internal admin = address(0xADA1);
    address internal lp = address(0x11);
    address internal vaultStandIn = address(0xCACE);
    address internal recipient = address(0xBEEF);

    uint24 internal constant FEE = 3000;
    int24 internal constant TICK_SPACING = 60;
    uint160 internal constant SQRT_PRICE_1_1 = 79228162514264337593543950336;

    function setUp() public {
        manager = new PoolManager(address(this));
        liquidityRouter = new PoolModifyLiquidityTest(IPoolManager(address(manager)));
        adapter = new UniswapV4Adapter(address(manager), admin);

        MockERC20 t0 = new MockERC20("Token0", "TK0", 18);
        MockERC20 t1 = new MockERC20("Token1", "TK1", 18);
        if (address(t0) < address(t1)) {
            tokenA = t0;
            tokenB = t1;
        } else {
            tokenA = t1;
            tokenB = t0;
        }
        currency0Addr = address(tokenA);
        currency1Addr = address(tokenB);
        tokenC = new MockERC20("Token2", "TK2", 18);

        _initPoolAndSeed(currency0Addr, currency1Addr);
        _initPoolAndSeed(address(tokenB), address(tokenC));

        tokenA.mint(vaultStandIn, 1_000e18);

        vm.prank(admin);
        adapter.setAuthorizedCaller(vaultStandIn, true);
    }

    function _initPoolAndSeed(address x, address y) internal {
        (address c0, address c1) = x < y ? (x, y) : (y, x);
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(c0),
            currency1: Currency.wrap(c1),
            fee: FEE,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(address(0))
        });
        manager.initialize(key, SQRT_PRICE_1_1);

        MockERC20(c0).mint(lp, 1_000_000e18);
        MockERC20(c1).mint(lp, 1_000_000e18);
        vm.startPrank(lp);
        MockERC20(c0).approve(address(liquidityRouter), type(uint256).max);
        MockERC20(c1).approve(address(liquidityRouter), type(uint256).max);
        liquidityRouter.modifyLiquidity(
            key,
            IPoolManager.ModifyLiquidityParams({tickLower: -60000, tickUpper: 60000, liquidityDelta: 100e18, salt: 0}),
            ""
        );
        vm.stopPrank();

        vm.prank(admin);
        adapter.setPool(c0, c1, FEE, TICK_SPACING, address(0));
    }

    function test_unlockCallback_revertsOnAmountTooLarge() public {
        address[] memory path = new address[](2);
        path[0] = currency0Addr;
        path[1] = currency1Addr;

        uint256 oversizedAmount = uint256(type(int256).max) + 1;
        tokenA.mint(vaultStandIn, oversizedAmount);

        vm.startPrank(vaultStandIn);
        tokenA.approve(address(adapter), type(uint256).max);

        vm.expectRevert(UniswapV4Adapter.AmountTooLarge.selector);
        adapter.swap(path, oversizedAmount, 0, vaultStandIn, recipient);
        vm.stopPrank();
    }

    function test_swap_singleHop_exactInput_swapsAndPaysRecipient() public {
        address[] memory path = new address[](2);
        path[0] = currency0Addr;
        path[1] = currency1Addr;

        vm.startPrank(vaultStandIn);
        tokenA.approve(address(adapter), 10e18);
        uint256 amountOut = adapter.swap(path, 10e18, 1, vaultStandIn, recipient);
        vm.stopPrank();

        assertGt(amountOut, 0, "amountOut should be positive");
        assertEq(tokenB.balanceOf(recipient), amountOut, "recipient should receive amountOut of tokenB");
        assertEq(tokenA.balanceOf(vaultStandIn), 990e18, "vault stand-in should have paid 10e18 tokenA");
    }

    function test_swap_twoHop_exactInput_chainsThroughIntermediate() public {
        address[] memory path = new address[](3);
        path[0] = currency0Addr; // tokenA
        path[1] = currency1Addr; // tokenB
        path[2] = address(tokenC);

        vm.startPrank(vaultStandIn);
        tokenA.approve(address(adapter), 10e18);
        uint256 amountOut = adapter.swap(path, 10e18, 1, vaultStandIn, recipient);
        vm.stopPrank();

        assertGt(amountOut, 0, "amountOut should be positive");
        assertEq(tokenC.balanceOf(recipient), amountOut, "recipient should receive amountOut of tokenC");
        assertEq(tokenB.balanceOf(address(adapter)), 0, "adapter should not retain intermediate tokenB");
    }

    function test_swap_revertsOnSlippage() public {
        address[] memory path = new address[](2);
        path[0] = currency0Addr;
        path[1] = currency1Addr;

        vm.startPrank(vaultStandIn);
        tokenA.approve(address(adapter), 10e18);
        vm.expectRevert();
        adapter.swap(path, 10e18, type(uint256).max, vaultStandIn, recipient);
        vm.stopPrank();
    }

    function test_swap_revertsWhenPoolNotSet() public {
        MockERC20 unknownToken = new MockERC20("Unknown", "UNK", 18);
        address[] memory path = new address[](2);
        path[0] = currency0Addr;
        path[1] = address(unknownToken);

        vm.startPrank(vaultStandIn);
        tokenA.approve(address(adapter), 10e18);
        vm.expectRevert(UniswapV4Adapter.PoolNotSet.selector);
        adapter.swap(path, 10e18, 0, vaultStandIn, recipient);
        vm.stopPrank();
    }

    function test_swap_revertsOnPathTooShort() public {
        address[] memory path = new address[](1);
        path[0] = currency0Addr;

        vm.startPrank(vaultStandIn);
        vm.expectRevert(UniswapV4Adapter.InvalidPath.selector);
        adapter.swap(path, 10e18, 0, vaultStandIn, recipient);
        vm.stopPrank();
    }

    function test_setPool_onlyAdmin() public {
        vm.expectRevert(UniswapV4Adapter.OnlyAdmin.selector);
        adapter.setPool(currency0Addr, currency1Addr, FEE, TICK_SPACING, address(0));
    }

    /// @dev Review #13: swap pulls from an arbitrary `from`, so an unauthorized caller must
    ///      not be able to spend someone else's allowance to the adapter.
    function test_swap_revertsForUnauthorizedCaller_evenWithVictimAllowance() public {
        address[] memory path = new address[](2);
        path[0] = currency0Addr;
        path[1] = currency1Addr;

        vm.prank(vaultStandIn);
        tokenA.approve(address(adapter), type(uint256).max);

        address attacker = address(0xBAD);
        vm.prank(attacker);
        vm.expectRevert(UniswapV4Adapter.NotAuthorizedCaller.selector);
        adapter.swap(path, 10e18, 0, vaultStandIn, attacker);
    }

    /// @dev Review #12: a pool with a non-allowlisted hook cannot be registered.
    function test_setPool_rejectsHookUntilAllowlisted() public {
        address hook = address(0x4444);
        vm.startPrank(admin);
        vm.expectRevert(UniswapV4Adapter.HookNotAllowed.selector);
        adapter.setPool(currency0Addr, address(tokenC), FEE, TICK_SPACING, hook);

        adapter.setHookAllowed(hook, true);
        adapter.setPool(currency0Addr, address(tokenC), FEE, TICK_SPACING, hook);
        vm.stopPrank();
    }

    function test_constructor_revertsOnZeroAddress() public {
        vm.expectRevert(UniswapV4Adapter.ZeroAddress.selector);
        new UniswapV4Adapter(address(0), admin);

        vm.expectRevert(UniswapV4Adapter.ZeroAddress.selector);
        new UniswapV4Adapter(address(manager), address(0));
    }

    function test_setPool_revertsOnZeroToken() public {
        vm.startPrank(admin);

        vm.expectRevert(UniswapV4Adapter.ZeroAddress.selector);
        adapter.setPool(address(0), currency1Addr, FEE, TICK_SPACING, address(0));

        vm.expectRevert(UniswapV4Adapter.ZeroAddress.selector);
        adapter.setPool(currency0Addr, address(0), FEE, TICK_SPACING, address(0));

        vm.stopPrank();
    }

    function test_unlockCallback_revertsForNonPoolManager() public {
        vm.expectRevert(UniswapV4Adapter.OnlyPoolManager.selector);
        adapter.unlockCallback("");
    }

    function _initHookPoolAndSeed() internal returns (address hookAddr) {
        hookAddr = address(
            uint160(
                Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG
                    | Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG
            )
        );

        address implementation = address(new DeltaReturningHook(IPoolManager(address(manager))));
        vm.etch(hookAddr, implementation.code);

        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(currency0Addr),
            currency1: Currency.wrap(currency1Addr),
            fee: FEE,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(hookAddr)
        });

        manager.initialize(key, SQRT_PRICE_1_1);

        vm.startPrank(lp);
        tokenA.approve(address(liquidityRouter), type(uint256).max);
        tokenB.approve(address(liquidityRouter), type(uint256).max);

        liquidityRouter.modifyLiquidity(
            key,
            IPoolManager.ModifyLiquidityParams({tickLower: -60000, tickUpper: 60000, liquidityDelta: 100e18, salt: 0}),
            ""
        );
        vm.stopPrank();

        vm.startPrank(admin);
        adapter.setHookAllowed(hookAddr, true);
        adapter.setPool(currency0Addr, currency1Addr, FEE, TICK_SPACING, hookAddr);
        vm.stopPrank();
    }

    function test_swap_withBeforeSwapSpecifiedDelta() public {
        address hookAddr = _initHookPoolAndSeed();

        // The hook settles 1 token of specified currency into the PoolManager.
        tokenA.mint(hookAddr, 1e18);
        DeltaReturningHook(hookAddr).setDeltaSpecified(-int128(1e18));

        address[] memory path = new address[](2);
        path[0] = currency0Addr;
        path[1] = currency1Addr;

        uint256 recipientBefore = tokenB.balanceOf(recipient);

        vm.startPrank(vaultStandIn);
        tokenA.approve(address(adapter), 10e18);
        uint256 amountOut = adapter.swap(path, 10e18, 1, vaultStandIn, recipient);
        vm.stopPrank();

        assertGt(amountOut, 0);
        assertEq(tokenB.balanceOf(recipient) - recipientBefore, amountOut);
        assertEq(tokenA.balanceOf(vaultStandIn), 990e18);
    }

    function test_swap_withAfterSwapUnspecifiedDelta() public {
        address hookAddr = _initHookPoolAndSeed();

        // The hook takes 1 token of unspecified currency from the PoolManager.
        DeltaReturningHook(hookAddr).setDeltaUnspecifiedAfterSwap(int128(1e18));

        address[] memory path = new address[](2);
        path[0] = currency0Addr;
        path[1] = currency1Addr;

        uint256 recipientBefore = tokenB.balanceOf(recipient);
        uint256 hookBefore = tokenB.balanceOf(hookAddr);

        vm.startPrank(vaultStandIn);
        tokenA.approve(address(adapter), 10e18);
        uint256 amountOut = adapter.swap(path, 10e18, 1, vaultStandIn, recipient);
        vm.stopPrank();

        assertGt(amountOut, 0);
        assertEq(tokenB.balanceOf(recipient) - recipientBefore, amountOut);
        assertEq(tokenB.balanceOf(hookAddr) - hookBefore, 1e18);
    }

    function test_swap_withHookDeltas_zeroValues_preservesNormalSwap() public {
        _initHookPoolAndSeed();

        address[] memory path = new address[](2);
        path[0] = currency0Addr;
        path[1] = currency1Addr;

        vm.startPrank(vaultStandIn);
        tokenA.approve(address(adapter), 10e18);
        uint256 amountOut = adapter.swap(path, 10e18, 1, vaultStandIn, recipient);
        vm.stopPrank();

        assertGt(amountOut, 0);
        assertEq(tokenB.balanceOf(recipient), amountOut);
    }

    function test_swap_withNegativeBeforeSwapSpecifiedDelta_hookFundsAdditionalInput() public {
        address hookAddr = _initHookPoolAndSeed();

        // The hook contributes 1 token toward the pool's input.
        tokenA.mint(hookAddr, 1e18);

        vm.prank(hookAddr);
        tokenA.approve(address(manager), type(uint256).max);

        DeltaReturningHook(hookAddr).setDeltaSpecified(-int128(1e18));

        address[] memory path = new address[](2);
        path[0] = currency0Addr;
        path[1] = currency1Addr;

        uint256 vaultBefore = tokenA.balanceOf(vaultStandIn);
        uint256 hookBefore = tokenA.balanceOf(hookAddr);

        vm.startPrank(vaultStandIn);
        tokenA.approve(address(adapter), 10e18);

        uint256 amountOut = adapter.swap(path, 10e18, 1, vaultStandIn, recipient);
        vm.stopPrank();

        assertGt(amountOut, 0);
        assertEq(vaultBefore - tokenA.balanceOf(vaultStandIn), 10e18);
        assertEq(hookBefore - tokenA.balanceOf(hookAddr), 1e18);
        assertEq(tokenB.balanceOf(recipient), amountOut);
    }

    function test_swap_revertsWhenHookConsumesMoreOutputThanAvailable() public {
        address hookAddr = _initHookPoolAndSeed();

        // The hook tries to take more output than the pool generates.
        DeltaReturningHook(hookAddr).setDeltaUnspecifiedAfterSwap(int128(11e18));

        address[] memory path = new address[](2);
        path[0] = currency0Addr;
        path[1] = currency1Addr;

        vm.startPrank(vaultStandIn);
        tokenA.approve(address(adapter), 10e18);

        vm.expectRevert(UniswapV4Adapter.UnsupportedHookDelta.selector);
        adapter.swap(path, 10e18, 0, vaultStandIn, recipient);
        vm.stopPrank();
    }

    function test_swap_withPositiveBeforeSwapSpecifiedDelta_refundsUnusedInput() public {
        address hookAddr = _initHookPoolAndSeed();

        // Positive specified delta reduces the input the pool consumes.
        // The hook takes this amount from the PoolManager.
        tokenA.mint(hookAddr, 1e18);
        DeltaReturningHook(hookAddr).setDeltaSpecified(int128(1e18));

        address[] memory path = new address[](2);
        path[0] = currency0Addr;
        path[1] = currency1Addr;

        uint256 vaultBefore = tokenA.balanceOf(vaultStandIn);
        uint256 hookBefore = tokenA.balanceOf(hookAddr);

        vm.startPrank(vaultStandIn);
        tokenA.approve(address(adapter), 10e18);
        uint256 amountOut = adapter.swap(path, 10e18, 1, vaultStandIn, recipient);
        vm.stopPrank();

        assertGt(amountOut, 0);
        assertEq(tokenA.balanceOf(hookAddr) - hookBefore, 1e18);
        assertEq(tokenA.balanceOf(vaultStandIn), vaultBefore - 10e18);
        assertEq(tokenB.balanceOf(recipient), amountOut);
    }
}
