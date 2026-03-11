// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {Election} from "../src/Election.sol";

contract DeployElectionScript is Script {
    // Edit candidate list here before running for production.
    function _ketum() internal pure returns (Election.Candidate[] memory ketum) {
        ketum = new Election.Candidate[](2);
        ketum[0] = Election.Candidate({id: 1, name: "Ketua Umum 1"});
        ketum[1] = Election.Candidate({id: 2, name: "Ketua Umum 2"});
    }

    // Edit candidate list here before running for production.
    function _waketum() internal pure returns (Election.Candidate[] memory waketum) {
        waketum = new Election.Candidate[](2);
        waketum[0] = Election.Candidate({id: 11, name: "Wakil Ketua Umum 1"});
        waketum[1] = Election.Candidate({id: 12, name: "Wakil Ketua Umum 2"});
    }

    function run() external returns (Election election) {
        uint256 deployerPrivateKey = vm.envUint("ADMIN_SIGNER_KEY");
        address owner = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);
        election = new Election(owner, _ketum(), _waketum());
        vm.stopBroadcast();
    }
}
