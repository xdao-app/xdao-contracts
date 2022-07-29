//SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

import "../interfaces/IShop.sol";

struct DaoInfo {
    address dao;
    string daoName;
    string daoSymbol;
    address lp;
    string lpName;
    string lpSymbol;
}

struct DaoConfiguration {
    bool gtMintable;
    bool gtBurnable;
    address lpAddress;
    bool lpMintable;
    bool lpBurnable;
    bool lpMintableStatusFrozen;
    bool lpBurnableStatusFrozen;
    uint256 permittedLength;
    uint256 adaptersLength;
    uint256 monthlyCost;
    uint256 numberOfPrivateOffers;
}

interface IDaoViewer {
    function getDao(address _dao) external view returns (DaoInfo memory);

    function getDaos(address _factory) external view returns (DaoInfo[] memory);

    function userDaos(address _user, address _factory)
        external
        view
        returns (DaoInfo[] memory);

    function getShare(address _dao, address[] memory _users)
        external
        view
        returns (
            uint256 share,
            uint256 totalSupply,
            uint8 quorum
        );

    function getShares(address _dao, address[][] memory _users)
        external
        view
        returns (
            uint256[] memory shares,
            uint256 totalSupply,
            uint8 quorum
        );

    function balances(address[] memory users, address[] memory tokens)
        external
        view
        returns (uint256[] memory);

    function getHashStatuses(address _dao, bytes32[] memory _txHashes)
        external
        view
        returns (bool[] memory);

    function getDaoConfiguration(address _factory, address _dao)
        external
        view
        returns (DaoConfiguration memory);

    function getInvestInfo(address _factory)
        external
        view
        returns (
            DaoInfo[] memory,
            IShop.PublicOffer[] memory,
            string[] memory,
            uint8[] memory,
            uint256[] memory
        );

    function getPrivateOffersInfo(address _factory)
        external
        view
        returns (
            DaoInfo[] memory,
            uint256[] memory,
            IShop.PrivateOffer[] memory,
            string[] memory,
            uint8[] memory
        );
}
