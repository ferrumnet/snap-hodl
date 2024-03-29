import mongoose, { Document, Schema, Types } from 'mongoose';
import { IStakingContractData, stakingContractDataSchema, ITradingVolumeContractData, tradingVolumeContractDataSchema} from './SnapHodlConfig';
import { DB_COLLECTION_SNAP_CONFIG_BALANCE } from '../config';

interface IStakingContractDataBalance extends IStakingContractData {
  totalStakedBalance: string;
}

interface ITotalTradingVolumeBalance extends ITradingVolumeContractData {
  totalTradingVolumeBalance: string;
}

interface ISnapHodlConfigBalance extends Document {
  snapHodlConfigId: mongoose.Types.ObjectId;
  snapShotConfigName: string;
  stakingContractDataBalances: IStakingContractDataBalance[];
  totalTradingVolumeBalance: Object;
  totalStakedBalance: Map<string, string>;
  totalTradingVolume: Map<string, string>;
  totalUserVolume: Map<string, string>;
  totalUserReward: Map<string, string>;
  totalVolume: string;
  createdAt: Date;
  updatedAt: Date;
}

const tradingContractDataBalanceSchema = new Schema<ITotalTradingVolumeBalance>( {
    ...tradingVolumeContractDataSchema.obj,
    totalTradingVolumeBalance: { type: String, required: true },
  }
);

const stakingContractDataBalanceSchema = new Schema<IStakingContractDataBalance>({
    ...stakingContractDataSchema.obj,
    totalStakedBalance: { type: String, required: true },
  });

const SnapHodlConfigBalanceSchema = new Schema<ISnapHodlConfigBalance>({
    snapHodlConfigId: { type: Schema.Types.ObjectId, required: true }, // Changed here
    snapShotConfigName: { type: String, required: true },
    stakingContractDataBalances: [stakingContractDataBalanceSchema],
    totalStakedBalance: { type: Map, of: String },
    totalTradingVolumeBalance: [tradingContractDataBalanceSchema],
    totalTradingVolume: { type: Map, of: String },
    totalUserVolume: { type: Map, of: String },
    totalVolume: { type: String, required: true },
    totalUserReward: { type: Map, of: String },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
    
}, { collection: DB_COLLECTION_SNAP_CONFIG_BALANCE });

const SnapHodlConfigBalanceModel = mongoose.model('SnapHodlConfigBalanceModel', SnapHodlConfigBalanceSchema);

export default SnapHodlConfigBalanceModel;
