// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "../interfaces/ILP.sol";

interface IDaoPrivateExitModule {
    function lp() external view returns (address);

    function executePermitted(
        address _target,
        bytes calldata _data,
        uint256 _value
    ) external returns (bool);
}

interface ILPPrivateExitModule {
    function burn(
        uint256 _amount,
        address[] memory _tokens,
        address[] memory _adapters,
        address[] memory _pools
    ) external returns (bool);
}

contract PrivateExitModule is ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Address for address payable;

    struct PrivateExitOffer {
        bool isActive;
        address recipient;
        uint256 lpAmount;
        uint256 ethAmount;
        address[] tokenAddresses;
        uint256[] tokenAmounts;
    }

    mapping(address => mapping(uint256 => PrivateExitOffer))
        public privateExitOffers; // privateExitOffers[dao][offerId]

    mapping(address => uint256) public numberOfPrivateOffers;

    event PrivateExit(
        address indexed recipient,
        uint256 indexed lpAmount,
        uint256 ethAmount,
        address[] tokenAddresses,
        uint256[] tokenAmounts
    );

    function createPrivateExitOffer(
        address _recipient,
        uint256 _lpAmount,
        uint256 _ethAmount,
        address[] memory _tokenAddresses,
        uint256[] memory _tokenAmounts
    ) external returns (bool success) {
        require(
            _tokenAddresses.length == _tokenAmounts.length,
            "PrivateExitModule: Invalid Tokens"
        );

        privateExitOffers[msg.sender][
            numberOfPrivateOffers[msg.sender]
        ] = PrivateExitOffer({
            isActive: true,
            recipient: _recipient,
            lpAmount: _lpAmount,
            ethAmount: _ethAmount,
            tokenAddresses: _tokenAddresses,
            tokenAmounts: _tokenAmounts
        });

        numberOfPrivateOffers[msg.sender]++;

        return true;
    }

    function disablePrivateExitOffer(uint256 _offerId)
        external
        returns (bool success)
    {
        require(
            privateExitOffers[msg.sender][_offerId].isActive == true,
            "PrivateExitModule: Already Disabled"
        );

        privateExitOffers[msg.sender][_offerId].isActive = false;

        return true;
    }

    function privateExit(address _daoAddress, uint256 _offerId)
        external
        nonReentrant
        returns (bool success)
    {
        PrivateExitOffer storage offer = privateExitOffers[_daoAddress][
            _offerId
        ];

        require(offer.isActive, "PrivateExitModule: Offer is Disabled");

        offer.isActive = false;

        require(
            offer.recipient == msg.sender,
            "PrivateExitModule: Invalid Recipient"
        );

        IDaoPrivateExitModule dao = IDaoPrivateExitModule(_daoAddress);

        address lpAddress = dao.lp();

        bool burnableStatus = ILP(lpAddress).burnable();

        require(
            burnableStatus || !ILP(lpAddress).burnableStatusFrozen(),
            "PrivateExitModule: LP is not Burnable"
        );

        if (!burnableStatus) {
            dao.executePermitted(
                lpAddress,
                abi.encodeWithSignature("changeBurnable(bool)", true),
                0
            );
        }

        IERC20(lpAddress).safeTransferFrom(
            msg.sender,
            address(this),
            offer.lpAmount
        );

        IERC20(lpAddress).approve(lpAddress, offer.lpAmount);

        address[] memory emptyAddressArray = new address[](0);

        ILPPrivateExitModule(lpAddress).burn(
            offer.lpAmount,
            emptyAddressArray,
            emptyAddressArray,
            emptyAddressArray
        );

        for (uint256 i = 0; i < offer.tokenAddresses.length; i++) {
            if (offer.tokenAmounts[i] > 0) {
                dao.executePermitted(
                    offer.tokenAddresses[i],
                    abi.encodeWithSignature(
                        "transfer(address,uint256)",
                        msg.sender,
                        offer.tokenAmounts[i]
                    ),
                    0
                );
            }
        }

        if (offer.ethAmount > 0) {
            dao.executePermitted(msg.sender, "", offer.ethAmount);
        }

        if (!burnableStatus) {
            dao.executePermitted(
                lpAddress,
                abi.encodeWithSignature("changeBurnable(bool)", false),
                0
            );
        }

        emit PrivateExit(
            offer.recipient,
            offer.lpAmount,
            offer.ethAmount,
            offer.tokenAddresses,
            offer.tokenAmounts
        );

        return true;
    }

    function getOffers(address _dao)
        external
        view
        returns (PrivateExitOffer[] memory)
    {
        PrivateExitOffer[] memory offers = new PrivateExitOffer[](
            numberOfPrivateOffers[_dao]
        );

        for (uint256 i = 0; i < numberOfPrivateOffers[_dao]; i++) {
            offers[i] = privateExitOffers[_dao][i];
        }

        return offers;
    }

    event Received(address indexed, uint256);

    receive() external payable {
        payable(msg.sender).sendValue(msg.value);

        emit Received(msg.sender, msg.value);
    }
}
