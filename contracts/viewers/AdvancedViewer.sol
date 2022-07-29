// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../interfaces/IDaoViewer.sol";

contract AdvancedViewer {
    address private immutable factory;
    IDaoViewer private immutable daoViewer;

    constructor(address _factory, address _daoViewer) {
        factory = _factory;
        daoViewer = IDaoViewer(_daoViewer);
    }

    function userDaos(
        uint256 start,
        uint256 end,
        address user
    ) external view returns (address[] memory) {
        address _factory = factory;

        address[] memory _userDaos = new address[](30);

        uint j = 0;

        for (uint i = start; i < end; i++) {
            (bool s2, bytes memory r2) = _factory.staticcall(
                abi.encodeWithSelector(hex"b2dabed4", i)
            );
            require(s2);

            address daoAddress = abi.decode(r2, (address));

            if (IERC20(daoAddress).balanceOf(user) > 0) {
                _userDaos[j] = daoAddress;
                j++;
            }
        }

        return _userDaos;
    }

    function getDaos(uint256 start, uint256 end)
        external
        view
        returns (address[] memory)
    {
        address _factory = factory;

        address[] memory _daos = new address[](end - start);

        for (uint i = start; i < end; i++) {
            (bool s2, bytes memory r2) = _factory.staticcall(
                abi.encodeWithSelector(hex"b2dabed4", i)
            );
            require(s2);

            address daoAddress = abi.decode(r2, (address));

            _daos[i - start] = daoAddress;
        }

        return _daos;
    }

    function getDaosInfo(address[] memory daoAddresses)
        external
        view
        returns (DaoInfo[] memory)
    {
        DaoInfo[] memory daosInfo = new DaoInfo[](daoAddresses.length);

        for (uint256 i = 0; i < daoAddresses.length; i++) {
            daosInfo[i] = daoViewer.getDao(daoAddresses[i]);
        }

        return daosInfo;
    }
}
