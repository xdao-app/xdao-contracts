// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.6;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../interfaces/IDao.sol";

contract DividendsModule is ReentrancyGuard {
    using Address for address payable;
    using SafeERC20 for IERC20;

    function distributeEther(
        address[] calldata recipients,
        uint256[] calldata values
    ) external {
        uint256 total = 0;

        for (uint256 i = 0; i < recipients.length; i++) {
            total += values[i];
        }

        IDao(msg.sender).executePermitted(address(this), "", total);

        for (uint256 i = 0; i < recipients.length; i++) {
            payable(recipients[i]).sendValue(values[i]);
        }

        uint256 balance = address(this).balance;

        if (balance > 0) {
            payable(msg.sender).sendValue(balance);
        }
    }

    function distributeTokens(
        address token,
        address[] calldata recipients,
        uint256[] calldata values
    ) external {
        uint256 total = 0;

        for (uint256 i = 0; i < recipients.length; i++) {
            total += values[i];
        }

        IDao(msg.sender).executePermitted(
            token,
            abi.encodeWithSignature(
                "transfer(address,uint256)",
                address(this),
                total
            ),
            0
        );

        for (uint256 i = 0; i < recipients.length; i++) {
            IERC20(token).safeTransfer(recipients[i], values[i]);
        }

        uint256 balance = IERC20(token).balanceOf(address(this));

        if (balance > 0) {
            IERC20(token).safeTransfer(msg.sender, balance);
        }
    }
}
