pragma solidity ^0.5.0;

import 'contracts/Fin4Token.sol';
import "solidity-util/lib/Strings.sol";

contract Fin4TokenManagement {
    using Strings for string;

    // TODO do we need the indexed keyword for event params?
    event Fin4TokenCreated(address addr, string name, string symbol, string description, string unit);

    address public Fin4MainAddress;
    address public Fin4ClaimingAddress;

    constructor(address Fin4MainAddr, address Fin4ClaimingAddr) public {
        Fin4MainAddress = Fin4MainAddr;
        Fin4ClaimingAddress = Fin4ClaimingAddr;
    }

    address[] public allFin4Tokens;
    mapping (string => bool) public symbolIsUsed;

    function createNewToken(string memory name, string memory symbol, string memory description, string memory unit,
        address[] memory requiredProofTypes, uint[] memory paramValues, uint[] memory paramValuesIndices) public returns(address) {

        uint symLen = symbol.length();
        require(symLen >= 3 && symLen <= 5, "Symbol must have between 3 and 5 characters");
        string memory _symbol = symbol.upper();
        require(!symbolIsUsed[_symbol], "Symbol is already in use");

        Fin4Token newToken = new Fin4Token(name, _symbol, description, unit, msg.sender);
        newToken.setAddresses(Fin4MainAddress, Fin4ClaimingAddress);
        symbolIsUsed[_symbol] = true;

        for (uint i = 0; i < requiredProofTypes.length; i++) { // add the required proof types as selected by the action type creator
            newToken.addRequiredProofType(requiredProofTypes[i]);
            // ProofTypes must be minters because "they" (via msg.sender) are the ones calling mint() if the last required proof type is set to true
            newToken.addMinter(requiredProofTypes[i]);

            // This approach enables setting integer-parameters for the proof types that require parameters.
            // The challenge to solve here was that some don't need parameters and others need multiple.
            // Therefore the paramValuesIndices array encodes successively the start- and end indices for
            // each proof type as they appear in the paramValues array.
            // An example:
            //    Proof type A has parameter values 4, 7 and 9, Proof type B as no parameters and Proof type C has the parameter 5.
            //    paramValues would look like this [4, 7, 9, 5] whereas paramValuesIndices would like like this: [0, 2, 99, 99, 3, 3]
            //    --> Proof type A has the parameters from index 0 to index 2, Proof type b has no parameters as indicated by the 99
            //        and Proof type C has the single parameter at index 3
            uint indexStart = paramValuesIndices[i * 2];
            uint indexEnd = paramValuesIndices[i * 2 + 1];
            if (indexStart != 99) {
                uint paramsCount = indexEnd - indexStart + 1;
                uint[] memory params = new uint[](paramsCount);
                for (uint j = indexStart; j <= indexEnd; j ++) {
                    params[j - indexStart] = paramValues[j];
                }
                // Send parameters to proof type, it will be stored there linked to the new tokens address
                Fin4BaseProofType(requiredProofTypes[i]).setParameters(address(newToken), params);
            }
        }
        allFin4Tokens.push(address(newToken));
        emit Fin4TokenCreated(address(newToken), name, _symbol, description, unit);
        return address(newToken);
    }

    function getAllFin4Tokens() public view returns(address[] memory) {
        return allFin4Tokens;
    }

    // relay-functions to not have to call Fin4Token contracts directly from the frontend

    function getTokenInfo(address tokenAddr) public view returns(string memory, string memory, string memory, string memory) {
        return Fin4Token(tokenAddr).getInfo();
    }

    function getDetailedTokenInfo(address tokenAddr) public view returns(bool, address[] memory, uint, uint256, uint256) {
        return Fin4Token(tokenAddr).getDetailedInfo(msg.sender);
    }

    // ------------------------- BALANCE -------------------------

    function getBalance(address user, address tokenAddress) public view returns(uint256) {
        return Fin4Token(tokenAddress).balanceOf(user);
    }

    function getMyNonzeroTokenBalances() public view returns(address[] memory, uint256[] memory) {
        uint count = 0;
        for (uint i = 0; i < allFin4Tokens.length; i ++) {
            if (getBalance(msg.sender, allFin4Tokens[i]) > 0) {
                count ++;
            }
        }
        // combine this with actionsWhereUserHasClaims to toss the upper loop?
        address[] memory nonzeroBalanceTokens = new address[](count);
        uint256[] memory balances = new uint256[](count);
        count = 0;
        for (uint i = 0; i < allFin4Tokens.length; i ++) {
            uint256 balance = getBalance(msg.sender, allFin4Tokens[i]);
            if (balance > 0) {
                nonzeroBalanceTokens[count] = allFin4Tokens[i];
                balances[count] = balance;
                count += 1;
            }
        }
        return (nonzeroBalanceTokens, balances);
    }
}
