// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.6;

import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "../interfaces/IFactory.sol";
import "../interfaces/IShop.sol";
import "../interfaces/IDao.sol";
import "../interfaces/IPrivateExitModule.sol";

contract LaunchpadModule is OwnableUpgradeable {
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    IFactory public factory;
    IShop public shop;
    IPrivateExitModule public privateExitModule;

    struct Sale {
        address currency;
        uint256 rate;
        bool isFinite;
        bool isLimitedTotalSaleAmount;
        bool isWhitelist;
        bool isAllocation;
        uint256 endTimestamp;
        uint256 totalSaleAmount;
        EnumerableSetUpgradeable.AddressSet whitelist;
        mapping(address => uint256) allocations;
    }

    mapping(address => mapping(uint256 => Sale)) private sales;

    mapping(address => uint256) public saleIndexes;

    mapping(address => mapping(uint256 => mapping(address => bool)))
        public bought;

    mapping(address => mapping(uint256 => uint256)) public totalBought;

    event InitSale(
        address indexed daoAddress,
        uint256 indexed saleId,
        address currency,
        uint256 rate,
        bool[4] limits,
        uint256 _endTimestamp,
        uint256 _totalSaleAmount,
        address[] _addWhitelist,
        uint256[] _allocations,
        address[] _removeWhitelist
    );

    event CloseSale(address indexed daoAddress, uint256 indexed saleId);

    event Buy(
        address indexed daoAddress,
        uint256 indexed saleId,
        address indexed buyer,
        uint256 currencyAmount,
        uint256 lpAmount
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {
        __Ownable_init();
    }

    function initialize() public initializer {
        __Ownable_init();
    }

    function setCoreAddresses(
        IFactory _factory,
        IShop _shop,
        IPrivateExitModule _privateExitModule
    ) external onlyOwner {
        factory = _factory;
        shop = _shop;
        privateExitModule = _privateExitModule;
    }

    modifier onlyDao() {
        require(
            factory.containsDao(msg.sender),
            "LaunchpadModule: only for DAOs"
        );
        _;
    }

    function initSale(
        address _currency,
        uint256 _rate,
        bool[4] calldata _limits,
        uint256 _endTimestamp,
        uint256 _totalSaleAmount,
        address[] calldata _addWhitelist,
        uint256[] calldata _allocations,
        address[] calldata _removeWhitelist
    ) external onlyDao {
        require(
            _addWhitelist.length == _allocations.length,
            "LaunchpadModule: Invalid Whitelist Length"
        );

        Sale storage sale = sales[msg.sender][saleIndexes[msg.sender]];

        sale.currency = _currency;
        sale.rate = _rate;
        sale.isFinite = _limits[0];
        sale.isLimitedTotalSaleAmount = _limits[1];
        sale.isWhitelist = _limits[2];
        sale.isAllocation = _limits[3];
        sale.endTimestamp = _endTimestamp;
        sale.totalSaleAmount = _totalSaleAmount;

        for (uint256 i = 0; i < _addWhitelist.length; i++) {
            sale.whitelist.add(_addWhitelist[i]);
            sale.allocations[_addWhitelist[i]] = _allocations[i];
        }

        for (uint256 i = 0; i < _removeWhitelist.length; i++) {
            sale.whitelist.remove(_removeWhitelist[i]);
        }

        emit InitSale(
            msg.sender,
            saleIndexes[msg.sender],
            _currency,
            _rate,
            _limits,
            _endTimestamp,
            _totalSaleAmount,
            _addWhitelist,
            _allocations,
            _removeWhitelist
        );
    }

    function fillLpBalance(address _dao, uint256 _id) external {
        require(shop.buyPrivateOffer(_dao, _id));
    }

    function closeSale() external onlyDao {
        saleIndexes[msg.sender]++;

        emit CloseSale(msg.sender, saleIndexes[msg.sender] - 1);
    }

    function burnLp(address _dao, uint256 _id) external {
        require(factory.containsDao(_dao), "LaunchpadModule: only for DAOs");

        IERC20Upgradeable lp = IERC20Upgradeable(IDao(_dao).lp());

        require(
            lp.approve(address(privateExitModule), lp.balanceOf(address(this)))
        );

        require(privateExitModule.privateExit(_dao, _id));
    }

    function buy(address _dao, uint256 _currencyAmount) external {
        uint256 saleIndex = saleIndexes[_dao];

        require(
            !bought[_dao][saleIndex][msg.sender],
            "LaunchpadModule: already bought"
        );

        Sale storage sale = sales[_dao][saleIndex];

        if (sale.isFinite) {
            require(
                block.timestamp <= sale.endTimestamp,
                "LaunchpadModule: sale is over"
            );
        }

        uint256 currencyAmount;

        if (sale.isAllocation) {
            currencyAmount = sale.allocations[msg.sender];
        } else {
            currencyAmount = _currencyAmount;
        }

        if (sale.isLimitedTotalSaleAmount) {
            require(
                totalBought[_dao][saleIndex] + currencyAmount <=
                    sale.totalSaleAmount,
                "LaunchpadModule: limit exceeded"
            );
        }

        if (sale.isWhitelist) {
            require(
                sale.whitelist.contains(msg.sender),
                "LaunchpadModule: the buyer is not whitelisted"
            );
        }

        bought[_dao][saleIndex][msg.sender] = true;

        totalBought[_dao][saleIndex] += currencyAmount;

        IERC20Upgradeable(sale.currency).safeTransferFrom(
            msg.sender,
            _dao,
            currencyAmount
        );

        uint256 lpAmount = (currencyAmount * 1 ether) / sale.rate;

        IERC20Upgradeable(IDao(_dao).lp()).safeTransfer(msg.sender, lpAmount);

        emit Buy(_dao, saleIndex, msg.sender, currencyAmount, lpAmount);
    }

    struct SaleInfo {
        address currency;
        uint256 rate;
        bool isFinite;
        bool isLimitedTotalSaleAmount;
        bool isWhitelist;
        bool isAllocation;
        uint256 endTimestamp;
        uint256 totalSaleAmount;
        address[] whitelist;
        uint256[] allocations;
    }

    function getSaleInfo(address _dao, uint256 _saleIndex)
        external
        view
        returns (SaleInfo memory)
    {
        Sale storage sale = sales[_dao][_saleIndex];

        address[] memory whitelist = sale.whitelist.values();

        uint256[] memory allocations = new uint256[](whitelist.length);

        for (uint256 i = 0; i < allocations.length; i++) {
            allocations[i] = sale.allocations[whitelist[i]];
        }

        return
            SaleInfo({
                currency: sale.currency,
                rate: sale.rate,
                isFinite: sale.isFinite,
                isLimitedTotalSaleAmount: sale.isLimitedTotalSaleAmount,
                isWhitelist: sale.isWhitelist,
                isAllocation: sale.isAllocation,
                endTimestamp: sale.endTimestamp,
                totalSaleAmount: sale.totalSaleAmount,
                whitelist: whitelist,
                allocations: allocations
            });
    }
}
