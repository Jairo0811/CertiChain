// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract CertificateRegistry is AccessControl, Pausable {
    bytes32 public constant ISSUER_ADMIN_ROLE = keccak256("ISSUER_ADMIN_ROLE");
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    struct Certificate {
        bytes32 id;
        address student;
        address issuer;
        bytes32 documentHash;
        string metadataURI;
        uint64 issuedAt;
        uint64 revokedAt;
        bool revoked;
    }

    error CertificateNotFound(bytes32 certificateId);
    error CertificateAlreadyExists(bytes32 certificateId);
    error InvalidAddress();
    error InvalidDocumentHash();
    error UnauthorizedRevocation();
    error CertificateAlreadyRevoked(bytes32 certificateId);

    mapping(bytes32 => Certificate) private certificates;
    mapping(address => bytes32[]) private certificatesByStudent;
    uint256 private nonce;

    event IssuerAuthorized(address indexed issuer, address indexed authorizedBy);
    event IssuerRevoked(address indexed issuer, address indexed revokedBy);
    event CertificateIssued(
        bytes32 indexed certificateId,
        address indexed student,
        address indexed issuer,
        bytes32 documentHash,
        string metadataURI,
        uint64 issuedAt
    );
    event CertificateRevoked(
        bytes32 indexed certificateId,
        address indexed issuer,
        address indexed revokedBy,
        uint64 revokedAt
    );

    constructor(address initialAdmin) {
        if (initialAdmin == address(0)) revert InvalidAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(ISSUER_ADMIN_ROLE, initialAdmin);
    }

    function authorizeIssuer(address issuer) external onlyRole(ISSUER_ADMIN_ROLE) {
        if (issuer == address(0)) revert InvalidAddress();
        _grantRole(ISSUER_ROLE, issuer);
        emit IssuerAuthorized(issuer, msg.sender);
    }

    function revokeIssuer(address issuer) external onlyRole(ISSUER_ADMIN_ROLE) {
        _revokeRole(ISSUER_ROLE, issuer);
        emit IssuerRevoked(issuer, msg.sender);
    }

    function issueCertificate(
        address student,
        bytes32 documentHash,
        string calldata metadataURI
    ) external onlyRole(ISSUER_ROLE) whenNotPaused returns (bytes32 certificateId) {
        if (student == address(0)) revert InvalidAddress();
        if (documentHash == bytes32(0)) revert InvalidDocumentHash();

        certificateId = keccak256(
            abi.encode(block.chainid, address(this), msg.sender, student, documentHash, nonce++)
        );

        if (certificates[certificateId].issuedAt != 0) {
            revert CertificateAlreadyExists(certificateId);
        }

        uint64 issuedAt = uint64(block.timestamp);
        certificates[certificateId] = Certificate({
            id: certificateId,
            student: student,
            issuer: msg.sender,
            documentHash: documentHash,
            metadataURI: metadataURI,
            issuedAt: issuedAt,
            revokedAt: 0,
            revoked: false
        });
        certificatesByStudent[student].push(certificateId);

        emit CertificateIssued(
            certificateId,
            student,
            msg.sender,
            documentHash,
            metadataURI,
            issuedAt
        );
    }

    function revokeCertificate(bytes32 certificateId) external whenNotPaused {
        Certificate storage certificate = _getCertificateStorage(certificateId);

        if (certificate.revoked) revert CertificateAlreadyRevoked(certificateId);
        if (
            msg.sender != certificate.issuer &&
            !hasRole(ISSUER_ADMIN_ROLE, msg.sender)
        ) revert UnauthorizedRevocation();

        certificate.revoked = true;
        certificate.revokedAt = uint64(block.timestamp);

        emit CertificateRevoked(
            certificateId,
            certificate.issuer,
            msg.sender,
            certificate.revokedAt
        );
    }

    function getCertificate(bytes32 certificateId) external view returns (Certificate memory) {
        return _getCertificateStorage(certificateId);
    }

    function getCertificatesByStudent(address student) external view returns (bytes32[] memory) {
        return certificatesByStudent[student];
    }

    function verifyCertificate(
        bytes32 certificateId,
        bytes32 expectedDocumentHash
    ) external view returns (
        bool exists,
        bool active,
        bool hashMatches,
        address issuer,
        address student,
        uint64 issuedAt,
        uint64 revokedAt
    ) {
        Certificate storage certificate = certificates[certificateId];
        exists = certificate.issuedAt != 0;

        if (!exists) {
            return (false, false, false, address(0), address(0), 0, 0);
        }

        active = !certificate.revoked;
        hashMatches = certificate.documentHash == expectedDocumentHash;
        issuer = certificate.issuer;
        student = certificate.student;
        issuedAt = certificate.issuedAt;
        revokedAt = certificate.revokedAt;
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function _getCertificateStorage(bytes32 certificateId) private view returns (Certificate storage certificate) {
        certificate = certificates[certificateId];
        if (certificate.issuedAt == 0) revert CertificateNotFound(certificateId);
    }
}
