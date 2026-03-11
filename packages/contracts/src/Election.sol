// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract Election {
    struct Candidate {
        uint256 id;
        string name;
    }

    struct ResultItem {
        uint256 candidateId;
        uint256 votes;
    }

    mapping(address => bool) public whitelist;

    mapping(address => bool) public hasVotedKetum;
    mapping(address => bool) public hasVotedWaketum;
    mapping(bytes32 => bool) public hasVotedByKey;

    mapping(uint256 => uint256) public ketumVotes;
    mapping(uint256 => uint256) public waketumVotes;

    mapping(uint256 => bool) private ketumCandidateExists;
    mapping(uint256 => bool) private waketumCandidateExists;

    Candidate[] private ketumCandidates;
    Candidate[] private waketumCandidates;

    bool public finalized;
    bool public paused;
    address public owner;

    event VoterWhitelisted(address indexed voter, bool allowed);
    event VoteCast(address indexed voter, uint8 indexed position, uint256 indexed candidateId);
    event VoteCastByKey(bytes32 indexed voterKey, uint256 indexed ketumCandidateId, uint256 indexed waketumCandidateId);
    event ElectionFinalized(uint256 timestamp);

    error ElectionIsFinalized();
    error UnauthorizedVoter();
    error AlreadyVoted();
    error InvalidCandidate();

    constructor(address initialOwner, Candidate[] memory ketum, Candidate[] memory waketum) {
        require(initialOwner != address(0), "invalid owner");
        owner = initialOwner;
        require(ketum.length > 0 && waketum.length > 0, "empty candidates");

        for (uint256 i = 0; i < ketum.length; i++) {
            require(!ketumCandidateExists[ketum[i].id], "duplicate ketum id");
            ketumCandidateExists[ketum[i].id] = true;
            ketumCandidates.push(ketum[i]);
        }

        for (uint256 i = 0; i < waketum.length; i++) {
            require(!waketumCandidateExists[waketum[i].id], "duplicate waketum id");
            waketumCandidateExists[waketum[i].id] = true;
            waketumCandidates.push(waketum[i]);
        }
    }

    modifier notFinalized() {
        if (finalized) revert ElectionIsFinalized();
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "paused");
        _;
    }

    function setWhitelist(address voter, bool allowed) external onlyOwner notFinalized {
        whitelist[voter] = allowed;
        emit VoterWhitelisted(voter, allowed);
    }

    function setWhitelistBatch(address[] calldata voters, bool allowed) external onlyOwner notFinalized {
        for (uint256 i = 0; i < voters.length; i++) {
            whitelist[voters[i]] = allowed;
            emit VoterWhitelisted(voters[i], allowed);
        }
    }

    function voteKetum(uint256 candidateId) external whenNotPaused notFinalized {
        if (!whitelist[msg.sender]) revert UnauthorizedVoter();
        if (hasVotedKetum[msg.sender]) revert AlreadyVoted();
        if (!ketumCandidateExists[candidateId]) revert InvalidCandidate();

        hasVotedKetum[msg.sender] = true;
        ketumVotes[candidateId] += 1;
        emit VoteCast(msg.sender, 0, candidateId);
    }

    function voteWaketum(uint256 candidateId) external whenNotPaused notFinalized {
        if (!whitelist[msg.sender]) revert UnauthorizedVoter();
        if (hasVotedWaketum[msg.sender]) revert AlreadyVoted();
        if (!waketumCandidateExists[candidateId]) revert InvalidCandidate();

        hasVotedWaketum[msg.sender] = true;
        waketumVotes[candidateId] += 1;
        emit VoteCast(msg.sender, 1, candidateId);
    }

    function voteByKey(bytes32 voterKey, uint256 ketumCandidateId, uint256 waketumCandidateId)
        external
        onlyOwner
        whenNotPaused
        notFinalized
    {
        require(voterKey != bytes32(0), "invalid voter key");
        if (hasVotedByKey[voterKey]) revert AlreadyVoted();
        if (!ketumCandidateExists[ketumCandidateId] || !waketumCandidateExists[waketumCandidateId]) {
            revert InvalidCandidate();
        }

        hasVotedByKey[voterKey] = true;
        ketumVotes[ketumCandidateId] += 1;
        waketumVotes[waketumCandidateId] += 1;

        emit VoteCastByKey(voterKey, ketumCandidateId, waketumCandidateId);
    }

    function finalize() external onlyOwner notFinalized {
        finalized = true;
        emit ElectionFinalized(block.timestamp);
    }

    function pause() external onlyOwner {
        paused = true;
    }

    function unpause() external onlyOwner {
        paused = false;
    }

    function getKetumCandidates() external view returns (Candidate[] memory) {
        return ketumCandidates;
    }

    function getWaketumCandidates() external view returns (Candidate[] memory) {
        return waketumCandidates;
    }

    function getResults() external view returns (ResultItem[] memory ketumResult, ResultItem[] memory waketumResult) {
        ketumResult = new ResultItem[](ketumCandidates.length);
        waketumResult = new ResultItem[](waketumCandidates.length);

        for (uint256 i = 0; i < ketumCandidates.length; i++) {
            uint256 id = ketumCandidates[i].id;
            ketumResult[i] = ResultItem({candidateId: id, votes: ketumVotes[id]});
        }

        for (uint256 i = 0; i < waketumCandidates.length; i++) {
            uint256 id = waketumCandidates[i].id;
            waketumResult[i] = ResultItem({candidateId: id, votes: waketumVotes[id]});
        }
    }
}
