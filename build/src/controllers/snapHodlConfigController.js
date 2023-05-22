"use strict";
// src/controllers/snapHodlConfigController.ts
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
exports.getSnapShotBySnapShotIdAndAddress = exports.createSnapHodlConfig = exports.getSnapHodlConfigs = exports.retrieveSnapHodlConfigs = void 0;
const SnapHodlConfig_1 = __importDefault(require("../models/SnapHodlConfig"));
const SnapHodlConfigBalance_1 = __importDefault(require("../models/SnapHodlConfigBalance"));
function sortStakingContractData(data) {
    return data.sort((a, b) => a.stakingPoolName.localeCompare(b.stakingPoolName));
}
function toLowerCaseStakingContractData(data) {
    return data.map(item => (Object.assign(Object.assign({}, item), { stakingContractAddress: item.stakingContractAddress.toLowerCase(), tokenContractAddress: item.tokenContractAddress.toLowerCase(), stakingPoolType: item.stakingPoolType.toLowerCase() })));
}
const retrieveSnapHodlConfigs = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        return yield SnapHodlConfig_1.default.find();
    }
    catch (err) {
        if (err instanceof Error) {
            throw new Error(err.message);
        }
        else {
            throw new Error('An error occurred when attempting to fetch SnapHodlConfigs');
        }
    }
});
exports.retrieveSnapHodlConfigs = retrieveSnapHodlConfigs;
const getSnapHodlConfigs = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const snapHodlConfigs = yield (0, exports.retrieveSnapHodlConfigs)();
        res.json(snapHodlConfigs);
    }
    catch (err) {
        if (err instanceof Error) {
            res.status(500).json({ message: err.message });
        }
        else {
            res.status(500).json({ message: 'An error occurred when attempting to request SnapHodlConfigs to be retrieved' });
        }
    }
});
exports.getSnapHodlConfigs = getSnapHodlConfigs;
const createSnapHodlConfig = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { snapShotConfigName, isActive, stakingContractData } = req.body;
    // Convert stakingContractData values to lower case
    const lowerCaseStakingContractData = toLowerCaseStakingContractData(stakingContractData);
    // Sort stakingContractData by stakingPoolName for consistent comparison
    const sortedStakingContractData = sortStakingContractData(lowerCaseStakingContractData);
    // Check for duplicate stakingContractData
    const duplicateConfig = yield SnapHodlConfig_1.default.findOne({
        stakingContractData: { $eq: sortedStakingContractData },
    });
    if (duplicateConfig) {
        return res.status(400).json({
            message: `Duplicate stakingContractData detected. Please use the ${duplicateConfig.snapShotConfigName} config, which has the same stakingContractData, or change the stakingContractData for the new config.`
        });
    }
    const newSnapHodlConfig = new SnapHodlConfig_1.default({
        snapShotConfigName,
        isActive,
        stakingContractData: sortedStakingContractData,
    });
    try {
        const savedSnapHodlConfig = yield newSnapHodlConfig.save();
        res.json(savedSnapHodlConfig);
    }
    catch (err) {
        if (err instanceof Error) {
            res.status(500).json({ message: err.message });
        }
        else {
            res.status(500).json({ message: 'An error occurred' });
        }
    }
});
exports.createSnapHodlConfig = createSnapHodlConfig;
const getSnapShotBySnapShotIdAndAddress = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { snapShotId, address } = req.params;
        const { raw } = req.query;
        const snapHodlConfigBalance = yield SnapHodlConfigBalance_1.default.findOne({ snapHodlConfigId: snapShotId });
        if (!snapHodlConfigBalance) {
            return res.status(404).json({ message: 'SnapShot not found' });
        }
        const snapShotBalance = snapHodlConfigBalance.totalStakedBalance.get(address);
        if (!snapShotBalance) {
            return res.status(404).json({ message: 'Address not found in SnapShot' });
        }
        if (raw === 'true') {
            return res.send(snapShotBalance.toString());
        }
        else {
            const result = {
                snapShotConfigName: snapHodlConfigBalance.snapShotConfigName,
                address: address,
                snapShotBalance: snapShotBalance,
                updatedAt: snapHodlConfigBalance.updatedAt,
            };
            return res.json(result);
        }
    }
    catch (error) {
        if (error instanceof Error) {
            return res.status(500).json({ message: error.message });
        }
        else {
            return res.status(500).json({ message: "An unexpected error occurred." });
        }
    }
});
exports.getSnapShotBySnapShotIdAndAddress = getSnapShotBySnapShotIdAndAddress;
