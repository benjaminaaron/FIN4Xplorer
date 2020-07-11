import React from 'react';
import Web3 from 'web3';
import { ParameterizerParams } from '../views/CuratedTokens/params';
import { doCallback, bytes32ToString } from './utils';
import { toast } from 'react-toastify';
const BN = require('bignumber.js');
const web3 = new Web3(window.ethereum);

// --------------------- CONSTANTS ---------------------

const zeroAddress = '0x0000000000000000000000000000000000000000';

// --------------------- HELPER METHODS ---------------------

const contractCall = (
	context,
	props,
	defaultAccount,
	contractName,
	methodName,
	params,
	displayStr = '',
	callbacks = {}, // transactionSent, transactionCompleted, transactionFailed, dryRunSucceeded, dryRunFailed
	skipDryRun = false,
	showToast = true
) => {
	let contract = context.drizzle.contracts[contractName];
	let abiArr = contract.abi;
	let methodAbi = abiArr.filter(el => el.name === methodName)[0];
	let methodInputs = methodAbi.inputs.map(el => el.type);
	let eth = context.drizzle.web3.eth;
	let funcSig = eth.abi.encodeFunctionSignature(methodAbi);
	if (!Array.isArray(params)) {
		params = [params];
	}
	let param = eth.abi.encodeParameters(methodInputs, params);
	let data = funcSig + param.slice(2);
	let paramStr = params
		.map(el => {
			return Array.isArray(el) ? '[' + el.toString() + ']' : el.toString();
		})
		.join(',');
	let methodStr = contractName + '.' + methodName + '(' + paramStr + ')';

	if (skipDryRun || methodName === 'submitProof_CoinFlip') {
		doCacheSend(props, contract, methodName, params, defaultAccount, methodStr, displayStr, callbacks);
		return;
	}

	console.log('Initiating dry run: ' + methodStr);
	eth.call({ from: defaultAccount, to: contract.address, data: data }, (err, res) => {
		if (err) {
			let errParsed = JSON.parse(err.toString().substring('Error: [object Object]'.length));
			let errObj = errParsed.data[Object.keys(errParsed.data)[0]];
			console.log('Dry run failed with error: ' + errObj.reason, err);
			if (showToast) {
				toast.error(
					<div>
						<b>Transaction test failed</b>
						<br />
						{'Reason: ' + errObj.reason}
					</div>,
					{ position: toast.POSITION.TOP_RIGHT }
				);
			}

			props.dispatch({
				type: 'DRY_RUN_FAILED',
				methodStr: methodStr,
				displayStr: displayStr,
				errorReason: errObj.reason
			});
			doCallback(callbacks, 'dryRunFailed', errObj.reason);
			return;
		}
		console.log('Dry run succeeded, initiating transaction', res);
		console.log(res);
		doCallback(callbacks, 'dryRunSucceeded', res);
		doCacheSend(props, contract, methodName, params, defaultAccount, methodStr, displayStr, callbacks);
	});
};

const readOnlyCall = (
	context,
	props,
	defaultAccount,
	contractName,
	methodName,
	params,
	displayStr = '',
	callbacks = {}, // transactionSent, transactionCompleted, transactionFailed, dryRunSucceeded, dryRunFailed
	skipDryRun = false,
	showToast = true
) => {
	let contract = context.drizzle.contracts[contractName];
	let abiArr = contract.abi;
	let methodAbi = abiArr.filter(el => el.name === methodName)[0];
	let methodInputs = methodAbi.inputs.map(el => el.type);
	let eth = context.drizzle.web3.eth;
	let funcSig = eth.abi.encodeFunctionSignature(methodAbi);
	if (!Array.isArray(params)) {
		params = [params];
	}
	let param = eth.abi.encodeParameters(methodInputs, params);
	let data = funcSig + param.slice(2);
	let paramStr = params
		.map(el => {
			return Array.isArray(el) ? '[' + el.toString() + ']' : el.toString();
		})
		.join(',');
	let methodStr = contractName + '.' + methodName + '(' + paramStr + ')';
	let res;
	if (Object.keys(params).length === 0)
		res = contract.methods[methodName]().call({ from: defaultAccount, to: contract.address, data: data });
	else res = contract.methods[methodName](params).call({ from: defaultAccount, to: contract.address, data: data });
	let promises = [];
	promises.push(res);
	// console.log(promises);
	return promises;
};

const doCacheSend = (props, contract, methodName, params, defaultAccount, methodStr, displayStr, callbacks) => {
	let value = methodName === 'submitProof_CoinFlip' ? 4000000000000000 : undefined;
	let gas = methodName === 'submitProof_CoinFlip' ? 6721975 : undefined;
	const stackId = contract.methods[methodName].cacheSend(...params, { from: defaultAccount, value, gas });
	doCallback(callbacks, 'transactionSent');

	props.dispatch({
		type: 'ENRICH_PENDING_TRANSACTION',
		stackId: stackId,
		methodStr: methodStr,
		displayStr: displayStr,
		callbacks: callbacks
	});
};

const getContractData = (contract, defaultAccount, method, ...methodArgs) => {
	if (methodArgs.length === 0) {
		return contract.methods[method]().call({
			from: defaultAccount
		});
	} else {
		return contract.methods[method](...methodArgs).call({
			from: defaultAccount
		});
	}
};

const addContract = (props, drizzle, name, address, events, tokenNameSuffixed) => {
	const json = require('../build/contracts/' + name + '.json');
	let contractConfig = {
		contractName: tokenNameSuffixed ? tokenNameSuffixed : name,
		web3Contract: new web3.eth.Contract(json.abi, address)
	};
	props.dispatch({ type: 'ADD_CONTRACT', drizzle, contractConfig, events, web3 });
};

const findTokenBySymbol = (props, symb) => {
	let symbol = symb.toUpperCase();
	let keys = Object.keys(props.fin4Tokens);
	for (let i = 0; i < keys.length; i++) {
		let token = props.fin4Tokens[keys[i]];
		if (token.symbol === symbol) {
			return token;
		}
	}
	return null;
};

const isValidPublicAddress = addr => {
	try {
		let address = web3.utils.toChecksumAddress(addr);
		return true;
	} catch (e) {
		console.error(e.message);
		return false;
	}
};

const getFin4TokensFormattedForSelectOptions = fin4Tokens => {
	return Object.keys(fin4Tokens).map(addr => {
		let token = fin4Tokens[addr];
		return {
			value: token.address,
			label: token.name,
			symbol: token.symbol
		};
	});
};

const fetchMessage = (Fin4MessagingContract, defaultAccount, messageId) => {
	return getContractData(Fin4MessagingContract, defaultAccount, 'getMyMessage', messageId).then(
		({
			0: messageId,
			1: messageType,
			2: sender,
			3: senderStr,
			4: message,
			5: hasBeenActedUpon,
			6: attachment,
			7: pendingApprovalId
		}) => {
			return {
				messageId: messageId.toString(),
				messageType: messageType.toString(),
				sender: sender,
				verifierTypeName: senderStr,
				message: message,
				hasBeenActedUpon: hasBeenActedUpon,
				attachment: attachment,
				pendingApprovalId: pendingApprovalId
			};
		}
	);
};

const fetchParameterizerParams = (props, parameterizerContract) => {
	getContractData(parameterizerContract, props.store.getState().fin4Store.defaultAccount, 'getAll').then(
		paramValues => {
			let params = {};
			for (let i = 0; i < paramValues.length; i++) {
				let param = ParameterizerParams[i];
				params[param.name] = {
					name: param.name,
					description: param.description,
					value: Number(paramValues[i])
				};
			}
			props.dispatch({
				type: 'SET_PARAMETERIZER_PARAMS',
				paramsObj: params
			});
		}
	);
};

const fetchUsersGOVbalance = (props, GOVcontract) => {
	let defaultAccount = props.store.getState().fin4Store.defaultAccount;
	getContractData(GOVcontract, defaultAccount, 'balanceOf', defaultAccount).then(balanceBN => {
		props.dispatch({
			type: 'UPDATE_GOVERNANCE_BALANCE',
			tokenAddress: GOVcontract.address,
			balance: new BN(balanceBN).toNumber()
		});
	});
};

const fetchUsersREPbalance = (props, REPcontract) => {
	let defaultAccount = props.store.getState().fin4Store.defaultAccount;
	getContractData(REPcontract, defaultAccount, 'balanceOf', defaultAccount).then(balanceBN => {
		props.dispatch({
			type: 'UPDATE_GOVERNANCE_BALANCE',
			tokenAddress: REPcontract.address,
			balance: new BN(balanceBN).toNumber()
		});
	});
};

// --------------------- LOAD INITIAL DATA ---------------------

const addSatelliteContracts = (props, Fin4MainContract, drizzle) => {
	let defaultAccount = props.store.getState().fin4Store.defaultAccount;
	getContractData(Fin4MainContract, defaultAccount, 'getSatelliteAddresses').then(
		({
			0: Fin4UncappedTokenCreatorAddress,
			1: Fin4CappedTokenCreatorAddress,
			2: Fin4TokenManagementAddress,
			3: Fin4ClaimingAddress,
			4: Fin4CollectionsAddress,
			5: Fin4MessagingAddress,
			6: Fin4VerifyingAddress,
			7: Fin4GroupsAddress,
			8: Fin4SystemParametersAddress,
			9: Fin4VotingAddress
		}) => {
			addContract(props, drizzle, 'Fin4UncappedTokenCreator', Fin4UncappedTokenCreatorAddress, []);
			addContract(props, drizzle, 'Fin4CappedTokenCreator', Fin4CappedTokenCreatorAddress, []);
			addContract(props, drizzle, 'Fin4TokenManagement', Fin4TokenManagementAddress, ['Fin4TokenCreated']);
			addContract(props, drizzle, 'Fin4Messaging', Fin4MessagingAddress, ['NewMessage', 'MessageMarkedAsRead']);
			addContract(props, drizzle, 'Fin4Claiming', Fin4ClaimingAddress, [
				'ClaimSubmitted',
				'ClaimApproved',
				'ClaimRejected',
				'VerifierApproved',
				'VerifierRejected',
				'UpdatedTotalSupply'
			]);
			addContract(props, drizzle, 'Fin4Collections', Fin4CollectionsAddress, []);
			addContract(props, drizzle, 'Fin4Verifying', Fin4VerifyingAddress, ['SubmissionAdded']);
			addContract(props, drizzle, 'Fin4Groups', Fin4GroupsAddress, []);
			addContract(props, drizzle, 'Fin4SystemParameters', Fin4SystemParametersAddress, []);
			addContract(props, drizzle, 'Fin4Voting', Fin4VotingAddress, []);
		}
	);
};

const addTCRcontracts = (props, Fin4MainContract, drizzle) => {
	let defaultAccount = props.store.getState().fin4Store.defaultAccount;
	getContractData(Fin4MainContract, defaultAccount, 'getTCRaddresses').then(
		({ 0: REPTokenAddress, 1: GOVTokenAddress, 2: RegistryAddress, 3: PLCRVotingAddress, 4: ParameterizerAddress }) => {
			addContract(props, drizzle, 'REP', REPTokenAddress, []);
			addContract(props, drizzle, 'GOV', GOVTokenAddress, []);
			addContract(props, drizzle, 'Registry', RegistryAddress, []);
			addContract(props, drizzle, 'PLCRVoting', PLCRVotingAddress, []);
			addContract(props, drizzle, 'Parameterizer', ParameterizerAddress, []);
		}
	);
};

const fetchSystemParameters = (props, Fin4SystemParametersContract) => {
	let defaultAccount = props.store.getState().fin4Store.defaultAccount;
	getContractData(Fin4SystemParametersContract, defaultAccount, 'getSystemParameters').then(
		({ 0: REPforTokenCreationBN, 1: REPforTokenClaimBN }) => {
			props.dispatch({
				type: 'SET_SYSTEM_PARAMETER',
				parameter: {
					name: 'REPforTokenCreation',
					value: new BN(REPforTokenCreationBN).toNumber()
				}
			});
			props.dispatch({
				type: 'SET_SYSTEM_PARAMETER',
				parameter: {
					name: 'REPforTokenClaim',
					value: new BN(REPforTokenClaimBN).toNumber()
				}
			});
		}
	);
};

const fetchMessages = (props, Fin4MessagingContract) => {
	let defaultAccount = props.store.getState().fin4Store.defaultAccount;
	getContractData(Fin4MessagingContract, defaultAccount, 'getMyMessagesCount')
		.then(data => {
			var messageCount = Number(data);
			var messageIndices = [];
			for (var i = 0; i < messageCount; i++) {
				messageIndices.push(i);
			}
			return messageIndices.map(index => {
				return fetchMessage(Fin4MessagingContract, defaultAccount, index);
			});
		})
		.then(messages => Promise.all(messages))
		.then(messages => {
			props.dispatch({
				type: 'ADD_MULTIPLE_MESSAGES',
				messagesArr: messages
			});
		});
};

const fetchAllTokens = (props, Fin4TokenManagementContract, callback) => {
	let defaultAccount = props.store.getState().fin4Store.defaultAccount;
	getContractData(Fin4TokenManagementContract, defaultAccount, 'getAllFin4Tokens')
		.then(tokens => {
			return tokens.map(tokenAddr => {
				return getContractData(Fin4TokenManagementContract, defaultAccount, 'getTokenInfo', tokenAddr).then(
					({
						0: userIsCreator,
						1: name,
						2: symbol,
						3: description,
						4: unit,
						5: totalSupply,
						6: creationTime,
						7: hasFixedMintingQuantity,
						8: underlyings
					}) => {
						return {
							userIsCreator: userIsCreator,
							address: tokenAddr,
							name: name,
							symbol: symbol,
							description: description,
							unit: unit,
							totalSupply: new BN(totalSupply).toNumber(),
							creationTime: creationTime,
							hasFixedMintingQuantity: hasFixedMintingQuantity,
							isOPAT: null,
							underlyings: underlyings
						};
					}
				);
			});
		})
		.then(promises => Promise.all(promises))
		.then(tokenArr => {
			props.dispatch({
				type: 'ADD_MULTIPLE_FIN4_TOKENS',
				tokenArr: tokenArr
			});
			callback();
		});
};

const fetchUsersNonzeroTokenBalances = (props, Fin4TokenManagementContract) => {
	let defaultAccount = props.store.getState().fin4Store.defaultAccount;
	getContractData(Fin4TokenManagementContract, defaultAccount, 'getMyNonzeroTokenBalances').then(
		({ 0: nonzeroBalanceTokens, 1: balancesBN }) => {
			if (nonzeroBalanceTokens.length === 0) {
				return;
			}
			props.dispatch({
				type: 'UPDATE_MULTIPLE_BALANCES',
				tokenAddresses: nonzeroBalanceTokens,
				balances: balancesBN.map(balanceBN => new BN(balanceBN).toNumber())
			});
		}
	);
};

const fetchUnderlyings = (props, Fin4TokenManagementContract) => {
	let defaultAccount = props.store.getState().fin4Store.defaultAccount;
	getContractData(Fin4TokenManagementContract, defaultAccount, 'getUnderlyings').then(underlyingsBytes32Arr => {
		props.dispatch({
			type: 'SET_UNDERLYINGS',
			allUnderlyings: underlyingsBytes32Arr.map(b32 => {
				return {
					title: bytes32ToString(b32)
				};
			})
		});
	});
};

const fetchAndAddAllVerifierTypes = (props, Fin4Verifying, drizzle) => {
	let defaultAccount = props.store.getState().fin4Store.defaultAccount;
	getContractData(Fin4Verifying, defaultAccount, 'getVerifierTypes')
		.then(verifierTypeAddresses => {
			return verifierTypeAddresses.map(verifierTypeAddress => {
				return getContractData(Fin4Verifying, defaultAccount, 'getVerifierTypeInfo', verifierTypeAddress).then(
					({ 0: name, 1: description, 2: parameterForTokenCreatorToSetEncoded, 3: isNoninteractive }) => {
						// add Contract objects to drizzle
						addContract(props, drizzle, name, verifierTypeAddress, []);
						return {
							value: verifierTypeAddress,
							label: name,
							description: description,
							paramsEncoded: parameterForTokenCreatorToSetEncoded,
							isNoninteractive: isNoninteractive
						};
					}
				);
			});
		})
		.then(data => Promise.all(data))
		.then(data => {
			props.dispatch({
				type: 'ADD_MULTIPLE_VERIFIER_TYPES',
				verifierTypesArr: data
			});
		});
};

const fetchCurrentUsersClaims = (props, Fin4ClaimingContract) => {
	let defaultAccount = props.store.getState().fin4Store.defaultAccount;
	getContractData(Fin4ClaimingContract, defaultAccount, 'getTokensWhereUserHasClaims')
		.then(tokenAddresses => {
			return tokenAddresses.map(tokenAddr => {
				return getContractData(Fin4ClaimingContract, defaultAccount, 'getMyClaimIdsOnThisToken', tokenAddr).then(
					claimIds => {
						return claimIds.map(claimId => {
							return getContractData(
								Fin4ClaimingContract,
								defaultAccount,
								'getClaimOnThisToken',
								tokenAddr,
								claimId
							).then(
								({
									0: claimer,
									1: isApproved,
									2: gotRejected,
									3: quantityBN,
									4: claimCreationTimeBN,
									5: comment,
									6: requiredVerifierTypes,
									7: verifierStatuses, // ProofAndVerifierStatusEnum
									8: verifiersWithMessages
								}) => {
									let verifierStatusesObj = {};
									for (let i = 0; i < requiredVerifierTypes.length; i++) {
										verifierStatusesObj[requiredVerifierTypes[i]] = {
											status: Number(verifierStatuses[i]),
											message: ''
										};
									}
									return {
										id: tokenAddr + '_' + claimId, // pseudoId
										token: tokenAddr,
										claimId: claimId,
										claimer: claimer,
										isApproved: isApproved,
										gotRejected: gotRejected,
										quantity: new BN(quantityBN).toNumber(),
										claimCreationTime: new BN(claimCreationTimeBN).toNumber(),
										comment: comment,
										verifierStatuses: verifierStatusesObj,
										verifiersWithMessages: verifiersWithMessages.filter(addr => addr !== zeroAddress)
									};
								}
							);
						});
					}
				);
			});
		})
		.then(promises => Promise.all(promises))
		.then(data => data.flat())
		.then(promises => Promise.all(promises))
		.then(claimArr => {
			props.dispatch({
				type: 'ADD_MULTIPLE_CLAIMS',
				claimArr: claimArr
			});
		});
};

const fetchCollectionsInfo = (props, Fin4CollectionsContract) => {
	let defaultAccount = props.store.getState().fin4Store.defaultAccount;
	getContractData(Fin4CollectionsContract, defaultAccount, 'getCollectionsCount')
		.then(collectionsCount => {
			return Array(new BN(collectionsCount).toNumber())
				.fill()
				.map((x, i) => i)
				.map(collectionId => {
					return getContractData(Fin4CollectionsContract, defaultAccount, 'getCollection', collectionId).then(
						({
							0: userIsCreator,
							1: userIsAdmin,
							2: adminGroupIsSet,
							3: adminGroupId,
							4: tokens,
							5: name,
							6: identifier,
							7: description
							// 8: color,
							// 9: logoURL
						}) => {
							return {
								collectionId: collectionId,
								userIsCreator: userIsCreator,
								userIsAdmin: userIsAdmin,
								adminGroupIsSet: adminGroupIsSet,
								adminGroupId: adminGroupId,
								tokens: tokens,
								name: name,
								identifier: identifier,
								description: description
							};
						}
					);
				});
		})
		.then(promises => Promise.all(promises))
		.then(data => {
			props.dispatch({
				type: 'ADD_MULTIPLE_COLLECTIONS',
				collectionsArr: data
			});
		});
};

const fetchAllSubmissions = (props, Fin4Verifying) => {
	let defaultAccount = props.store.getState().fin4Store.defaultAccount;
	getContractData(Fin4Verifying, defaultAccount, 'getSubmissionsCount')
		.then(submissionsCount => {
			return Array(new BN(submissionsCount).toNumber())
				.fill()
				.map((x, i) => i)
				.map(submissionId => {
					return getContractData(Fin4Verifying, defaultAccount, 'submissions', submissionId).then(
						({ 0: submissionId, 1: verifierType, 2: token, 3: user, 4: timestamp, 5: contentType, 6: content }) => {
							return {
								submissionId: submissionId,
								verifierType: verifierType,
								token: token,
								user: user,
								timestamp: timestamp,
								contentType: contentType,
								content: content
							};
						}
					);
				});
		})
		.then(promises => Promise.all(promises))
		.then(submissionsArr => {
			props.dispatch({
				type: 'ADD_MULTIPLE_SUBMISSIONS',
				submissionsArr: submissionsArr
			});
		});
};

// --------------------- TCR ---------------------

const fetchOPATs = (props, RegistryContract) => {
	let defaultAccount = props.store.getState().fin4Store.defaultAccount;
	getContractData(RegistryContract, defaultAccount, 'getWhitelistedListingKeys').then(whitelistedListingKeys => {
		whitelistedListingKeys.map(listingKey => {
			props.dispatch({
				type: 'MARK_FIN4TOKEN_AS_OPAT',
				lowerCaseTokenAddress: '0x' + listingKey.substr(26, listingKey.length - 1)
			});
		});
	});
};

const PollStatus = {
	IN_COMMIT_PERIOD: 'Commit Vote',
	IN_REVEAL_PERIOD: 'Reveal',
	PAST_REVEAL_PERIOD: '-'
};

const getPollStatus = (pollID, PLCRVotingContract, defaultAccount) => {
	// pollID is also called challengeID in Registry.sol

	return getContractData(PLCRVotingContract, defaultAccount, 'pollMap', pollID).then(
		({ 0: commitEndDateBN, 1: revealEndDateBN, 2: voteQuorum, 3: votesFor, 4: votesAgainst }) => {
			let commitEndDate = new BN(commitEndDateBN).toNumber() * 1000;
			let revealEndDate = new BN(revealEndDateBN).toNumber() * 1000;
			let nowTimestamp = Date.now();

			if (commitEndDate - nowTimestamp > 0) {
				return {
					inPeriod: PollStatus.IN_COMMIT_PERIOD,
					dueDate: new Date(commitEndDate).toLocaleString('de-CH-1996') // choose locale automatically?
				};
			}

			if (revealEndDate - nowTimestamp > 0) {
				return {
					inPeriod: PollStatus.IN_REVEAL_PERIOD,
					dueDate: new Date(revealEndDate).toLocaleString('de-CH-1996')
				};
			}

			return {
				inPeriod: PollStatus.PAST_REVEAL_PERIOD,
				dueDate: ''
			};
		}
	);
};

// -------------------------------------------------------------

export {
	getContractData,
	addContract,
	readOnlyCall,
	addSatelliteContracts,
	addTCRcontracts,
	fetchMessage,
	fetchMessages,
	fetchAllTokens,
	fetchUsersNonzeroTokenBalances,
	fetchCurrentUsersClaims,
	fetchAndAddAllVerifierTypes,
	fetchAllSubmissions,
	findTokenBySymbol,
	isValidPublicAddress,
	getFin4TokensFormattedForSelectOptions,
	fetchCollectionsInfo,
	zeroAddress,
	fetchParameterizerParams,
	PollStatus,
	getPollStatus,
	fetchUsersGOVbalance,
	fetchUsersREPbalance,
	fetchOPATs,
	fetchSystemParameters,
	contractCall,
	fetchUnderlyings
};
