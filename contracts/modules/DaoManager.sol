// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.6;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";

import "../interfaces/IDao.sol";
import "../interfaces/IFactory.sol";

contract DaoManager is
    Initializable,
    UUPSUpgradeable,
    AccessControlEnumerableUpgradeable
{
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using ECDSAUpgradeable for bytes32;
    IFactory public factory;

    mapping(address => uint256) public argsHashIndexes;
    // dao address => last id

    mapping(address => mapping(uint256 => bytes32)) private argsHashList;
    // dao address => id => args hash

    event Activated(
        address indexed dao,
        bytes32 indexed argsHash,
        uint256 txLength
    );

    function initialize(IFactory _factory) public initializer {
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);

        factory = _factory;
    }

    modifier onlyDao() {
        require(factory.containsDao(msg.sender), "DaoManager: only for DAOs");
        _;
    }

    function calculateArgsHash(
        address _dao,
        address[] memory _targetList,
        bytes[] memory _dataList,
        uint256[] memory _valueList
    ) public view returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    _dao,
                    _targetList,
                    _dataList,
                    _valueList,
                    block.chainid
                )
            );
    }

    function addArgsHash(bytes32 _hash) external onlyDao {
        require(_hash != bytes32(0), "DaoManager: Invalid argsHash");
        argsHashList[msg.sender][argsHashIndexes[msg.sender]] = _hash;
    }

    function activate(
        address _dao,
        address[] calldata _targetList,
        bytes[] calldata _dataList,
        uint256[] calldata _valueList,
        uint256 _nonce,
        uint256 _timestamp,
        bytes[] calldata _sigs
    ) external {
        require(factory.containsDao(_dao), "DaoManager: invalid DAO address");

        require(
            IERC20Upgradeable(_dao).balanceOf(msg.sender) > 0,
            "DaoManager: only for members"
        );

        require(
            _targetList.length > 0 &&
                _targetList.length == _dataList.length &&
                _targetList.length == _valueList.length,
            "DaoManager: Invalid Tx parameters"
        );

        bytes32 argsHash = calculateArgsHash(
            _dao,
            _targetList,
            _dataList,
            _valueList
        );

        IDao dao = IDao(_dao);

        dao.executePermitted(
            _dao,
            abi.encodeWithSignature("mint(address,uint256)", address(this), 1),
            0
        );

        dao.execute(
            address(this),
            abi.encodeWithSignature("addArgsHash(bytes32)", argsHash),
            0,
            _nonce,
            _timestamp,
            _sigs
        );

        dao.executePermitted(
            _dao,
            abi.encodeWithSignature("burn(address,uint256)", address(this), 1),
            0
        );

        _execute(_dao, _targetList, _dataList, _valueList);
    }

    function _execute(
        address _dao,
        address[] memory _targetList,
        bytes[] memory _dataList,
        uint256[] memory _valueList
    ) internal {
        uint256 argsHashIndex = argsHashIndexes[_dao];

        bytes32 argsHash = argsHashList[_dao][argsHashIndex];
        IDao dao = IDao(_dao);

        require(
            argsHash ==
                calculateArgsHash(_dao, _targetList, _dataList, _valueList),
            "DaoManager: Invalid Tx parameters"
        );

        for (uint256 i = 0; i < _targetList.length; ++i) {
            dao.executePermitted(_targetList[i], _dataList[i], _valueList[i]);
        }

        emit Activated(_dao, argsHash, _targetList.length);

        argsHashIndexes[_dao]++;
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
