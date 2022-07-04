// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.6;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";

contract SymbiosisBridgeV1 is Initializable {
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using AddressUpgradeable for address;
    using AddressUpgradeable for address payable;

    address public metaRouter;
    address public metaRouterGateway;
    address public feeAddress;
    uint32 public feeRate;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    function initialize(
        address _metaRouter,
        address _metaRouterGateway,
        address _feeAddress,
        uint32 _feeRate
    ) public initializer {
        metaRouter = _metaRouter;
        metaRouterGateway = _metaRouterGateway;
        feeAddress = _feeAddress;
        feeRate = _feeRate;
    }

    function swapToken(
        IERC20Upgradeable fromToken,
        uint256 tokenAmount,
        bytes calldata data
    ) external {
        fromToken.transferFrom(msg.sender, address(this), tokenAmount);

        (uint256 feeAmount, uint256 swapAmount) = calculateAmounts(tokenAmount);

        fromToken.transfer(feeAddress, feeAmount);
        fromToken.approve(metaRouterGateway, swapAmount);

        metaRouter.functionCall(data);
    }

    function swapEth(bytes calldata data) external payable {
        (uint256 feeAmount, uint256 swapAmount) = calculateAmounts(msg.value);
        payable(feeAddress).sendValue(feeAmount);

        metaRouter.functionCallWithValue(data, swapAmount);
    }

    function calculateAmounts(uint256 fromAmount)
        public
        view
        returns (uint256 feeAmount, uint256 swapAmount)
    {
        feeAmount = (fromAmount * feeRate) / 10000;
        swapAmount = fromAmount - feeAmount;
    }
}
