import mongoose, { Document, Schema, Types } from 'mongoose';
import { IStakingContractData, stakingContractDataSchema } from './SnapHodlConfig';
import { DB_COLLECTION_SNAP_CONFIG_BALANCE } from '../config';

interface IStakingContractDataBalance extends IStakingContractData {
    totalStakedBalance: string;
}

interface ISnapHodlConfigBalance extends Document {
    snapHodlConfigId: mongoose.Types.ObjectId;
    snapShotConfigName: string;
    stakingContractDataBalances: IStakingContractDataBalance[];
    totalStakedBalance: Map<string, string>;
    createdAt: Date;
    updatedAt: Date;
}


const stakingContractDataBalanceSchema = new Schema<IStakingContractDataBalance>({
    ...stakingContractDataSchema.obj,
    totalStakedBalance: { type: String, required: true },
});

const SnapHodlConfigBalanceSchema = new Schema<ISnapHodlConfigBalance>({
    snapHodlConfigId: { type: Schema.Types.ObjectId, required: true }, // Changed here
    snapShotConfigName: { type: String, required: true },
    stakingContractDataBalances: [stakingContractDataBalanceSchema],
    totalStakedBalance: { type: Map, of: String },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },

}, { collection: DB_COLLECTION_SNAP_CONFIG_BALANCE });

const SnapHodlConfigBalanceModel = mongoose.model('SnapHodlConfigBalanceModel', SnapHodlConfigBalanceSchema);

export default SnapHodlConfigBalanceModel;
