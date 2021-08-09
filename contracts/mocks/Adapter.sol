//SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

contract Adapter {
    function withdraw(
        address,
        address,
        uint256 // multiplied by 1e18, for example 20% = 2e17
    ) external pure returns (bool) {
        return true;
    }
}
