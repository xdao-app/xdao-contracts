// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.6;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "../interfaces/IFactory.sol";

contract PayrollModule is Initializable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    IFactory public factory;

    struct Payroll {
        address recipient;
        uint256 activeUntilTimestamp;
        address currency;
        uint256 amountPerSecond;
        uint256 lastClaimTimestamp;
    }

    mapping(address => uint256) public numberOfPayrolls;

    mapping(address => mapping(uint256 => Payroll)) public payrolls;

    function initialize(IFactory _factory) public initializer {
        factory = _factory;
    }

    event InitPayroll(
        uint256 indexed payrollId,
        address indexed daoAddress,
        address indexed recipient,
        uint256 activeUntilTimestamp,
        address currency,
        uint256 amountPerSecond,
        uint256 lastClaimTimestamp
    );

    event ClaimPayroll(
        uint256 indexed payrollId,
        address indexed daoAddress,
        address indexed recipient,
        address currency,
        uint256 amount
    );

    event ChangePayrollAmount(uint256 indexed payrollId, uint256 amount);

    event Dismiss(uint256 indexed payrollId);

    modifier onlyDao() {
        require(
            factory.containsDao(msg.sender),
            "PayrollModule: only for DAOs"
        );
        _;
    }

    function initPayroll(
        address _recipient,
        uint256 _activeUntilTimestamp,
        address _currency,
        uint256 _amountPerSecond,
        uint256 _lastClaimTimestamp
    ) external onlyDao {
        payrolls[msg.sender][numberOfPayrolls[msg.sender]] = Payroll({
            recipient: _recipient,
            activeUntilTimestamp: _activeUntilTimestamp,
            currency: _currency,
            amountPerSecond: _amountPerSecond,
            lastClaimTimestamp: _lastClaimTimestamp
        });

        emit InitPayroll(
            numberOfPayrolls[msg.sender],
            msg.sender,
            _recipient,
            _activeUntilTimestamp,
            _currency,
            _amountPerSecond,
            _lastClaimTimestamp
        );

        numberOfPayrolls[msg.sender]++;
    }

    function claimPayroll(address _dao, uint256 _payrollId) public {
        require(factory.containsDao(_dao), "PayrollModule: only for DAOs");

        Payroll storage payroll = payrolls[_dao][_payrollId];

        require(
            payroll.recipient != address(0),
            "PayrollModule: Unknown recipient"
        );

        require(
            payroll.activeUntilTimestamp >= payroll.lastClaimTimestamp,
            "PayrollModule: Payroll already claimed"
        );

        uint256 nextLastClaimTimestamp = block.timestamp >
            payroll.activeUntilTimestamp
            ? payroll.activeUntilTimestamp
            : block.timestamp;

        uint256 amount = payroll.amountPerSecond *
            (nextLastClaimTimestamp - payroll.lastClaimTimestamp);

        IERC20Upgradeable(payroll.currency).safeTransferFrom(
            _dao,
            payroll.recipient,
            amount
        );

        payroll.lastClaimTimestamp = nextLastClaimTimestamp;

        emit ClaimPayroll(
            _payrollId,
            _dao,
            payroll.recipient,
            payroll.currency,
            amount
        );
    }

    function changePayrollAmount(uint256 _payrollId, uint256 _amount)
        external
        onlyDao
    {
        claimPayroll(msg.sender, _payrollId);

        Payroll storage payroll = payrolls[msg.sender][_payrollId];

        payroll.amountPerSecond = _amount;

        emit ChangePayrollAmount(_payrollId, _amount);
    }

    function dismiss(uint256 _payrollId) external onlyDao {
        Payroll storage payroll = payrolls[msg.sender][_payrollId];

        payroll.activeUntilTimestamp = block.timestamp;

        claimPayroll(msg.sender, _payrollId);

        emit Dismiss(_payrollId);
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
