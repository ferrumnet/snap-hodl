// src/index.ts
import { PORT } from './config';
import express from 'express';
import dotenv from 'dotenv';
import _ from 'lodash';
import { scheduleJobs } from './cronJobs';

dotenv.config();
const app = express();

scheduleJobs();

app.get('/', async (req, res) => {
  res.send('Server running');
});

app.listen(PORT, () => {
  console.log(`Server is running on ${PORT}`);
});