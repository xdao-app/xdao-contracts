//SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

interface IDaoVestingModule {
    struct Vesting {
        address currency;
        uint256 start;
        uint256 duration;
        address[] claimers;
        uint256[] allocations;
    }

    function addAllocation(
        address _dao,
        uint256 _vestingId,
        address _claimer,
        uint256 _allocation
    ) external;

    function getVesting(
        address _dao,
        uint256 _vestingId
    ) external view returns (Vesting memory);
}
