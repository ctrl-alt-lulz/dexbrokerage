pragma solidity ^0.4.24;

/**
 * @title DexBrokerage
 * @dev Interface function called from `approveAndDeposit` depositing the tokens onto the exchange
 */
contract DexBrokerage {
    function receiveTokenDeposit(address token, address from, uint256 amount) public;
}
