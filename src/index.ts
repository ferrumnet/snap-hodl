// src/index.ts
import { DB_CONNECTION_STRING, DB_NAME, PORT } from './config';
import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import _ from 'lodash';
import { scheduleJobs } from './cronJobs';
import { getSnapHodlConfigs, createSnapHodlConfig, getSnapShotBySnapShotIdAndAddress, getAllSnapShots, getChainTradingSnapShotsTotalBySnapHodlConfigIdAndChainId } from './controllers/snapHodlConfigController';

import cors from 'cors';

dotenv.config();
const app = express();

app.use(express.json());

// Enable all CORS requests
app.use(cors());

mongoose.connect(DB_CONNECTION_STRING as string, {
    dbName: DB_NAME as string
  })
  .then(() => console.log('MongoDB connection established'))
  .catch(err => console.log('MongoDB connection error:', err));

scheduleJobs();
// blockToBlockVolumeScheduleJobs();

app.get('/', async (req, res) => {
  res.send('Server running');
});

app.get('/snapHodlConfig', getSnapHodlConfigs);

app.post('/snapHodlConfig', createSnapHodlConfig);

app.get('/getSnapShotBySnapShotIdAndAddress/:snapShotId/:address', getSnapShotBySnapShotIdAndAddress);
app.get('/getSnapShotBySnapShotIdAndAddress/:snapShotId/:address/raw', getSnapShotBySnapShotIdAndAddress);
app.get('/getChainTradingSnapShotsTotalBySnapHodlConfigIdAndChainId', getChainTradingSnapShotsTotalBySnapHodlConfigIdAndChainId);

app.get('/getAllSnapShots', getAllSnapShots);

// added snapshots


app.listen(PORT, () => {
  console.log(`Server is running on ${PORT}`);
});
