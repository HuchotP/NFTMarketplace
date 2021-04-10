pragma solidity ^0.8.0;

import '@openzeppelin/contracts/utils/math/SafeMath.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC721/IERC721.sol';

import '@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol';
import '@openzeppelin/contracts/security/Pausable.sol';
import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import '@openzeppelin/contracts/utils/Address.sol';

contract NFTMarketplace is IERC721Receiver, Ownable, Pausable {
    using SafeMath for uint256;
    using Address for address;
    using EnumerableSet for EnumerableSet.UintSet; 
    
    
    struct Offer {
        uint256 tokenId;
        uint256 price;
        address contractAddress;
    }


    EnumerableSet.UintSet _offersPending;
    mapping(uint256 => Offer) _offersMap;
    mapping(uint256 => address payable) _offersOwners;
    mapping(address => EnumerableSet.UintSet) _usersOffers;

    uint256 nonce;
    
    
    event OfferUpdated(address indexed seller, uint256 indexed offerId, uint256 price);
    event OfferPublished(address indexed seller, uint256 offerId, uint256 indexed tokenId, address indexed contractAddress, uint256 price);
    event Buy(address indexed seller, address indexed buyer, uint256 offerId, uint256 tokenId, address contractAddress, uint256 price);
    event CancelOffer(address indexed seller, uint256 indexed offerId, uint256 tokenId, address contractAddress);


    constructor() {
        
        nonce = 1;
    }

    function buyToken(uint256 _offerId) public payable whenNotPaused {
        

        // Checks
        require(msg.sender != address(0) && msg.sender != address(this), 'Wrong msg sender');
        require(_offersPending.contains(_offerId), 'Token not in sell book');
        require(_offersMap[_offerId].price > 0, 'Token not ready for sell');
        require(_offersMap[_offerId].price == msg.value, 'Amount sent is not correct');

        // Effects     
        _offersPending.remove(_offerId);
        _usersOffers[_offersOwners[_offerId]].remove(_offerId);
        uint256 fee = (_offersMap[_offerId].price * 2) / 100;

        // Interactions
        IERC721 nft = IERC721(_offersMap[_offerId].contractAddress);
        nft.safeTransferFrom(address(this), msg.sender, _offersMap[_offerId].tokenId);
        _offersOwners[_offerId].transfer(msg.value - fee);

        emit Buy(_offersOwners[_offerId], msg.sender, _offerId, _offersMap[_offerId].tokenId, _offersMap[_offerId].contractAddress, _offersMap[_offerId].price);
    }

    function setCurrentPrice(uint256 _offerId, uint256 _price) public whenNotPaused {
        require(_usersOffers[msg.sender].contains(_offerId), 'Only Seller can update price');
        require(_price > 0, 'Price must be granter than zero');
        _offersMap[_offerId].price = _price;
        emit OfferUpdated(msg.sender, _offerId, _price);
    }

    function readyToSellToken(uint256 _tokenId, address _contractAddress, uint256 _price) public whenNotPaused {
        
        IERC721 nft = IERC721(_contractAddress);

        // Checks
        require(msg.sender == nft.ownerOf(_tokenId), 'Only Token Owner can sell token');
        require(_price > 0, 'Price must be granter than zero');
        
        // Effects
        uint256 offerId = ++nonce;
        _offersPending.add(offerId);
        _offersOwners[offerId] = payable(msg.sender);
        _offersMap[offerId] = Offer({tokenId: _tokenId, price: _price, contractAddress: _contractAddress});
        _usersOffers[msg.sender].add(offerId);
        

        // Interactions
        nft.safeTransferFrom(address(msg.sender), address(this), _tokenId);


        emit OfferPublished(msg.sender, offerId, _tokenId, _contractAddress, _price);
    }

    function cancelSellToken(uint256 _offerId) public whenNotPaused {
        
        // Checks 
        require(_usersOffers[msg.sender].contains(_offerId), 'Only Seller can cancel sell token');
        
        // Effects
        _usersOffers[msg.sender].remove(_offerId);
        _offersPending.remove(_offerId);
        
        //Interactions 
        IERC721 nft = IERC721(_offersMap[_offerId].contractAddress);
        nft.safeTransferFrom(address(this), msg.sender, _offersMap[_offerId].tokenId);

        emit CancelOffer(msg.sender, _offerId, _offersMap[_offerId].tokenId, _offersMap[_offerId].contractAddress);
    }

    function getOffersIds() public view returns (uint256[] memory){

        uint256[] memory offers = new uint256[](_offersPending.length());

        for(uint256 i = 0; i < _offersPending.length(); ++i){

            offers[i] = _offersPending.at(i);

        }


        return offers;

    }

    function getOffer(uint256 _offerId) public view returns (Offer memory){

        return _offersMap[_offerId];

    }

        
    function getOffersFromAddress(address _seller) public view returns (uint256[] memory){

        uint256[] memory offers = new uint256[](_usersOffers[_seller].length());

        for(uint256 i = 0; i < _offersPending.length(); ++i){

            offers[i] = _usersOffers[_seller].at(i);

        }


        return offers;
    }

    function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata data) override external returns (bytes4) {

        // Checks
        
        // Effects
        uint256 offerId = ++nonce;
        _offersPending.add(offerId);
        _offersOwners[offerId] =  payable(from);
        _offersMap[offerId] = Offer({tokenId: tokenId, price: 0, contractAddress: msg.sender});
        _usersOffers[from].add(offerId);
        
        // Interactions

        emit OfferPublished(from, offerId, tokenId, msg.sender, 0);
        return this.onERC721Received.selector;
    }

    function transferFund(address payable _to, uint256 amount) public onlyOwner {

        _to.transfer(amount);

    }

    function getTotalFund() public view returns (uint256){

        return address(this).balance;

    }

}
