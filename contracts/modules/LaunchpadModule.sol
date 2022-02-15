// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.6;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../interfaces/IShop.sol";
import "../interfaces/IDao.sol";
import "../interfaces/IPrivateExitModule.sol";

contract LaunchpadModule {
    using EnumerableSet for EnumerableSet.AddressSet;
    using SafeERC20 for IERC20;

    IShop public shop;
    IPrivateExitModule public privateExitModule;

    struct Sale {
        address currency;
        uint256 rate;
        bool isFinite;
        bool isLimitedTotalAmount;
        bool isWhitelist;
        bool isAllocation;
        uint256 endTimestamp;
        uint256 totalSaleAmount;
        EnumerableSet.AddressSet whitelist;
        mapping(address => uint256) allocations;
    }

    mapping(address => mapping(uint256 => Sale)) private sales;

    mapping(address => uint256) public saleIndexes;

    mapping(address => mapping(uint256 => mapping(address => bool)))
        public bought;

    constructor(IShop _shop, IPrivateExitModule _privateExitModule) {
        shop = _shop;
        privateExitModule = _privateExitModule;
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
    ) external returns (bool) {
        require(
            _addWhitelist.length == _allocations.length,
            "LaunchpadModule: Invalid Whitelist Length"
        );

        Sale storage sale = sales[msg.sender][saleIndexes[msg.sender]];

        sale.currency = _currency;
        sale.rate = _rate;
        sale.isFinite = _limits[0];
        sale.isLimitedTotalAmount = _limits[1];
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

        return true;
    }

    function fillLpBalance(address _dao, uint256 _id) external returns (bool) {
        require(shop.buyPrivateOffer(_dao, _id));

        return true;
    }

    function closeSale(bool _withPrivateExit, uint256 _id)
        external
        returns (bool)
    {
        saleIndexes[msg.sender]++;

        if (_withPrivateExit) {
            IERC20 lp = IERC20(IDao(msg.sender).lp());

            require(
                lp.approve(
                    address(privateExitModule),
                    lp.balanceOf(address(this))
                )
            );

            require(privateExitModule.privateExit(msg.sender, _id));
        }

        return true;
    }

    function buy(address _dao) external returns (bool) {
        uint256 saleIndex = saleIndexes[_dao];

        require(
            !bought[_dao][saleIndex][msg.sender],
            "LaunchpadModule: Already Bought"
        );

        bought[_dao][saleIndex][msg.sender] = true;

        Sale storage sale = sales[_dao][saleIndex];

        IERC20(sale.currency).safeTransferFrom(
            msg.sender,
            _dao,
            sale.allocations[msg.sender]
        );

        IERC20(IDao(_dao).lp()).safeTransfer(
            msg.sender,
            (sale.allocations[msg.sender] * 1 ether) / sale.rate
        );

        return true;
    }

    struct SaleInfo {
        address currency;
        uint256 rate;
        bool isFinite;
        bool isLimitedTotalAmount;
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
                isLimitedTotalAmount: sale.isLimitedTotalAmount,
                isWhitelist: sale.isWhitelist,
                isAllocation: sale.isAllocation,
                endTimestamp: sale.endTimestamp,
                totalSaleAmount: sale.totalSaleAmount,
                whitelist: whitelist,
                allocations: allocations
            });
    }
}
