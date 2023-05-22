// src/controllers/snapHodlConfigController.ts

import { Request, Response } from 'express';
import SnapHodlConfigModel from '../models/SnapHodlConfig';
import SnapHodlConfigBalanceModel from '../models/SnapHodlConfigBalance';
import { SnapHodlConfig } from '../types';

function sortStakingContractData(data: any[]) {
    return data.sort((a, b) => a.stakingPoolName.localeCompare(b.stakingPoolName));
}

function toLowerCaseStakingContractData(data: any[]) {
    return data.map(item => ({
        ...item,
        stakingContractAddress: item.stakingContractAddress.toLowerCase(),
        tokenContractAddress: item.tokenContractAddress.toLowerCase(),
        stakingPoolType: item.stakingPoolType.toLowerCase(),
    }));
}


export const retrieveSnapHodlConfigs = async (): Promise<SnapHodlConfig[]> => {
    try {
        return await SnapHodlConfigModel.find();
    } catch (err) {
        if (err instanceof Error) {
            throw new Error(err.message);
        } else {
            throw new Error('An error occurred when attempting to fetch SnapHodlConfigs');
        }
    }
};



export const getSnapHodlConfigs = async (req: Request, res: Response) => {
    try {
        const snapHodlConfigs = await retrieveSnapHodlConfigs();
        res.json(snapHodlConfigs);
    } catch (err) {
        if (err instanceof Error) {
            res.status(500).json({ message: err.message });
        } else {
            res.status(500).json({ message: 'An error occurred when attempting to request SnapHodlConfigs to be retrieved' });
        }
    }
};


export const createSnapHodlConfig = async (req: Request, res: Response) => {
    const { snapShotConfigName, isActive, stakingContractData } = req.body;

    // Convert stakingContractData values to lower case
    const lowerCaseStakingContractData = toLowerCaseStakingContractData(stakingContractData);

    // Sort stakingContractData by stakingPoolName for consistent comparison
    const sortedStakingContractData = sortStakingContractData(lowerCaseStakingContractData);

    // Check for duplicate stakingContractData
    const duplicateConfig = await SnapHodlConfigModel.findOne({
        stakingContractData: { $eq: sortedStakingContractData },
    });

    if (duplicateConfig) {
        return res.status(400).json({
            message: `Duplicate stakingContractData detected. Please use the ${duplicateConfig.snapShotConfigName} config, which has the same stakingContractData, or change the stakingContractData for the new config.`
        });
    }

    const newSnapHodlConfig = new SnapHodlConfigModel({
        snapShotConfigName,
        isActive,
        stakingContractData: sortedStakingContractData,
    });

    try {
        const savedSnapHodlConfig = await newSnapHodlConfig.save();
        res.json(savedSnapHodlConfig);
    } catch (err) {
        if (err instanceof Error) {
            res.status(500).json({ message: err.message });
        } else {
            res.status(500).json({ message: 'An error occurred' });
        }
    }
};

export const getSnapShotBySnapShotIdAndAddress = async (req: Request, res: Response) => {
    try {
        const { snapShotId, address } = req.params;
        const { raw } = req.query;

        const snapHodlConfigBalance = await SnapHodlConfigBalanceModel.findOne({ snapHodlConfigId: snapShotId });

        if (!snapHodlConfigBalance) {
            return res.status(404).json({ message: 'SnapShot not found' });
        }

        const balanceData = snapHodlConfigBalance.totalStakedBalance.get(address);

        if (!balanceData) {
            return res.status(404).json({ message: 'Address not found in SnapShot' });
        }

        if (raw === 'true') {
            return res.send(balanceData);
        } else {
            const result = {
                snapShotConfigName: snapHodlConfigBalance.snapShotConfigName,
                address: balanceData,
                updatedAt: snapHodlConfigBalance.updatedAt,
            };

            return res.json(result);
        }
    } catch (error) {
        if (error instanceof Error) {
            return res.status(500).json({ message: error.message });
        } else {
            return res.status(500).json({ message: "An unexpected error occurred." });
        }
    }
};

