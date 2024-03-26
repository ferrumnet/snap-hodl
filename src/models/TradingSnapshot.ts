// src/SnapHodlConfig.ts

import mongoose, { Document, Schema } from "mongoose";
import { DB_COLLECTION_TRADING_SNAP_HODL_CONFIG } from "../config";

import dotenv from "dotenv";

dotenv.config();

export interface ITradingSnapshotSchema extends Document {
  _id?: number;
  chainId: string;
  liquidityPoolAddress: string;
  tokenContractAddress: string;
  latestBlockCaptured: number;
  stakingPoolName: string;
  stakingPoolType: string;
  timestamp: Date;
  uniqueTraders: any[];
  tradesVolumeBalances: any[];
}

const TradingSnapshotSchema = new Schema<ITradingSnapshotSchema>(
  {
    chainId: { type: String, required: true },
    liquidityPoolAddress: { type: String, required: true },
    tokenContractAddress: { type: String, required: true },
    latestBlockCaptured: Number,
    stakingPoolName: { type: String, required: true },
    stakingPoolType: { type: String, required: true },
    timestamp: Date,
    uniqueTraders: Array,
    tradesVolumeBalances: Object,
  },
  { collection: "tradingSnapshot" }
);

const TradingSnapHodlModel = mongoose.model<ITradingSnapshotSchema>(
  "tradingSnapshot",
  TradingSnapshotSchema
);

export default TradingSnapHodlModel;
