pragma solidity ^0.4.4;

import "@aragon/os/contracts/apps/AragonApp.sol";


contract Identity is AragonApp {

	bytes32 constant public FORWARD_ROLE = keccak256("FORWARD_ROLE");


	function initialize() onlyInit
	{
		initialized();
	}

	
  /**
  * @notice Execute desired action
  * @dev IForwarder interface conformance.
  * @param _evmScript Script being executed
  */
  function forward(bytes _evmScript) public {
			require(canForward(msg.sender, _evmScript));
      bytes memory input = new bytes(0); // TODO: Consider input for this
      address[] memory blacklist = new address[](0);
      runScript(_evmScript, input, blacklist);
  }


  function isForwarder() public pure returns (bool) {
      return true;
  }

  function canForward(address _sender, bytes _evmCallScript) public view returns (bool) {
      return canPerform(_sender, FORWARD_ROLE, arr());
  }

}
