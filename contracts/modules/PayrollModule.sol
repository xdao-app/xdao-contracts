// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.6;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";

import "../interfaces/IFactory.sol";

contract PayrollModule is Initializable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    IFactory public factory;

    struct Payroll {
        bool isActive;
        address recipient;
        uint256 payrollStartTimestamp;
        uint256 activeUntilTimestamp;
        address currency;
        uint256 amountPerSecond;
        uint256 lastClaimTimestamp;
    }

    mapping(address => uint256) public numberOfPayrolls;

    mapping(address => mapping(uint256 => Payroll)) public payrolls;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    function initialize(IFactory _factory) public initializer {
        factory = _factory;
    }

    event InitPayroll(
        uint256 indexed payrollId,
        address indexed daoAddress,
        address indexed recipient,
        uint256 payrollStartTimestamp,
        uint256 activeUntilTimestamp,
        address currency,
        uint256 amountPerSecond
    );

    event ClaimPayroll(
        uint256 indexed payrollId,
        address indexed daoAddress,
        address indexed recipient,
        address currency,
        uint256 amount,
        uint256 lastClaimTimestamp
    );

    event ChangePayrollAmountPerSecond(
        uint256 indexed payrollId,
        uint256 amount
    );

    event DisablePayroll(uint256 indexed payrollId);

    modifier onlyDao() {
        require(
            factory.containsDao(msg.sender),
            "PayrollModule: only for DAOs"
        );
        _;
    }

    function initPayroll(
        address _recipient,
        uint256 _payrollStartTimestamp,
        uint256 _activeUntilTimestamp,
        address _currency,
        uint256 _amountPerSecond
    ) external onlyDao {
        payrolls[msg.sender][numberOfPayrolls[msg.sender]] = Payroll({
            isActive: true,
            recipient: _recipient,
            payrollStartTimestamp: _payrollStartTimestamp,
            activeUntilTimestamp: _activeUntilTimestamp,
            currency: _currency,
            amountPerSecond: _amountPerSecond,
            lastClaimTimestamp: _payrollStartTimestamp
        });

        emit InitPayroll(
            numberOfPayrolls[msg.sender],
            msg.sender,
            _recipient,
            _payrollStartTimestamp,
            _activeUntilTimestamp,
            _currency,
            _amountPerSecond
        );

        numberOfPayrolls[msg.sender]++;
    }

    function claimPayroll(address _dao, uint256 _payrollId) external {
        require(factory.containsDao(_dao), "PayrollModule: only for DAOs");

        Payroll storage payroll = payrolls[_dao][_payrollId];

        require(
            payroll.recipient != address(0),
            "PayrollModule: Unknown recipient"
        );

        uint256 nextLastClaimTimestamp = MathUpgradeable.min(
            block.timestamp,
            payroll.activeUntilTimestamp
        );

        uint256 amount = payroll.amountPerSecond *
            (nextLastClaimTimestamp - payroll.lastClaimTimestamp);

        payroll.lastClaimTimestamp = nextLastClaimTimestamp;

        IERC20Upgradeable(payroll.currency).safeTransferFrom(
            _dao,
            payroll.recipient,
            amount
        );

        emit ClaimPayroll(
            _payrollId,
            _dao,
            payroll.recipient,
            payroll.currency,
            amount,
            nextLastClaimTimestamp
        );
    }

    function changePayrollAmountPerSecond(
        uint256 _payrollId,
        uint256 _amountPerSecond
    ) external onlyDao {
        Payroll storage payroll = payrolls[msg.sender][_payrollId];

        require(payroll.isActive, "PayrollModule: Payroll is not active");

        payroll.amountPerSecond = _amountPerSecond;

        emit ChangePayrollAmountPerSecond(_payrollId, _amountPerSecond);
    }

    function disablePayroll(uint256 _payrollId) external onlyDao {
        Payroll storage payroll = payrolls[msg.sender][_payrollId];

        require(payroll.isActive, "PayrollModule: Payroll is not active");

        payroll.activeUntilTimestamp = MathUpgradeable.min(
            block.timestamp,
            payroll.activeUntilTimestamp
        );

        payroll.isActive = false;

        emit DisablePayroll(_payrollId);
    }

    function getDaoPayrolls(address _dao)
        external
        view
        returns (Payroll[] memory)
    {
        Payroll[] memory daoPayrolls = new Payroll[](numberOfPayrolls[_dao]);

        for (uint256 i = 0; i < numberOfPayrolls[_dao]; i++) {
            daoPayrolls[i] = payrolls[_dao][i];
        }

        return daoPayrolls;
    }
}
