// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract XDAOTimelock {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;

    address public immutable beneficiary;

    uint256[] public timestamps;

    uint256[] public amounts;

    uint8 public unlocks = 0;

    constructor(
        IERC20 _token,
        address _beneficiary,
        uint256[] memory _timestamps,
        uint256[] memory _amounts
    ) {
        token = _token;
        beneficiary = _beneficiary;
        timestamps = _timestamps;
        amounts = _amounts;
    }

    function release() external returns (bool) {
        require(block.timestamp >= timestamps[unlocks], "Too early");

        token.safeTransfer(beneficiary, amounts[unlocks]);

        unlocks++;

        return true;
    }

    function getState()
        public
        view
        returns (
            address,
            address,
            uint8,
            uint256[] memory,
            uint256[] memory,
            uint256
        )
    {
        return (
            address(token),
            beneficiary,
            unlocks,
            timestamps,
            amounts,
            token.balanceOf(address(this))
        );
    }
}
