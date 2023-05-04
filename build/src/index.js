"use strict";
// src/index.ts
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
const dotenv_1 = __importDefault(require("dotenv"));
const web3_1 = __importDefault(require("web3"));
const bignumber_js_1 = require("bignumber.js");
const standardStakingContractAbi_json_1 = __importDefault(require("../ABI/standardStakingContractAbi.json"));
const tokenContractAbi_json_1 = __importDefault(require("../ABI/tokenContractAbi.json"));
dotenv_1.default.config();
const rpcUrl = process.env.RPC_URL || "";
const web3 = new web3_1.default(rpcUrl);
console.log("Web3 instance created.");
const tokenContractAddress = "0x9f6abbf0ba6b5bfa27f4deb6597cc6ec20573fda";
const tokenContract = new web3.eth.Contract(tokenContractAbi_json_1.default, tokenContractAddress);
console.log("Token contract instance created.");
function getTokenDecimals(tokenContractAddress) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Fetching token decimals...");
        let decimals = 18;
        try {
            const tokenContract = new web3.eth.Contract(tokenContractAbi_json_1.default, tokenContractAddress);
            decimals = parseInt(yield tokenContract.methods.decimals().call());
        }
        catch (error) {
            console.error("Error fetching token decimals:", error);
        }
        console.log("Token decimals fetched.");
        return decimals;
    });
}
const stakingContractAddress = "0x2bE7904c81dd3535f31B2C7B524a6ed91FDb37EC";
const stakingContract = new web3.eth.Contract(standardStakingContractAbi_json_1.default, stakingContractAddress);
console.log("Staking contract instance created.");
function getUniqueStakers() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Fetching unique stakers...");
        const uniqueStakers = new Set();
        const stakedEventFilter = {
            fromBlock: 70124014,
            toBlock: "latest",
            address: stakingContractAddress,
            topics: [stakingContract.events.Staked.signature],
        };
        try {
            const logs = yield web3.eth.getPastLogs(stakedEventFilter);
            logs.forEach((log) => {
                const eventInterface = stakingContract.options.jsonInterface.find((i) => i.signature === log.topics[0]);
                if (!eventInterface) {
                    console.error("Event interface not found for signature:", log.topics[0]);
                    return;
                }
                const inputs = eventInterface.inputs;
                const event = web3.eth.abi.decodeLog(inputs, log.data, log.topics.slice(1));
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
function getStakedBalances(stakers, decimals) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Fetching staked balances...");
        const stakedBalances = new Map();
        for (const staker of stakers) {
            try {
                const balance = yield stakingContract.methods.stakeOf(staker).call();
                const convertedBalance = new bignumber_js_1.BigNumber(balance).dividedBy(new bignumber_js_1.BigNumber(10).pow(decimals)).toString();
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
function getStakingPoolName() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Fetching staking pool name...");
        let poolName = "";
        try {
            poolName = yield stakingContract.methods.name().call();
        }
        catch (error) {
            console.error("Error fetching staking pool name:", error);
        }
        console.log("Staking pool name fetched.");
        return poolName;
    });
}
(() => __awaiter(void 0, void 0, void 0, function* () {
    const decimals = yield getTokenDecimals(tokenContractAddress);
    console.log("Token decimals:", decimals);
    const stakers = yield getUniqueStakers();
    console.log("Unique staker addresses:", stakers);
    const stakedBalances = yield getStakedBalances(stakers, decimals);
    console.log("Staked balances:", stakedBalances);
    const stakingPoolName = yield getStakingPoolName();
    console.log("Staking pool name:", stakingPoolName);
    const result = {
        stakingPoolName: stakingPoolName,
        stakedBalances: Object.fromEntries(stakedBalances),
    };
    console.log("Result:", JSON.stringify(result, null, 2));
}))();
