//SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

interface IShop {
    function numberOfPrivateOffers(address _dao)
        external
        view
        returns (uint256);
}
