//SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

contract PayableFunction {
    function hello(uint256) external payable returns (bool) {
        return true;
    }
}
