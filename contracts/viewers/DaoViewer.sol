//SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../interfaces/IFactory.sol";
import "../interfaces/IDao.sol";
import "../interfaces/ILP.sol";

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
                if (IERC20(_daos[i].dao).balanceOf(_user) > 0) {
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
        totalSupply = IERC20(_dao).totalSupply();

        if (_users.length == 0) {
            return (0, totalSupply, quorum);
        }

        share = 0;

        for (uint256 i = 0; i < _users.length; i++) {
            share += IERC20(_dao).balanceOf(_users[i]);
        }

        return (share, totalSupply, quorum);
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
                    addrBalances[addrIdx] = IERC20(tokens[j]).balanceOf(
                        users[i]
                    );
                } else {
                    addrBalances[addrIdx] = users[i].balance;
                }
            }
        }

        return addrBalances;
    }
}
