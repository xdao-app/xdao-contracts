// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.6;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

import "../interfaces/IFactory.sol";
import "../interfaces/IShop.sol";

contract DaoVestingModule is
    Initializable,
    UUPSUpgradeable,
    AccessControlEnumerableUpgradeable
{
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;

    IFactory public factory;
    IShop public shop;
    address public crowdfundingAddress;

    struct ClaimerInfo {
        uint256 allocation;
        uint256 lastClaimedTimestamp;
    }

    struct Claimer {
        address claimer;
        uint256 allocation;
    }

    struct VestingInfo {
        address currency;
        uint256 start;
        uint256 duration;
        EnumerableSetUpgradeable.AddressSet claimers;
        mapping(address => ClaimerInfo) claimersInfo;
    }

    mapping(address => uint256) public numberOfVestings;
    // dao address => number of vestings
    mapping(address => mapping(uint256 => VestingInfo)) private vestings;
    // dao address => id => vesting info

    event InitVesting(
        address indexed daoAddress,
        uint256 indexed vestingId,
        address currency,
        uint256 start,
        uint256 duration,
        Claimer[] claimers
    );

    event Release(
        address indexed daoAddress,
        uint256 indexed vestingId,
        address claimer,
        uint256 amount
    );

    function initialize() public initializer {
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function setCoreAddresses(
        IFactory _factory,
        IShop _shop,
        address _crowdfundingAddress
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        factory = _factory;
        shop = _shop;
        crowdfundingAddress = _crowdfundingAddress;
    }

    modifier onlyDao() {
        _checkDao();
        _;
    }

    function _checkDao() internal view {
        require(
            factory.containsDao(msg.sender),
            "VestingModule: only for DAOs"
        );
    }

    modifier onlyPermittedContracts() {
        require(
            factory.containsDao(msg.sender) ||
                msg.sender == crowdfundingAddress,
            "VestingModule: only for DAOs"
        );
        _;
    }

    function _checkIndex(address _dao, uint256 _vestingId) internal view {
        require(
            numberOfVestings[_dao] > _vestingId,
            "VestingModule: invalid vesting id"
        );
    }

    function initVesting(
        address _currency,
        uint256 _start,
        uint256 _duration,
        Claimer[] calldata _claimers
    ) external onlyDao {
        VestingInfo storage vesting = vestings[msg.sender][
            numberOfVestings[msg.sender]
        ];

        vesting.currency = _currency;
        vesting.start = _start;
        vesting.duration = _duration;

        for (uint256 i = 0; i < _claimers.length; ++i) {
            vesting.claimers.add(_claimers[i].claimer);
            vesting.claimersInfo[_claimers[i].claimer].allocation = _claimers[i]
                .allocation;
        }

        ++numberOfVestings[msg.sender];

        emit InitVesting(
            msg.sender,
            numberOfVestings[msg.sender],
            _currency,
            _start,
            _duration,
            _claimers
        );
    }

    function addAllocation(
        address _dao,
        uint256 _vestingId,
        address _claimer,
        uint256 _allocation
    ) public onlyPermittedContracts {
        _checkIndex(_dao, _vestingId);
        _addAllocation(_dao, _vestingId, _claimer, _allocation);
    }

    function addAllocations(
        uint256 _vestingId,
        Claimer[] calldata _claimers
    ) external onlyDao {
        _checkIndex(msg.sender, _vestingId);
        for (uint256 i = 0; i < _claimers.length; ++i) {
            _addAllocation(
                msg.sender,
                _vestingId,
                _claimers[i].claimer,
                _claimers[i].allocation
            );
        }
    }

    function _addAllocation(
        address _dao,
        uint256 _vestingId,
        address _claimer,
        uint256 _allocation
    ) internal {
        VestingInfo storage vesting = vestings[_dao][_vestingId];
        vesting.claimers.add(_claimer);
        vesting.claimersInfo[_claimer].allocation += _allocation;
    }

    function fillLpBalance(address _dao, uint256 _id) external {
        require(shop.buyPrivateOffer(_dao, _id));
    }

    function release(address _dao, uint256 _vestingId) external {
        VestingInfo storage vesting = vestings[_dao][_vestingId];
        uint256 releasable_ = releasable(msg.sender, _dao, _vestingId);

        require(releasable_ != 0, "VestingModule: Not eligible for release");

        vesting.claimersInfo[msg.sender].lastClaimedTimestamp = block.timestamp;

        IERC20Upgradeable token = IERC20Upgradeable(vesting.currency);

        token.safeTransfer(msg.sender, releasable_);

        emit Release(_dao, _vestingId, msg.sender, releasable_);
    }

    function releasable(
        address _claimer,
        address _dao,
        uint256 _vestingId
    ) public view returns (uint256) {
        VestingInfo storage vesting = vestings[_dao][_vestingId];

        if (_vestingId >= numberOfVestings[_dao]) {
            return 0;
        }

        //Before the vesting begins
        if (block.timestamp <= vesting.start) {
            return 0;
        }

        uint256 lastClaimedTimestamp_ = vesting
            .claimersInfo[_claimer]
            .lastClaimedTimestamp;
        uint256 totalAllocation_ = vesting.claimersInfo[_claimer].allocation;

        if (lastClaimedTimestamp_ == 0) {
            lastClaimedTimestamp_ = vesting.start;
        }

        // After the end of vesting
        if (block.timestamp >= vesting.start + vesting.duration) {
            return
                ((vesting.start + vesting.duration - lastClaimedTimestamp_) *
                    totalAllocation_) / vesting.duration;
        }

        // During the vesting period
        return
            ((block.timestamp - lastClaimedTimestamp_) * totalAllocation_) /
            vesting.duration;
    }

    function lastClaimedTimestamp(
        address _claimer,
        address _dao,
        uint256 _vestingId
    ) external view returns (uint256) {
        VestingInfo storage vesting = vestings[_dao][_vestingId];
        return vesting.claimersInfo[_claimer].lastClaimedTimestamp;
    }

    struct Vesting {
        address currency;
        uint256 start;
        uint256 duration;
        address[] claimers;
        uint256[] allocations;
    }

    function getVesting(
        address _dao,
        uint256 _vestingId
    ) external view returns (Vesting memory) {
        VestingInfo storage vesting = vestings[_dao][_vestingId];

        address[] memory claimers = vesting.claimers.values();
        uint256[] memory allocations = new uint256[](claimers.length);

        for (uint256 i = 0; i < allocations.length; ++i) {
            allocations[i] = vesting.claimersInfo[claimers[i]].allocation;
        }

        return
            Vesting({
                currency: vesting.currency,
                start: vesting.start,
                duration: vesting.duration,
                claimers: claimers,
                allocations: allocations
            });
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
