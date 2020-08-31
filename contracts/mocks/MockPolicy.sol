pragma solidity 0.4.24;

import "./Mock.sol";


contract MockUFragmentsPolicy is Mock {

    function rebase()
        external
        returns (uint256)
    {
        emit FunctionCalled("UFragmentsPolicy", "rebase", msg.sender);
        return 0;
    }
}
