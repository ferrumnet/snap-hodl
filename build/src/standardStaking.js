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
function getUniqueStakers(stakingContractAddress, web3Instance) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Fetching unique stakers...");
        const uniqueStakers = new Set();
        const stakingContract = new web3Instance.eth.Contract(standardStakingContractAbi_json_1.default, stakingContractAddress);
        const stakedEventFilter = {
            fromBlock: 66553295,
            toBlock: "latest",
            address: stakingContractAddress,
            topics: [stakingContract.events.Staked.signature],
        };
        try {
            const logs = yield web3Instance.eth.getPastLogs(stakedEventFilter);
            console.log("Fetched logs:", logs);
            logs.forEach((log) => {
                const eventInterface = stakingContract.options.jsonInterface.find((i) => i.signature === log.topics[0]);
                if (!eventInterface) {
                    console.error("Event interface not found for signature:", log.topics[0]);
                    return;
                }
                const inputs = eventInterface.inputs;
                const event = web3Instance.eth.abi.decodeLog(inputs, log.data, log.topics.slice(1));
                console.log("Decoded event:", event);
                const stakerAddress = event["staker_"];
                uniqueStakers.add(stakerAddress);
            });
            console.log("Unique stakers fetched.");
        }
        catch (error) {
            console.error("Error fetching unique stakers:", error);
        }
        return Array.from(uniqueStakers);
    });
}
exports.getUniqueStakers = getUniqueStakers;
function getStakedBalances(stakers, decimals, stakingContractAddress, web3Instance) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Fetching staked balances...");
        const stakedBalances = new Map();
        const stakingContract = new web3Instance.eth.Contract(standardStakingContractAbi_json_1.default, stakingContractAddress);
        for (const staker of stakers) {
            try {
                const balance = yield stakingContract.methods.stakeOf(staker).call();
                const convertedBalance = new bignumber_js_1.BigNumber(balance)
                    .dividedBy(new bignumber_js_1.BigNumber(10).pow(decimals))
                    .toString();
                stakedBalances.set(staker, convertedBalance);
            }
            catch (error) {
                console.error(`Error fetching staked balance for ${staker}:`, error);
            }
        }
        console.log("Staked balances fetched.");
        return stakedBalances;
    });
}
exports.getStakedBalances = getStakedBalances;
