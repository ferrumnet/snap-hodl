"use strict";
// src/standardStaking.ts
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
exports.getStakedBalances = exports.getUniqueStakers = void 0;
const standardStakingContractAbi_json_1 = __importDefault(require("../ABI/standardStakingContractAbi.json"));
const bignumber_js_1 = require("bignumber.js");
const stakingService_1 = require("./services/stakingService");
function getUniqueStakers(stakingPoolName, stakingContractAddress, stakingPoolType, tokenContractAddress, chainId, web3Instance, fromBlock, toBlock, blockIterationSize, dbName, dbCollection, connectionString) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`Fetching unique stakers from Staking Contract: `, stakingPoolName, " | ", stakingContractAddress);
        const existingSnapshot = yield (0, stakingService_1.getLatestStakingSnapshot)(stakingContractAddress, tokenContractAddress, chainId, dbName, dbCollection, connectionString);
        const uniqueStakers = new Set(existingSnapshot ? existingSnapshot.uniqueStakers : []);
        const step = blockIterationSize;
        // Convert block identifiers to actual block numbers
        const currentBlockNumber = yield web3Instance.eth.getBlockNumber();
        const resolvedFromBlock = fromBlock === "latest" ? currentBlockNumber : fromBlock;
        const resolvedToBlock = toBlock === "latest" ? currentBlockNumber : toBlock;
        const stakingContract = new web3Instance.eth.Contract(standardStakingContractAbi_json_1.default, stakingContractAddress);
        let startBlock = resolvedFromBlock;
        if (existingSnapshot && existingSnapshot.latestBlockCaptured >= resolvedFromBlock) {
            startBlock = existingSnapshot.latestBlockCaptured + 1;
        }
        for (let currentBlock = startBlock; currentBlock < resolvedToBlock; currentBlock += step) {
            const endBlock = Math.min(currentBlock + step - 1, resolvedToBlock);
            const stakedEventFilter = {
                fromBlock: currentBlock,
                toBlock: endBlock,
                address: stakingContractAddress,
                topics: [stakingContract.events.Staked.signature],
            };
            try {
                const logs = yield web3Instance.eth.getPastLogs(stakedEventFilter);
                // console.log("Fetched logs:", logs);
                logs.forEach((log) => {
                    const eventInterface = stakingContract.options.jsonInterface.find((i) => i.signature === log.topics[0]);
                    if (!eventInterface) {
                        console.error("Event interface not found for signature:", log.topics[0]);
                        return;
                    }
                    const inputs = eventInterface.inputs;
                    const event = web3Instance.eth.abi.decodeLog(inputs, log.data, log.topics.slice(1));
                    console.log("Decoded event:", event);
                    const stakerAddress = event["staker_"].toLowerCase();
                    uniqueStakers.add(stakerAddress);
                });
                console.log("Unique stakers fetched for blocks", currentBlock, "to", endBlock);
                yield (0, stakingService_1.saveStakingSnapshot)(stakingPoolName, stakingContractAddress, stakingPoolType, tokenContractAddress, chainId, endBlock, Array.from(uniqueStakers), dbName, dbCollection, connectionString);
            }
            catch (error) {
                console.error("Error fetching unique stakers:", error);
            }
        }
        return Array.from(uniqueStakers);
    });
}
exports.getUniqueStakers = getUniqueStakers;
function getStakedBalances(stakingPoolName, stakingContractAddress, stakingPoolType, tokenContractAddress, chainId, stakers, decimals, web3Instance, dbName, dbCollection, connectionString) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`Fetching staked balances: `, stakingPoolName, " | ", stakingContractAddress);
        const stakedBalances = {};
        const stakingContract = new web3Instance.eth.Contract(standardStakingContractAbi_json_1.default, stakingContractAddress);
        try {
            for (const staker of stakers) {
                try {
                    const balanceRaw = yield stakingContract.methods.stakeOf(staker).call();
                    const humanReadableBalance = new bignumber_js_1.BigNumber(balanceRaw)
                        .dividedBy(new bignumber_js_1.BigNumber(10).pow(decimals))
                        .toString();
                    stakedBalances[staker] = humanReadableBalance;
                }
                catch (error) {
                    console.error(`Error fetching staked balance for ${staker}:`, error);
                }
            }
            yield (0, stakingService_1.saveStakedBalances)(stakingContractAddress, tokenContractAddress, chainId, stakedBalances, dbName, dbCollection, connectionString);
        }
        catch (error) {
            console.error("Error fetching staked balances from Standard Staking Contract:", error);
        }
        console.log("Staked balances fetched.");
        return stakedBalances;
    });
}
exports.getStakedBalances = getStakedBalances;
