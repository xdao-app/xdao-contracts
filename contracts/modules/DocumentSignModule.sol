// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.6;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

import "../interfaces/IFactory.sol";

contract DocumentSign is Initializable {
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    IFactory public factory;

    struct Document {
        uint256 index;
        address creator;
        bytes32 fileHash;
        uint256 createdNumberBlock;
        uint256 effectiveTimestamp;
        uint256 expiredTimestamp;
        bool isDaoQuorumSign;
        bool isSigned;
        EnumerableSetUpgradeable.AddressSet signedByAddresses;
    }

    mapping(address => mapping(bytes32 => Document)) private documents;

    mapping(address => bytes32[]) public documentsHashes;

    event CreateDocument(
        uint256 indexed index,
        address indexed creator,
        bytes32 indexed fileHash,
        uint256 effectiveTimestamp,
        uint256 expiredTimestamp,
        bool isDaoQuorumSign
    );

    event SignDocument(
        address indexed creator,
        bytes32 indexed fileHash,
        address indexed signer
    );

    event AscertainDocument(address indexed creator, bytes32 indexed fileHash);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    function initialize(IFactory _factory) public initializer {
        factory = _factory;
    }

    function createDocument(
        bytes32 _fileHash,
        uint256 _effectiveTimestamp,
        uint256 _expiredTimestamp,
        bool _isDaoQuorumSign
    ) public {
        Document storage document = documents[msg.sender][_fileHash];

        bytes32[] storage creatorDocumentsHashes = documentsHashes[msg.sender];

        require(
            document.effectiveTimestamp == 0,
            "DocumentSignModule: The same Document already exists"
        );

        require(
            _effectiveTimestamp > block.timestamp,
            "DocumentSignModule: Effective date can`t be in past"
        );

        document.index = creatorDocumentsHashes.length;
        document.creator = msg.sender;
        document.fileHash = _fileHash;
        document.createdNumberBlock = block.number;
        document.effectiveTimestamp = _effectiveTimestamp;
        document.isDaoQuorumSign = _isDaoQuorumSign;

        if (_expiredTimestamp > 0) {
            require(
                _expiredTimestamp > _effectiveTimestamp,
                "DocumentSignModule: Expired date must be greater than effective date"
            );

            document.expiredTimestamp = _expiredTimestamp;
        }

        emit CreateDocument(
            creatorDocumentsHashes.length,
            msg.sender,
            _fileHash,
            _effectiveTimestamp,
            _expiredTimestamp,
            _isDaoQuorumSign
        );

        if (_isDaoQuorumSign) {
            document.signedByAddresses.add(msg.sender);
            document.isSigned = true;

            emit AscertainDocument(msg.sender, _fileHash);
        }

        creatorDocumentsHashes.push(_fileHash);
    }

    function signDocument(address documentCreator, bytes32 fileHash) public {
        Document storage document = documents[documentCreator][fileHash];

        require(
            document.effectiveTimestamp != 0,
            "DocumentSignModule: The Document is not exist"
        );

        require(
            !document.isSigned,
            "DocumentSignModule: The Document already signed"
        );

        require(
            document.effectiveTimestamp > block.timestamp,
            "DocumentSignModule: You can't sign the document after effective date"
        );

        require(
            !document.signedByAddresses.contains(msg.sender),
            "DocumentSignModule: Message sender already signed the document"
        );

        if (factory.containsDao(document.creator)) {
            uint256 senderBalance = IERC20Upgradeable(document.creator)
                .balanceOf(msg.sender);

            require(
                senderBalance > 0,
                "DocumentSignModule: Only GT holders is able to sign the document"
            );
        }

        document.signedByAddresses.add(msg.sender);

        emit SignDocument(documentCreator, fileHash, msg.sender);

        ascertainDocument(documentCreator, fileHash);
    }

    function ascertainDocument(address documentCreator, bytes32 fileHash)
        internal
    {
        Document storage document = documents[documentCreator][fileHash];

        uint256 totalSupply = IERC20Upgradeable(document.creator).totalSupply();
        uint256 totalGtSignAmount = 0;

        for (uint256 i = 0; i < document.signedByAddresses.length(); i++) {
            totalGtSignAmount += IERC20Upgradeable(document.creator).balanceOf(
                document.signedByAddresses.at(i)
            );
        }

        if (totalSupply == totalGtSignAmount) {
            document.isSigned = true;

            emit AscertainDocument(documentCreator, fileHash);
        }
    }

    struct DocumentInfo {
        uint256 index;
        address creator;
        bytes32 fileHash;
        uint256 createdNumberBlock;
        uint256 effectiveTimestamp;
        uint256 expiredTimestamp;
        bool isDaoQuorumSign;
        bool isSigned;
        address[] signedByAddresses;
    }

    function getDocumentInfoByHash(address documentCreator, bytes32 fileHash)
        public
        view
        returns (DocumentInfo memory)
    {
        Document storage document = documents[documentCreator][fileHash];

        address[] memory signedByAddresses = document
            .signedByAddresses
            .values();

        return
            DocumentInfo({
                index: document.index,
                creator: document.creator,
                fileHash: document.fileHash,
                createdNumberBlock: document.createdNumberBlock,
                effectiveTimestamp: document.effectiveTimestamp,
                expiredTimestamp: document.expiredTimestamp,
                isDaoQuorumSign: document.isDaoQuorumSign,
                isSigned: document.isSigned,
                signedByAddresses: signedByAddresses
            });
    }

    function getDocumentInfoByIndex(address documentCreator, uint256 index)
        external
        view
        returns (DocumentInfo memory)
    {
        return
            getDocumentInfoByHash(
                documentCreator,
                documentsHashes[documentCreator][index]
            );
    }

    function getDocumentsInfoList(address documentCreator)
        external
        view
        returns (DocumentInfo[] memory)
    {
        bytes32[] memory creatorDocumentsHashes = documentsHashes[
            documentCreator
        ];

        DocumentInfo[] memory documentInfoList = new DocumentInfo[](
            creatorDocumentsHashes.length
        );

        for (uint256 i = 0; i < creatorDocumentsHashes.length; i++) {
            DocumentInfo memory doc = getDocumentInfoByHash(
                documentCreator,
                creatorDocumentsHashes[i]
            );

            documentInfoList[i] = doc;
        }

        return documentInfoList;
    }

    function getDocumentsHashesListLength(address documentCreator)
        external
        view
        returns (uint256)
    {
        return documentsHashes[documentCreator].length;
    }
}
