pragma solidity ^0.4.24;

import "../ERC20.sol";
import "../DexBrokerage.sol";

contract DexBrokerageMock is DexBrokerage {

    function receiveTokenDeposit(address token, address from, uint256 amount) {
        require(ERC20(token).transferFrom(from, address(this), amount));
    }
}
