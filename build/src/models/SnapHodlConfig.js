"use strict";
// src/SnapHodlConfig.ts
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stakingContractDataSchema = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const config_1 = require("../config");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const ethereumAddressRegex = /^(0x)?[0-9a-f]{40}$/i;
exports.stakingContractDataSchema = new mongoose_1.Schema({
    _id: false,
    stakingPoolName: { type: String, required: true },
    stakingContractAddress: {
        type: String,
        required: true,
        validate: {
            validator: function (value) {
                return ethereumAddressRegex.test(value);
            },
            message: 'A valid EVM address is required for stakingContractAddress.'
        }
    },
    stakingPoolType: { type: String, enum: ['standard', 'open'], required: true },
    tokenContractAddress: {
        type: String,
        required: true,
        validate: {
            validator: function (value) {
                return ethereumAddressRegex.test(value);
            },
            message: 'A valid EVM address is required for tokenContractAddress.'
        }
    },
    chainId: { type: String, required: true },
    fromBlock: { type: Number, min: 0, required: true },
    toBlock: {
        type: mongoose_1.Schema.Types.Mixed,
        required: true,
        validate: {
            validator: function (value) {
                if (typeof value === 'string') {
                    return value === 'latest';
                }
                return Number.isInteger(value) && value >= 0;
            },
            message: 'Invalid value for `toBlock`. Must be a non-negative integer or "latest".'
        }
    },
    blockIterationSize: { type: Number, min: 0, required: true },
});
const SnapHodlConfigSchema = new mongoose_1.Schema({
    snapShotConfigName: { type: String, required: true },
    isActive: { type: Boolean, required: true },
    stakingContractData: [exports.stakingContractDataSchema]
}, { collection: config_1.DB_COLLECTION_SNAP_HODL_CONFIG });
const SnapHodlConfigModel = mongoose_1.default.model('SnapHodlConfigModel', SnapHodlConfigSchema);
exports.default = SnapHodlConfigModel;
