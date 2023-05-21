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
exports.createSnapHodlConfig = exports.getSnapHodlConfigs = void 0;
const SnapHodlConfig_1 = __importDefault(require("../models/SnapHodlConfig"));
function sortStakingContractData(data) {
    return data.sort((a, b) => a.stakingPoolName.localeCompare(b.stakingPoolName));
}
function toLowerCaseStakingContractData(data) {
    return data.map(item => (Object.assign(Object.assign({}, item), { stakingContractAddress: item.stakingContractAddress.toLowerCase(), tokenContractAddress: item.tokenContractAddress.toLowerCase(), stakingPoolType: item.stakingPoolType.toLowerCase() })));
}
const getSnapHodlConfigs = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const snapHodlConfigs = yield SnapHodlConfig_1.default.find();
        res.json(snapHodlConfigs);
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
