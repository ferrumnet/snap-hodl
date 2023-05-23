"use strict";
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
// src/index.ts
const config_1 = require("./config");
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const mongoose_1 = __importDefault(require("mongoose"));
const cronJobs_1 = require("./cronJobs");
const snapHodlConfigController_1 = require("./controllers/snapHodlConfigController");
const cors_1 = __importDefault(require("cors"));
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use(express_1.default.json());
// Enable all CORS requests
app.use((0, cors_1.default)());
mongoose_1.default.connect(config_1.DB_CONNECTION_STRING, {
    dbName: config_1.DB_NAME
})
    .then(() => console.log('MongoDB connection established'))
    .catch(err => console.log('MongoDB connection error:', err));
(0, cronJobs_1.scheduleJobs)();
app.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    res.send('Server running');
}));
app.get('/snapHodlConfig', snapHodlConfigController_1.getSnapHodlConfigs);
app.post('/snapHodlConfig', snapHodlConfigController_1.createSnapHodlConfig);
app.get('/getSnapShotBySnapShotIdAndAddress/:snapShotId/:address', snapHodlConfigController_1.getSnapShotBySnapShotIdAndAddress);
app.get('/getSnapShotBySnapShotIdAndAddress/:snapShotId/:address/raw', snapHodlConfigController_1.getSnapShotBySnapShotIdAndAddress);
app.get('/getAllSnapShots', snapHodlConfigController_1.getAllSnapShots);
// added snapshots
app.listen(config_1.PORT, () => {
    console.log(`Server is running on ${config_1.PORT}`);
});
