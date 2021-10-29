//SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import "../interfaces/IFactory.sol";
import "../interfaces/IDao.sol";
import "../interfaces/ILP.sol";
import "../interfaces/IShop.sol";

contract DaoViewer {
    struct DaoInfo {
        address dao;
        string daoName;
        string daoSymbol;
        address lp;
        string lpName;
        string lpSymbol;
    }

    function getDao(address _dao) public view returns (DaoInfo memory) {
        address lp = IDao(_dao).lp();

        if (lp == address(0)) {
            return
                DaoInfo({
                    dao: _dao,
                    daoName: IDao(_dao).name(),
                    daoSymbol: IDao(_dao).symbol(),
                    lp: address(0),
                    lpName: "",
                    lpSymbol: ""
                });
        }

        return
            DaoInfo({
                dao: _dao,
                daoName: IDao(_dao).name(),
                daoSymbol: IDao(_dao).symbol(),
                lp: lp,
                lpName: ILP(lp).name(),
                lpSymbol: ILP(lp).symbol()
            });
    }

    function getDaos(address _factory) public view returns (DaoInfo[] memory) {
        address[] memory _daosRaw = IFactory(_factory).getDaos();

        DaoInfo[] memory _daos = new DaoInfo[](_daosRaw.length);

        if (_daosRaw.length == 0) {
            return new DaoInfo[](0);
        } else {
            for (uint256 i = 0; i < _daosRaw.length; i++) {
                _daos[i] = getDao(_daosRaw[i]);
            }

            return _daos;
        }
    }

    function userDaos(address _user, address _factory)
        external
        view
        returns (DaoInfo[] memory)
    {
        DaoInfo[] memory _daos = getDaos(_factory);

        if (_daos.length == 0) {
            return new DaoInfo[](0);
        } else {
            DaoInfo[] memory _userDaos = new DaoInfo[](_daos.length);

            for (uint256 i = 0; i < _daos.length; i++) {
                if (IERC20Metadata(_daos[i].dao).balanceOf(_user) > 0) {
                    _userDaos[i] = _daos[i];
                }
            }

            return _userDaos;
        }
    }

    function getShare(address _dao, address[] memory _users)
        external
        view
        returns (
            uint256 share,
            uint256 totalSupply,
            uint8 quorum
        )
    {
        quorum = IDao(_dao).quorum();
        totalSupply = IERC20Metadata(_dao).totalSupply();

        if (_users.length == 0) {
            return (0, totalSupply, quorum);
        }

        share = 0;

        for (uint256 i = 0; i < _users.length; i++) {
            share += IERC20Metadata(_dao).balanceOf(_users[i]);
        }

        return (share, totalSupply, quorum);
    }

    function getShares(address _dao, address[][] memory _users)
        external
        view
        returns (
            uint256[] memory shares,
            uint256 totalSupply,
            uint8 quorum
        )
    {
        quorum = IDao(_dao).quorum();
        totalSupply = IERC20Metadata(_dao).totalSupply();

        shares = new uint256[](_users.length);

        for (uint256 i = 0; i < _users.length; i++) {
            if (_users[i].length == 0) {
                shares[i] = 0;
            } else {
                uint256 share = 0;

                for (uint256 j = 0; j < _users[i].length; j++) {
                    share += IERC20Metadata(_dao).balanceOf(_users[i][j]);
                }

                shares[i] = share;
            }
        }

        return (shares, totalSupply, quorum);
    }

    function balances(address[] memory users, address[] memory tokens)
        external
        view
        returns (uint256[] memory)
    {
        uint256[] memory addrBalances = new uint256[](
            tokens.length * users.length
        );

        for (uint256 i = 0; i < users.length; i++) {
            for (uint256 j = 0; j < tokens.length; j++) {
                uint256 addrIdx = j + tokens.length * i;

                if (tokens[j] != address(0x0)) {
                    addrBalances[addrIdx] = IERC20Metadata(tokens[j]).balanceOf(
                        users[i]
                    );
                } else {
                    addrBalances[addrIdx] = users[i].balance;
                }
            }
        }

        return addrBalances;
    }

    function getHashStatuses(address _dao, bytes32[] memory _txHashes)
        external
        view
        returns (bool[] memory)
    {
        bool[] memory hashStatuses = new bool[](_txHashes.length);

        for (uint256 i = 0; i < _txHashes.length; i++) {
            hashStatuses[i] = IDao(_dao).executedTx(_txHashes[i]);
        }

        return hashStatuses;
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

    function getDaoConfiguration(address _factory, address _dao)
        external
        view
        returns (DaoConfiguration memory)
    {
        address lp = IDao(_dao).lp();

        if (lp == address(0)) {
            return
                DaoConfiguration({
                    gtMintable: IDao(_dao).mintable(),
                    gtBurnable: IDao(_dao).burnable(),
                    lpAddress: address(0),
                    lpMintable: false,
                    lpBurnable: false,
                    lpMintableStatusFrozen: false,
                    lpBurnableStatusFrozen: false,
                    permittedLength: IDao(_dao).numberOfPermitted(),
                    adaptersLength: IDao(_dao).numberOfAdapters(),
                    monthlyCost: IFactory(_factory).monthlyCost(),
                    numberOfPrivateOffers: 0
                });
        } else {
            return
                DaoConfiguration({
                    gtMintable: IDao(_dao).mintable(),
                    gtBurnable: IDao(_dao).burnable(),
                    lpAddress: lp,
                    lpMintable: ILP(lp).mintable(),
                    lpBurnable: ILP(lp).burnable(),
                    lpMintableStatusFrozen: ILP(lp).mintableStatusFrozen(),
                    lpBurnableStatusFrozen: ILP(lp).burnableStatusFrozen(),
                    permittedLength: IDao(_dao).numberOfPermitted(),
                    adaptersLength: IDao(_dao).numberOfAdapters(),
                    monthlyCost: IFactory(_factory).monthlyCost(),
                    numberOfPrivateOffers: IShop(IFactory(_factory).shop())
                        .numberOfPrivateOffers(_dao)
                });
        }
    }

    function getInvestInfo(address _factory)
        external
        view
        returns (
            DaoInfo[] memory,
            IShop.PublicOffer[] memory,
            string[] memory,
            uint8[] memory,
            uint256[] memory
        )
    {
        DaoInfo[] memory daos = getDaos(_factory);

        uint256 daosLength = daos.length;

        if (daosLength == 0) {
            return (
                new DaoInfo[](0),
                new IShop.PublicOffer[](0),
                new string[](0),
                new uint8[](0),
                new uint256[](0)
            );
        }

        IShop.PublicOffer[] memory publicOffers = new IShop.PublicOffer[](
            daosLength
        );

        for (uint256 i = 0; i < daosLength; i++) {
            publicOffers[i] = IShop(IFactory(_factory).shop()).publicOffers(
                daos[i].dao
            );
        }

        string[] memory symbols = new string[](daosLength);
        uint8[] memory decimals = new uint8[](daosLength);

        for (uint256 i = 0; i < daosLength; i++) {
            if (publicOffers[i].currency != address(0)) {
                try IERC20Metadata(publicOffers[i].currency).symbol() returns (
                    string memory s
                ) {
                    symbols[i] = s;
                } catch {}

                try
                    IERC20Metadata(publicOffers[i].currency).decimals()
                returns (uint8 d) {
                    decimals[i] = d;
                } catch {}
            }
        }

        uint256[] memory numberOfPrivateOffers = new uint256[](daosLength);

        for (uint256 i = 0; i < daosLength; i++) {
            numberOfPrivateOffers[i] = IShop(IFactory(_factory).shop())
                .numberOfPrivateOffers(daos[i].dao);
        }

        return (daos, publicOffers, symbols, decimals, numberOfPrivateOffers);
    }

    function getPrivateOffersInfo(address _factory)
        external
        view
        returns (
            DaoInfo[] memory,
            uint256[] memory,
            IShop.PrivateOffer[] memory,
            string[] memory,
            uint8[] memory
        )
    {
        DaoInfo[] memory daos = getDaos(_factory);

        uint256 daosLength = daos.length;

        if (daosLength == 0) {
            return (
                new DaoInfo[](0),
                new uint256[](0),
                new IShop.PrivateOffer[](0),
                new string[](0),
                new uint8[](0)
            );
        }

        uint256[] memory totalPrivateOffers = new uint256[](daosLength);

        uint256 privateOffersLength = 0;

        IShop shop = IShop(IFactory(_factory).shop());

        for (uint256 i = 0; i < daosLength; i++) {
            uint256 numberOfPrivateOffers = shop.numberOfPrivateOffers(
                daos[i].dao
            );

            totalPrivateOffers[i] = numberOfPrivateOffers;

            privateOffersLength += numberOfPrivateOffers;
        }

        IShop.PrivateOffer[] memory privateOffers = new IShop.PrivateOffer[](
            privateOffersLength
        );

        string[] memory symbols = new string[](privateOffersLength);

        uint8[] memory decimals = new uint8[](privateOffersLength);

        uint256 indexCounter = 0;

        for (uint256 i = 0; i < daosLength; i++) {
            for (uint256 j = 0; j < totalPrivateOffers[i]; j++) {
                IShop.PrivateOffer memory privateOffer = shop.privateOffers(
                    daos[i].dao,
                    j
                );

                privateOffers[indexCounter] = privateOffer;

                try IERC20Metadata(privateOffer.currency).symbol() returns (
                    string memory s
                ) {
                    symbols[indexCounter] = s;
                } catch {}

                try IERC20Metadata(privateOffer.currency).decimals() returns (
                    uint8 d
                ) {
                    decimals[indexCounter] = d;
                } catch {}

                indexCounter++;
            }
        }

        return (daos, totalPrivateOffers, privateOffers, symbols, decimals);
    }
}
