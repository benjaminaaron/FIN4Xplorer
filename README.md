Find the upstream Readme at [FuturICT2/FIN4Xplorer](https://github.com/FuturICT2/FIN4Xplorer/blob/master/README.md).

# #HackMoney

This repository was forked for the additions made during [#HackMoney 2020](https://hackathon.money/) where we extended our existing FIN4Xplorer dApp with options to back Positive Action Tokens (PATs) with different underlying sources of value.

<p align="center">
  <img src="https://user-images.githubusercontent.com/5141792/82785492-f5709080-9e62-11ea-870d-73207a13bddb.png" width="500" >
</p>

## Description

First we describe our existing dApp and then what we added to it during #HackMoney.

The Finance 4.0 platform (www.finfour.net) has been developed in the context of the European research project FuturICT 2.0 at the Chair for Computational Social Science (Prof. Dirk Helbing) at ETH Zürich. The FIN4Xplorer is our tool to explore the post-monetary design space. Anyone can create ERC20-tokens that we call "Positive Action Tokens" (PATs) and in the process of doing so decide on various properties (burnable, transferable, initial supply, capped etc.) and the verifier types. These determine what kind of proofs users have to provide to claim a balance on this token. Examples are a location proof that needs the user to be at a certain location or a picture proof where the user uploads a picture and asks another user to approve it. In that way our system is trying to make as sure as possible that a balance on a PAT represents some positive social or ecological action that has actually happened. Tokens become valuable if they become of interest to represent something (My PAT portfolio proofs my qualification for this scholarship via the social deeds I have done) or to do something with them (I give you my BerlinRecycleTokens for your ParisReusableCupTokens because I can reedem them for coffee in my favorite café in Paris). Beyond this core functionality of the platform, there are features like token collections, user groups, a token curated registry to collectively vote for or against PATs becoming "official" tokens.

What we used #HackMoney for is to add options to back PATs with underlying sources of value. While a PAT is meant to have value by the positive real-world action it represents, we understand the challenge to get an economy going around new token. To boost interest in a PAT, we want it to be be possible to deposit collaterals that users can choose to swap their PAT with if they want to. In our discussions about what different sources of value to support, three types emerged (for now). What we call "sourcerer" is fully integrated into our dApp and allows token creators to define collaterals for their new PAT. The other two types we call "external underlyings". One of them gets triggered via an implemented interface on-chain in case of a successful PAT claim. The other one is just a free text field where token creators can "promise" (this is the only one of the three types relying on off-chain trust) anything in exchange for a PAT.

<img src="https://user-images.githubusercontent.com/5141792/82785537-133df580-9e63-11ea-97c1-c6fc89ca2fff.png" >

## How It's Made
The FIN4Xplorer dApp is split into two repositories. One contains the Solidity contracts that get deployed on Ethereum. The other one contains the frontend in form of a React web app that uses truffle with drizzle to communicate with the blockchain and relies on the MetaMask extension (or mobile standalone app) to sign transactions. Verifier types including files use IPFS to store them.

This tech stack stayed the same for the underlying sources of value we worked on during #HackMoney. Various additions to the smart contracts as well as to the frontend were made. In terms of the architecture; the Fin4Underlyings contract manages all 3 types of underlyings; sourcerers, contract addresses that implement the interface and free text.

The three Sourcerers - SwapSourcerer, MintingSourcerer and BurnSourcerer - are each extending BaseSourcerer. Each sourcerer is in charge of receiving collaterals (COLL), purposing it to a PAT and handling the conversion when users pay PAT: in all three cases the incoming PAT gets burned (otherwise the value would exist twice). SwapS. then sends back COLL, MintingS. mints back COLL and BurnS. burns the amount in COLL. The frontend takes care of initiating approve-transactions that are required before the respective action: approving the amount of PAT in case of conversion and the amount of COLL in case of depositing. Only then the sourcerer can collect the amounts while "tagging" them with their purpose.

External contracts that implement the interface SuccessfulClaimNotifierInterface can be added as external underlyings. They get triggered in case of a successful claim via the Fin4Claiming contract pinging the Fin4Underlyings contract to tell all the matching contracts about the good news.
