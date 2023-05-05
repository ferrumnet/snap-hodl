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
function getUniqueStakersFromOpenStaking(web3Instance, stakingContractAddress, tokenContractAddress) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Fetching Unique Stakers from Open Staking Contract...");
        const tokenContract = new web3Instance.eth.Contract(tokenContractAbi_json_1.default, tokenContractAddress);
        const transferEventSignature = tokenContract.events.Transfer.signature;
        const transferEventFilter = {
            fromBlock: 66553295,
            toBlock: "latest",
            address: tokenContractAddress,
            topics: [transferEventSignature, null, web3Instance.eth.abi.encodeParameter("address", stakingContractAddress)],
        };
        const uniqueStakers = new Set();
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
                    uniqueStakers.add(event.src);
                }
            });
        }
        catch (error) {
            console.error("Error fetching ERC20 transfers to Staking Contract:", error);
        }
        return uniqueStakers;
    });
}
exports.getUniqueStakersFromOpenStaking = getUniqueStakersFromOpenStaking;
function getOpenStakingStakedBalances(web3Instance, stakingContractAddress, tokenContractAddress, uniqueStakers, decimals) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Fetching staked balances from Open Staking Contract...");
        const stakingContract = new web3Instance.eth.Contract(openStakingContractAbi_json_1.default, stakingContractAddress);
        const stakedBalances = {};
        try {
            for (const stakerAddress of uniqueStakers) {
                const stakedBalanceRaw = yield stakingContract.methods.stakeOf(tokenContractAddress, stakerAddress).call();
                const stakedBalance = new bignumber_js_1.BigNumber(stakedBalanceRaw).dividedBy(new bignumber_js_1.BigNumber(10).pow(decimals)).toString();
                stakedBalances[stakerAddress] = stakedBalance;
            }
        }
        catch (error) {
            console.error("Error fetching staked balances from Open Staking Contract:", error);
        }
        return stakedBalances;
    });
}
exports.getOpenStakingStakedBalances = getOpenStakingStakedBalances;
