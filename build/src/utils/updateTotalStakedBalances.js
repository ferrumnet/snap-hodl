"use strict";
// src/utils/updateTotalStakedBalances.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateTotalStakedBalances = void 0;
const bignumber_js_1 = require("bignumber.js");
function updateTotalStakedBalances(stakedBalances, totalStakedBalances) {
    for (const key in stakedBalances) {
        const value = stakedBalances[key];
        if (totalStakedBalances[key]) {
            const existingBalance = new bignumber_js_1.BigNumber(totalStakedBalances[key]);
            const newBalance = existingBalance.plus(value);
            totalStakedBalances[key] = newBalance.toString();
        }
        else {
            totalStakedBalances[key] = value;
        }
    }
}
exports.updateTotalStakedBalances = updateTotalStakedBalances;
