pragma solidity ^0.4.24;

/**
 * @dev Sample contract to force ether into other contract on selfdestruct
 */
contract EtherForcer {

	event Forced(address to, uint256 amount);

	constructor() payable public {}

	function forceEther(address _where) public {
		emit Forced(_where, address(this).balance);
		selfdestruct(_where);
	}
}
