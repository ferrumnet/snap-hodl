"use strict";
// src/openStaking.ts
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOpenStakingStakedBalances = exports.getUniqueStakersFromOpenStaking = void 0;
const bignumber_js_1 = require("bignumber.js");
const tokenContractAbi_json_1 = __importDefault(require("../ABI/tokenContractAbi.json"));
const openStakingContractAbi_json_1 = __importDefault(require("../ABI/openStakingContractAbi.json"));
const stakingService_1 = require("./services/stakingService");
function getUniqueStakersFromOpenStaking(stakingPoolName, stakingContractAddress, stakingPoolType, tokenContractAddress, chainId, web3Instance, fromBlock, toBlock, blockIterationSize, dbName, dbCollection, connectionString) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`Fetching Unique Stakers from Open Staking Contract: `, stakingPoolName, " | ", stakingContractAddress);
        const existingSnapshot = yield (0, stakingService_1.getLatestStakingSnapshot)(stakingContractAddress, tokenContractAddress, chainId, dbName, dbCollection, connectionString);
        const uniqueStakers = new Set(existingSnapshot ? existingSnapshot.uniqueStakers : []);
        // Convert block identifiers to actual block numbers
        const currentBlockNumber = yield web3Instance.eth.getBlockNumber();
        const resolvedFromBlock = fromBlock === "latest" ? currentBlockNumber : fromBlock;
        const resolvedToBlock = toBlock === "latest" ? currentBlockNumber : toBlock;
        const step = blockIterationSize;
        let startBlock = resolvedFromBlock;
        if (existingSnapshot && existingSnapshot.latestBlockCaptured >= resolvedFromBlock) {
            startBlock = existingSnapshot.latestBlockCaptured + 1;
        }
        const tokenContract = new web3Instance.eth.Contract(tokenContractAbi_json_1.default, tokenContractAddress);
        const transferEventSignature = tokenContract.events.Transfer.signature;
        for (let currentBlock = startBlock; currentBlock < resolvedToBlock; currentBlock += step) {
            const endBlock = Math.min(currentBlock + step - 1, resolvedToBlock);
            const transferEventFilter = {
                fromBlock: currentBlock,
                toBlock: endBlock,
                address: tokenContractAddress,
                topics: [transferEventSignature, null, web3Instance.eth.abi.encodeParameter("address", stakingContractAddress)],
            };
            try {
                const logs = yield web3Instance.eth.getPastLogs(transferEventFilter);
                console.log("Fetched logs:", logs);
                logs.forEach((log) => {
                    console.log("Log:", log);
                    const eventInterface = tokenContract.options.jsonInterface.find((i) => i.signature === log.topics[0]);
                    if (!eventInterface) {
                        console.error("Event interface not found for signature:", log.topics[0]);
                        return;
                    }
                    const inputs = eventInterface.inputs;
                    const event = web3Instance.eth.abi.decodeLog(inputs, log.data, log.topics.slice(1));
                    console.log("Decoded event:", event);
                    // Check if the destination address matches the staking contract address
                    if (event.dst.toLowerCase() === stakingContractAddress.toLowerCase()) {
                        uniqueStakers.add(event.src.toLowerCase());
                    }
                });
                console.log("Unique stakers fetched for blocks", currentBlock, "to", endBlock);
                yield (0, stakingService_1.saveStakingSnapshot)(stakingPoolName, stakingContractAddress, stakingPoolType, tokenContractAddress, chainId, endBlock, Array.from(uniqueStakers), dbName, dbCollection, connectionString);
            }
            catch (error) {
                console.error("Error fetching ERC20 transfers to Staking Contract:", error);
            }
        }
        return uniqueStakers;
    });
}
exports.getUniqueStakersFromOpenStaking = getUniqueStakersFromOpenStaking;
function getOpenStakingStakedBalances(stakingPoolName, stakingContractAddress, tokenContractAddress, chainId, uniqueStakers, decimals, web3Instance, dbName, dbCollection, connectionString) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`Fetching staked balances from Open Staking Contract: `, stakingPoolName, " | ", stakingContractAddress);
        const stakingContract = new web3Instance.eth.Contract(openStakingContractAbi_json_1.default, stakingContractAddress);
        const stakedBalances = {};
        try {
            for (const stakerAddress of uniqueStakers) {
                const balanceRaw = yield stakingContract.methods.stakeOf(tokenContractAddress, stakerAddress).call();
                const humanReadableBalance = new bignumber_js_1.BigNumber(balanceRaw).dividedBy(new bignumber_js_1.BigNumber(10).pow(decimals)).toString();
                stakedBalances[stakerAddress] = humanReadableBalance;
            }
            yield (0, stakingService_1.saveStakedBalances)(stakingContractAddress, tokenContractAddress, chainId, stakedBalances, dbName, dbCollection, connectionString);
        }
        catch (error) {
            console.error("Error fetching staked balances from Open Staking Contract:", error);
        }
        return stakedBalances;
    });
}
exports.getOpenStakingStakedBalances = getOpenStakingStakedBalances;
