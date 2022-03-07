//SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

interface IPrivateExitModule {
    function privateExit(address _daoAddress, uint256 _offerId)
        external
        returns (bool success);
}
