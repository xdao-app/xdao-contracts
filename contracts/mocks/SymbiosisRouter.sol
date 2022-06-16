// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./SymbiosisRouterGateway.sol";

contract SymbiosisRouter {
    SymbiosisRouterGateway public immutable metaRouterGateway;

    constructor(SymbiosisRouterGateway _metaRouterGateway) {
        metaRouterGateway = _metaRouterGateway;
    }

    function mockSwapToken(IERC20 fromToken, uint256 swapAmount) external {
        metaRouterGateway.mockGatewaySwapToken(
            fromToken,
            swapAmount,
            msg.sender
        );
    }

    function mockSwapEth(uint256 swapAmount) external payable {
        require(msg.value == swapAmount);
        metaRouterGateway.mockGatewaySwapEth{value: swapAmount}(swapAmount);
    }
}
