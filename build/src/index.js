"use strict";
// ./index.ts
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
const web3_1 = __importDefault(require("web3"));
const stakingContractAbi_json_1 = __importDefault(require("../ABI/stakingContractAbi.json"));
const rpcUrl = "https://nd-499-825-018.p2pify.com/5d8bab30e1462f48144c36f18d2ee958";
const web3 = new web3_1.default(rpcUrl);
console.log("Web3 instance created.");
const stakingContractAddress = "0x2bE7904c81dd3535f31B2C7B524a6ed91FDb37EC";
const stakingContract = new web3.eth.Contract(stakingContractAbi_json_1.default, stakingContractAddress);
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
            console.log("Logs fetched:", logs);
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
(() => __awaiter(void 0, void 0, void 0, function* () {
    const stakers = yield getUniqueStakers();
    console.log("Unique staker addresses:", stakers);
}))();
