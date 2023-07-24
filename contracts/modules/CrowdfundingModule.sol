// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.6;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";

import "../interfaces/IDao.sol";
import "../interfaces/IFactory.sol";
import "../interfaces/IDaoVestingModule.sol";
import "../interfaces/IShop.sol";
import "../interfaces/IPrivateExitModule.sol";

contract CrowdfundingModule is
    Initializable,
    UUPSUpgradeable,
    AccessControlEnumerableUpgradeable
{
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    IFactory public factory;
    IShop public shop;
    IPrivateExitModule public privateExitModule;
    IDaoVestingModule public vestingModule;

    address public feeAddress;
    uint32 public regularFeeRate;
    uint32 public discountFeeRate;

    struct Sale {
        address currency;
        address tokenAddress;
        uint256 rate;
        uint256 saleAmount;
        uint256 minimumEntranceAmount;
        uint256 maximumEntranceAmount;
        bool isFinite;
        bool isVesting;
        bool isWhitelist;
        bool isAllocation;
        uint256 endTimestamp;
        uint256 vestingId;
        EnumerableSetUpgradeable.AddressSet whitelist;
    }

    struct InvestorInfo {
        uint256 boughtAmount;
        uint256 allocation;
    }

    struct Whitelist {
        address investor;
        uint256 allocation;
    }

    mapping(address => uint256) public saleIndexes;
    // dao address => current sale index
    mapping(address => mapping(uint256 => Sale)) private crowdfundings;
    // dao address => sale index => sale info

    mapping(address => mapping(uint256 => mapping(address => InvestorInfo)))
        public investorsInfo;
    // dao address => sale index => investor address => bought amount

    mapping(address => mapping(uint256 => uint256)) public totalBoughtAmount;
    // dao address => sale index => total bought amount

    mapping(address => mapping(uint256 => uint256)) public totalSoldTokenAmount;
    // dao address => sale index => total sold token amount

    mapping(address => mapping(uint256 => uint256)) public filledTokenAmount;
    // dao address => sale index => total filled token amount

    event InitSale(
        address indexed daoAddress,
        uint256 indexed saleId,
        address currency,
        address token,
        uint256 rate,
        uint256 saleAmount,
        uint256 _endTimestamp,
        uint256 _vestingId,
        bool isFinite,
        bool isVesting,
        bool isWhitelist,
        bool isAllocation
    );

    event CloseSale(address indexed daoAddress, uint256 indexed saleId);

    event Buy(
        address indexed daoAddress,
        uint256 indexed saleId,
        address indexed buyer,
        address currencyAddress,
        address tokenAddress,
        uint256 currencyAmount,
        uint256 tokenAmount
    );

    function initialize() public initializer {
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function setCoreAddresses(
        IFactory _factory,
        IShop _shop,
        IPrivateExitModule _privateExitModule,
        IDaoVestingModule _vestingModule
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        factory = _factory;
        shop = _shop;
        privateExitModule = _privateExitModule;
        vestingModule = _vestingModule;
    }

    function setFee(
        address _feeAddress,
        uint32 _regularFeeRate,
        uint32 _discountFeeRate
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        feeAddress = _feeAddress;
        regularFeeRate = _regularFeeRate;
        discountFeeRate = _discountFeeRate;
    }

    modifier onlyDao() {
        _checkDao();
        _;
    }

    function _checkDao() internal view {
        require(
            factory.containsDao(msg.sender),
            "CrowdfundingModule: only for DAOs"
        );
    }

    function initSale(
        address _currency,
        address _token,
        uint256 _rate,
        uint256 _saleAmount,
        uint256 _endTimestamp,
        uint256 _vestingId,
        uint256[] calldata _entranceLimits,
        // minimumEntranceAmount, maximumEntranceAmount
        bool[4] calldata _limits,
        // isFinite, isVesting, isWhitelist, isAllocation
        Whitelist[] calldata _whitelist
    ) external onlyDao {
        if (_limits[1]) {
            require(
                vestingModule.getVesting(msg.sender, _vestingId).currency ==
                    _token,
                "CrowdfundingModule: Invalid vesting"
            );
        }

        Sale storage sale = crowdfundings[msg.sender][saleIndexes[msg.sender]];

        require(
            sale.saleAmount == 0,
            "CrowdfundingModule: Crowdfunding already exists"
        );

        sale.currency = _currency;
        sale.tokenAddress = _token;
        sale.rate = _rate;
        sale.isFinite = _limits[0];
        sale.isVesting = _limits[1];
        sale.isWhitelist = _limits[2];
        sale.isAllocation = _limits[3];
        sale.vestingId = _vestingId;

        _editSale(
            msg.sender,
            _saleAmount,
            _endTimestamp,
            _entranceLimits,
            new address[](0),
            _whitelist
        );

        emit InitSale(
            msg.sender,
            saleIndexes[msg.sender],
            sale.currency,
            sale.tokenAddress,
            sale.rate,
            sale.saleAmount,
            sale.endTimestamp,
            sale.vestingId,
            sale.isFinite,
            sale.isVesting,
            sale.isWhitelist,
            sale.isAllocation
        );
    }

    function editSale(
        uint256 _saleAmount,
        uint256 _endTimestamp,
        uint256[] calldata _entranceLimits,
        // minimumEntranceAmount, maximumEntranceAmount
        address[] calldata _removeWhitelist,
        Whitelist[] calldata _addWhitelist
    ) external onlyDao {
        Sale storage sale = crowdfundings[msg.sender][saleIndexes[msg.sender]];

        require(
            sale.saleAmount != 0,
            "CrowdfundingModule: Crowdfunding doesn't exists"
        );

        _editSale(
            msg.sender,
            _saleAmount,
            _endTimestamp,
            _entranceLimits,
            _removeWhitelist,
            _addWhitelist
        );
    }

    function _editSale(
        address _dao,
        uint256 _saleAmount,
        uint256 _endTimestamp,
        uint256[] memory _entranceLimits,
        // minimumEntranceAmount, maximumEntranceAmount
        address[] memory _removeWhitelist,
        Whitelist[] memory _addWhitelist
    ) internal {
        require(
            _entranceLimits.length <= 2,
            "CrowdfundingModule: Invalid Entrance Amount Limits"
        );
        require(_saleAmount > 0, "CrowdfundingModule: Invalid Sale Amount");

        Sale storage sale = crowdfundings[_dao][saleIndexes[_dao]];

        if (_entranceLimits.length == 2) {
            require(
                _entranceLimits[0] <= _entranceLimits[1],
                "CrowdfundingModule: Invalid Entrance Amount Limits"
            );
            sale.minimumEntranceAmount = _entranceLimits[0];
            sale.maximumEntranceAmount = _entranceLimits[1];
        } else {
            if (_entranceLimits.length == 1) {
                sale.maximumEntranceAmount = _entranceLimits[0];
            } else {
                sale.maximumEntranceAmount = _saleAmount;
            }
        }

        sale.saleAmount = _saleAmount;
        sale.endTimestamp = _endTimestamp;

        for (uint256 i = 0; i < _addWhitelist.length; ++i) {
            sale.whitelist.add(_addWhitelist[i].investor);
            investorsInfo[_dao][saleIndexes[_dao]][_addWhitelist[i].investor]
                .allocation = _addWhitelist[i].allocation;
        }
        for (uint256 i = 0; i < _removeWhitelist.length; ++i) {
            sale.whitelist.remove(_removeWhitelist[i]);
        }
    }

    function fillLpBalance(address _dao, uint256 _id) external {
        require(shop.buyPrivateOffer(_dao, _id));
    }

    function fillTokenBalance(
        address _dao,
        uint256 _saleIndex,
        uint256 _amount
    ) external {
        require(factory.containsDao(_dao), "CrowdfundingModule: only for DAOs");

        Sale storage sale = crowdfundings[_dao][_saleIndex];
        IERC20Upgradeable(sale.tokenAddress).safeTransferFrom(
            msg.sender,
            address(this),
            _amount
        );
        filledTokenAmount[_dao][_saleIndex] += _amount;
    }

    function closeSale(bool _isSendTokensBack) external onlyDao {
        uint256 currentIndex = saleIndexes[msg.sender];
        if (_isSendTokensBack) {
            // I am not sure here. Maybe It will be better to remove _isSendTokensBack
            // and check tokenAddress is not LP address then send tokens back if it's true
            address tokenAddress = crowdfundings[msg.sender][currentIndex]
                .tokenAddress;
            uint256 tokenAmount = filledTokenAmount[msg.sender][currentIndex];
            uint256 totalSoldToken = totalSoldTokenAmount[msg.sender][
                currentIndex
            ];

            IERC20Upgradeable(tokenAddress).safeTransfer(
                msg.sender,
                tokenAmount - totalSoldToken
            );
        }

        ++saleIndexes[msg.sender];
        emit CloseSale(msg.sender, currentIndex);
    }

    function burnLp(address _dao, uint256 _id) external {
        require(factory.containsDao(_dao), "CrowdfundingModule: only for DAOs");

        IERC20Upgradeable lp = IERC20Upgradeable(IDao(_dao).lp());

        require(
            lp.approve(address(privateExitModule), lp.balanceOf(address(this)))
        );

        require(privateExitModule.privateExit(_dao, _id));
    }

    function buy(
        address _dao,
        uint256 _currencyAmount,
        bool _isRegularFee
    ) external {
        uint256 saleIndex = saleIndexes[_dao];
        Sale storage sale = crowdfundings[_dao][saleIndex];

        if (sale.isFinite) {
            require(
                block.timestamp <= sale.endTimestamp,
                "CrowdfundingModule: sale is over"
            );
        }

        if (sale.isWhitelist) {
            require(
                sale.whitelist.contains(msg.sender),
                "CrowdfundingModule: the buyer is not whitelisted"
            );
        }

        uint256 currencyAmount;
        uint256 boughtAmount = investorsInfo[_dao][saleIndex][msg.sender]
            .boughtAmount;

        if (sale.isAllocation) {
            currencyAmount =
                investorsInfo[_dao][saleIndex][msg.sender].allocation -
                boughtAmount;
            require(currencyAmount > 0, "CrowdfundingModule: already bought");
        } else {
            require(
                _currencyAmount + boughtAmount >= sale.minimumEntranceAmount &&
                    _currencyAmount + boughtAmount <=
                    sale.maximumEntranceAmount,
                "CrowdfundingModule: amount is off the limits"
            );
            currencyAmount = _currencyAmount;
        }

        require(
            totalBoughtAmount[_dao][saleIndex] + currencyAmount <=
                sale.saleAmount,
            "CrowdfundingModule: limit exceeded"
        );

        investorsInfo[_dao][saleIndex][msg.sender]
            .boughtAmount += currencyAmount;
        totalBoughtAmount[_dao][saleIndex] += currencyAmount;

        uint256 feeAmount;
        if (_isRegularFee) {
            feeAmount = (currencyAmount * regularFeeRate) / 10000;
        } else {
            feeAmount = (currencyAmount * discountFeeRate) / 10000;
        }

        IERC20Upgradeable(sale.currency).safeTransferFrom(
            msg.sender,
            feeAddress,
            feeAmount
        );

        IERC20Upgradeable(sale.currency).safeTransferFrom(
            msg.sender,
            _dao,
            currencyAmount - feeAmount
        );

        uint256 tokenAmount = ((currencyAmount - feeAmount) *
            10 ** IERC20MetadataUpgradeable(sale.tokenAddress).decimals()) /
            sale.rate;
        totalSoldTokenAmount[_dao][saleIndex] += tokenAmount;

        if (sale.isVesting) {
            IERC20Upgradeable(sale.tokenAddress).safeTransfer(
                address(vestingModule),
                tokenAmount
            );

            vestingModule.addAllocation(
                _dao,
                sale.vestingId,
                msg.sender,
                tokenAmount
            );
        } else {
            IERC20Upgradeable(sale.tokenAddress).safeTransfer(
                msg.sender,
                tokenAmount
            );
        }

        emit Buy(
            _dao,
            saleIndex,
            msg.sender,
            sale.currency,
            sale.tokenAddress,
            currencyAmount,
            tokenAmount
        );
    }

    struct SaleInfo {
        address currency;
        address tokenAddress;
        uint256 rate;
        uint256 saleAmount;
        uint256 minimumEntranceAmount;
        uint256 maximumEntranceAmount;
        bool isFinite;
        bool isVesting;
        bool isWhitelist;
        bool isAllocation;
        uint256 endTimestamp;
        uint256 vestingId;
        address[] whitelist;
        uint256[] allocations;
    }

    function getSaleInfo(
        address _dao,
        uint256 _saleIndex
    ) external view returns (SaleInfo memory) {
        Sale storage sale = crowdfundings[_dao][_saleIndex];

        address[] memory whitelist = sale.whitelist.values();
        uint256[] memory allocations = new uint256[](whitelist.length);
        for (uint256 i = 0; i < allocations.length; ++i) {
            allocations[i] = investorsInfo[_dao][_saleIndex][whitelist[i]]
                .allocation;
        }

        return
            SaleInfo({
                currency: sale.currency,
                tokenAddress: sale.tokenAddress,
                rate: sale.rate,
                saleAmount: sale.saleAmount,
                minimumEntranceAmount: sale.minimumEntranceAmount,
                maximumEntranceAmount: sale.maximumEntranceAmount,
                isFinite: sale.isFinite,
                isVesting: sale.isVesting,
                isWhitelist: sale.isWhitelist,
                isAllocation: sale.isAllocation,
                endTimestamp: sale.endTimestamp,
                vestingId: sale.vestingId,
                whitelist: whitelist,
                allocations: allocations
            });
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
