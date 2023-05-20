"use strict";
// src/utils/getTokenDecimals.ts
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
exports.getTokenDecimals = void 0;
const tokenContractAbi_json_1 = __importDefault(require("../../ABI/tokenContractAbi.json"));
function getTokenDecimals(tokenContractAddress, web3) {
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
exports.getTokenDecimals = getTokenDecimals;
