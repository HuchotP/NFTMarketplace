pragma solidity ^0.8.0;


import '@openzeppelin/contracts/token/ERC721/ERC721.sol';


contract TokenB is ERC721 {
    
    constructor () public ERC721("TokenB", "TKNB") {
        for(uint i = 0; i < 5; i++){
            _safeMint(msg.sender, i);
        }
    }
}