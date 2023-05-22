// src/SnapHodlConfig.ts

import mongoose, { Document, Schema } from 'mongoose';
import { DB_COLLECTION_SNAP_HODL_CONFIG } from '../config';

import dotenv from 'dotenv';

dotenv.config();

export interface IStakingContractData {
    _id?: boolean;
    stakingPoolName: { type: string, required: boolean };
    stakingContractAddress: { type: string, match: RegExp, validate: { validator: (value: any) => boolean, message: string }, required: boolean };
    stakingPoolType: { type: string, enum: string[], required: boolean };
    tokenContractAddress: { type: string, match: RegExp, validate: { validator: (value: any) => boolean, message: string }, required: boolean };
    chainId: { type: string, required: boolean };
    fromBlock: { type: number, min: number, required: boolean };
    toBlock: { type: string | number, validate: { validator: (value: any) => boolean, message: string }, required: boolean };
    blockIterationSize: { type: number, min: number, required: boolean };
}

export interface ISnapHodlConfig extends Document {
    snapShotConfigName: { type: string, required: boolean };
    isActive: { type: boolean, required: boolean };
    stakingContractData: IStakingContractData[];
}

const ethereumAddressRegex = /^(0x)?[0-9a-f]{40}$/i;

const stakingContractDataSchema = new Schema<IStakingContractData>({
    _id: false,
    stakingPoolName: { type: String, required: true },
    stakingContractAddress: {
        type: String,
        required: true,
        validate: {
            validator: function (value: string) {
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
            validator: function (value: string) {
                return ethereumAddressRegex.test(value);
            },
            message: 'A valid EVM address is required for tokenContractAddress.'
        }
    },
    chainId: { type: String, required: true },
    fromBlock: { type: Number, min: 0, required: true },
    toBlock: {
        type: Schema.Types.Mixed,
        required: true,
        validate: {
            validator: function (value: string | number) {
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

const SnapHodlConfigSchema = new Schema<ISnapHodlConfig>({
    snapShotConfigName: { type: String, required: true },
    isActive: { type: Boolean, required: true },
    stakingContractData: [stakingContractDataSchema]
}, { collection: DB_COLLECTION_SNAP_HODL_CONFIG });

const SnapHodlConfigModel = mongoose.model<ISnapHodlConfig>('SnapHodlConfigModel', SnapHodlConfigSchema);

export default SnapHodlConfigModel;
