// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract SymbiosisRouterGateway {
    function mockGatewaySwapToken(
        IERC20 fromToken,
        uint256 swapAmount,
        address sender
    ) external {
        fromToken.transferFrom(sender, address(this), swapAmount);
    }

    function mockGatewaySwapEth(uint256 swapAmount) external payable {
        require(msg.value == swapAmount);
    }
}
