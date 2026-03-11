// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {Election} from "../src/Election.sol";

contract ElectionTest is Test {
    Election internal election;

    address internal owner = address(0xA11CE);
    address internal voter1 = address(0xB0B);
    address internal voter2 = address(0xCAFE);

    function setUp() public {
        Election.Candidate[] memory ketum = new Election.Candidate[](2);
        ketum[0] = Election.Candidate({id: 1, name: "Ketum A"});
        ketum[1] = Election.Candidate({id: 2, name: "Ketum B"});

        Election.Candidate[] memory waketum = new Election.Candidate[](2);
        waketum[0] = Election.Candidate({id: 11, name: "Waketum A"});
        waketum[1] = Election.Candidate({id: 12, name: "Waketum B"});

        vm.prank(owner);
        election = new Election(owner, ketum, waketum);
    }

    function testWhitelistThenVoteSuccess() public {
        vm.prank(owner);
        election.setWhitelist(voter1, true);

        vm.prank(voter1);
        election.voteKetum(1);

        vm.prank(voter1);
        election.voteWaketum(11);

        (Election.ResultItem[] memory ketumResult, Election.ResultItem[] memory waketumResult) = election.getResults();
        assertEq(ketumResult[0].votes, 1);
        assertEq(waketumResult[0].votes, 1);
    }

    function testRejectNonWhitelist() public {
        vm.prank(voter1);
        vm.expectRevert(Election.UnauthorizedVoter.selector);
        election.voteKetum(1);
    }

    function testRejectDoubleVote() public {
        vm.startPrank(owner);
        election.setWhitelist(voter1, true);
        vm.stopPrank();

        vm.prank(voter1);
        election.voteKetum(1);

        vm.prank(voter1);
        vm.expectRevert(Election.AlreadyVoted.selector);
        election.voteKetum(2);
    }

    function testFinalizeLocksVoting() public {
        vm.startPrank(owner);
        election.setWhitelist(voter1, true);
        election.finalize();
        vm.stopPrank();

        vm.prank(voter1);
        vm.expectRevert(Election.ElectionIsFinalized.selector);
        election.voteKetum(1);
    }

    function testBatchWhitelist() public {
        address[] memory voters = new address[](2);
        voters[0] = voter1;
        voters[1] = voter2;

        vm.prank(owner);
        election.setWhitelistBatch(voters, true);

        assertTrue(election.whitelist(voter1));
        assertTrue(election.whitelist(voter2));
    }

    function testOwnerVoteByKeySuccess() public {
        bytes32 voterKey = keccak256("sso-user-1");

        vm.prank(owner);
        election.voteByKey(voterKey, 1, 11);

        (Election.ResultItem[] memory ketumResult, Election.ResultItem[] memory waketumResult) = election.getResults();
        assertEq(ketumResult[0].votes, 1);
        assertEq(waketumResult[0].votes, 1);
        assertTrue(election.hasVotedByKey(voterKey));
    }

    function testOwnerVoteByKeyRejectDoubleVote() public {
        bytes32 voterKey = keccak256("sso-user-2");

        vm.prank(owner);
        election.voteByKey(voterKey, 1, 11);

        vm.prank(owner);
        vm.expectRevert(Election.AlreadyVoted.selector);
        election.voteByKey(voterKey, 2, 12);
    }
}
