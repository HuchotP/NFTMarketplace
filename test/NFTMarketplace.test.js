const { expect, use } = require("chai");
const { Contract } = require("ethers");
const { deployContract, MockProvider, solidity } = require("ethereum-waffle");
const NFTMarketplace = require("../build/NFTMarketplace.json");
const TokenA = require("../build/TokenA.json");
const TokenB = require("../build/TokenB.json");
const { describe } = require("mocha");
const BN = require('bn.js');

use(solidity);

describe("NFTMarketplace", () => {
    const [
        marketplaceOwner,
        customer1,
        customer2,
        customer3,
    ] = new MockProvider().getWallets();
    let marketplace;
    let tokenA;
    let tokenB;
    let mkplaceCustomer1;
    let mkplaceCustomer2;
    let mkplaceCustomer3;

    before(async () => {
        marketplace = await deployContract(marketplaceOwner, NFTMarketplace);
        tokenA = await deployContract(customer1, TokenA);
        tokenB = await deployContract(customer2, TokenB);

        mkplaceCustomer1 = new Contract(
            marketplace.address,
            NFTMarketplace.abi,
            customer1
        );
        mkplaceCustomer2 = new Contract(
            marketplace.address,
            NFTMarketplace.abi,
            customer2
        );
        mkplaceCustomer3 = new Contract(
            marketplace.address,
            NFTMarketplace.abi,
            customer3
        );
    });

    describe("onERC721Received", async () => {
        it("Should react to token sent", async () => {
            await expect(
                tokenA["safeTransferFrom(address,address,uint256)"](
                    customer1.address,
                    marketplace.address,
                    0
                )
            )
                .to.emit(marketplace, "OfferPublished")
                .withArgs(customer1.address, 2, 0, tokenA.address, 0);
        });

        it("Should have registered the offer", async () => {
            let offer = await marketplace.getOffer(2);

            expect(offer.contractAddress).to.equal(tokenA.address);
            expect(offer.tokenId).to.equal(0);
            expect(offer.price).to.equal(0);
        });
    });

    describe("setCurrentPrice", async () => {
        
        it("Should not be possible to set price if not owner", async () => {    
            await expect(mkplaceCustomer2.setCurrentPrice(2,5)).to.be.revertedWith(
                "Only Seller can update price"
            );
        });

        it("Should not be possible to set price to 0", async () => {
            await expect(mkplaceCustomer1.setCurrentPrice(2,0)).to.be.revertedWith(
                "Price must be granter than zero"
            );
        });

        it("Should change the price of the offer", async () => {
            await mkplaceCustomer1.setCurrentPrice(2,10);
            let offer = await marketplace.getOffer(2);
            await expect(offer.price).to.equal(10);
        });

        it("Should emit a OfferUpdated event", async () => {
            await expect(
                mkplaceCustomer1.setCurrentPrice(2,2000)
            )
                .to.emit(mkplaceCustomer1, "OfferUpdated")
                .withArgs(customer1.address, 2, 2000);
        });

    });

    describe("buyToken", async () => {

        let sellerBalanceBefore;
        let offer;
        let fee;
        
        before(async () => {

            

            await tokenA["safeTransferFrom(address,address,uint256)"](
                customer1.address,
                marketplace.address,
                1
            );

            sellerBalanceBefore = await customer1.getBalance();
            

            offer = await marketplace.getOffer(2);

            fee = offer.price.mul(2).div(100);

        });

        it("Should not be possible to buy if offer not in sell book", async () => {
            await expect(mkplaceCustomer2.buyToken(0)).to.be.revertedWith(
                "Token not in sell book"
            );
        });

        it("Should not be possible to buy if price is 0", async () => {

            await expect(mkplaceCustomer2.buyToken(3)).to.be.revertedWith(
                "Token not ready for sell"
            );
        });

        it("Should not be possible to buy if price is not correct", async() =>{

            await expect(mkplaceCustomer2.buyToken(2, {value: 10})).to.be.revertedWith(
                "Amount sent is not correct"
            );
            await expect(mkplaceCustomer2.buyToken(2, {value: 16})).to.be.revertedWith(
                "Amount sent is not correct"
            );

        });

        it("Should emit Buy", async() => {
            expect(await mkplaceCustomer2.buyToken(2, {value: offer.price.toNumber()})).to.emit(marketplace, "Buy")
            .withArgs(customer1.address, customer2.address, 2, 0, tokenA.address, offer.price.toString());
        });

        it("Should remove the offer", async () => {

            let offers = await marketplace.getOffersIds();
            let usersOffers = await marketplace.getOffersFromAddress(customer1.address);

            offers = offers.map((id) => id.toNumber());
            usersOffers = usersOffers.map((id) => id.toNumber());

            await expect(offers.includes(2)).to.equal(
                false
            );
            await expect(usersOffers.includes(2)).to.equal(
                false
            );
            
        });

        it("Should send the token to the buyer", async () => {
            await expect(await tokenA.ownerOf(0)).to.equal(customer2.address);
        });

        it("Should take a fee", async() => {
            expect(await marketplace.getTotalFund()).to.equal(fee);
        });

        it("Should pay the seller the correct amount", async () => {
            expect(await customer1.getBalance()).to.equal(sellerBalanceBefore.add(offer.price).sub(fee));
        });

    });


    describe("cancelSellToken", async() => {

        it("Should not be possible for someone other than the owner to cancel", async () => {

            await expect(mkplaceCustomer2.cancelSellToken(3)).to.be.revertedWith(
                "Only Seller can cancel sell token"
            );

        });

        it("Should emit CancelOffer", async() => {

            await expect(await mkplaceCustomer1.cancelSellToken(3)).to.emit(marketplace, "CancelOffer")
            .withArgs(customer1.address, 3, 1, tokenA.address);


        });

        it("Should remove the offer", async () => {
   
            let offers = await marketplace.getOffersIds();
            let usersOffers = await marketplace.getOffersFromAddress(customer1.address);

            offers = offers.map((id) => id.toNumber());
            usersOffers = usersOffers.map((id) => id.toNumber());

            expect(offers.includes(2)).to.equal(
                false
            );
            expect(usersOffers.includes(2)).to.equal(
                false
            );
        });

        it("Should transfer the token back to the owner", async () => {

            await expect(await tokenA.ownerOf(1)).to.equal(customer1.address);

        });


    });

    describe("transferFund", async() => {

        it("Should transfer the correct amount to the correct address", async() => {

            let balanceBefore = await customer3.getBalance();

            await marketplace.transferFund(customer3.address, 20);

            expect(await customer3.getBalance()).equal(balanceBefore.add(20));

        });

    });

});
