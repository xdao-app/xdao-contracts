//SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

interface IPrivateExitModule {
    function privateExit(
        address _daoAddress,
        uint256 _offerId
    ) external returns (bool success);

    struct PrivateExitOffer {
        bool isActive;
        address recipient;
        uint256 lpAmount;
        uint256 ethAmount;
    }

    function privateExitOffers(
        address _dao,
        uint256 _index
    ) external view returns (PrivateExitOffer memory);
}
