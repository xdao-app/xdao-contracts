// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";

import "../interfaces/IDaoViewer.sol";
import "../interfaces/IDao.sol";

contract AdvancedViewer {
    using Address for address;

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

        uint256 j = 0;

        for (uint256 i = start; i < end; i++) {
            address daoAddress = abi.decode(
                _factory.functionStaticCall(
                    abi.encodeWithSelector(hex"b2dabed4", i)
                ),
                (address)
            );

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

        for (uint256 i = start; i < end; i++) {
            address daoAddress = abi.decode(
                _factory.functionStaticCall(
                    abi.encodeWithSelector(hex"b2dabed4", i)
                ),
                (address)
            );

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

    function getDaosExecutedVoting(address[] memory daoAddresses)
        external
        view
        returns (uint256[] memory)
    {
        uint256[] memory daosExecutedVoting = new uint256[](
            daoAddresses.length
        );

        for (uint256 i = 0; i < daoAddresses.length; i++) {
            daosExecutedVoting[i] = (IDao(daoAddresses[i]).getExecutedVoting())
                .length;
        }

        return daosExecutedVoting;
    }

    function read(address[] calldata targets, bytes[] calldata data)
        external
        view
        returns (bytes[] memory results)
    {
        results = new bytes[](targets.length);

        for (uint256 i = 0; i < targets.length; i++) {
            results[i] = targets[i].functionStaticCall(data[i]);
        }
    }
}
