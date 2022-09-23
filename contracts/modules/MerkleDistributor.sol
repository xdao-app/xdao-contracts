// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.6;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/MerkleProofUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155Upgradeable.sol";

contract MerkleDistributor is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    struct TreeInfo {
        bytes32 root;
        uint256 tokenId;
        address from;
    }

    IERC1155Upgradeable public token;

    mapping(uint256 => TreeInfo) public trees;
    mapping(uint256 => mapping(address => bool)) public claimed;
    uint256 public numberOfTrees;

    function claim(uint256 treeId, bytes32[] memory proof) external {
        TreeInfo memory tree = trees[treeId];

        require(
            !claimed[treeId][msg.sender] &&
                MerkleProofUpgradeable.verify(
                    proof,
                    tree.root,
                    keccak256(abi.encodePacked(msg.sender))
                ),
            "MerkleDistributor: Address is not a candidate for claim"
        );

        claimed[treeId][msg.sender] = true;

        token.safeTransferFrom(tree.from, msg.sender, tree.tokenId, 1, hex"");
    }

    function push(
        bytes32 root,
        uint256 tokenId,
        address from
    ) external onlyOwner {
        trees[numberOfTrees] = TreeInfo({
            root: root,
            tokenId: tokenId,
            from: from
        });

        numberOfTrees++;
    }

    function edit(
        uint256 treeId,
        bytes32 root,
        uint256 tokenId,
        address from
    ) external onlyOwner {
        trees[treeId] = TreeInfo({root: root, tokenId: tokenId, from: from});
    }

    function getTrees() external view returns (TreeInfo[] memory) {
        uint256 length = numberOfTrees;

        TreeInfo[] memory allTrees = new TreeInfo[](length);

        for (uint256 i = 0; i < length; i++) {
            allTrees[i] = trees[i];
        }

        return allTrees;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {}

    function initialize(IERC1155Upgradeable token_) public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();

        token = token_;
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyOwner
    {}
}
