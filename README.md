# NFTMarketplace
## What is this about ?
This is a project to bring a marketplace for NFTs on an EVM compatible blockchain. The main contract is NFTMarketplace.sol. It enables users to send ERC721 to the contract, set a price and receive payment when the token is bought.
## How to compile/run tests
First run `npm install` in the repository and it will download the dependencies. The contract uses OpenZepplin standard for the ERC721 interface and Waffle for testing.
Then you can compile using `npm run build` and launch the tests with `npm run test`.
If you have a timout error when testing you can raise the timeout limit in package.json. Currently it is set at 10s `(--timeout 10000)`.