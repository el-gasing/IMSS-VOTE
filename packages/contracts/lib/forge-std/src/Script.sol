// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface VmScript {
    function envUint(string calldata) external returns (uint256);
    function addr(uint256 privateKey) external returns (address);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

contract Script {
    VmScript internal constant vm = VmScript(address(uint160(uint256(keccak256("hevm cheat code")))));
}
