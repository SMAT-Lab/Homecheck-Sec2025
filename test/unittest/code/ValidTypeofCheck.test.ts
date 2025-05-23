/*
 * Copyright (c) 2025 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { assert, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { ValidTypeofCheck } from '../../../src/checker/ArkTS-eslint/ValidTypeofCheck';
import { CHECK_MODE, testCaseCheck } from './common/testCommon';
import path from 'path';
import { Rule } from '../../../src/Index';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';
import { ALERT_LEVEL } from '../../../src/model/Rule';

let realPath: string = '';
let checkEntry: CheckEntry;
let rule: Rule;

beforeAll(async () => {
    rule = new Rule('@ArkTS-eslint/valid-typeof-check', ALERT_LEVEL.ERROR);
    rule.option = [{
        "requireStringLiterals": false
    }]
    checkEntry = await testCaseCheck('./test/unittest/sample/ValidTypeof', rule, CHECK_MODE.FILE2CHECK, ValidTypeofCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('ValidTypeofTest', () => {
    /**
     * @tc.number: ValidTypeofTest_001
     * @tc.name: requireStringLiterals 配置参数为 false，上报
     * @tc.desc: requireStringLiterals 配置参数为 false，上报
     */
    test('ValidTypeofTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'ValidTypeofReport.ets');
        const expectReportList = ['23%20', '25%20', '27%20', '29%20', '32%1', '35%3', '38%24', '39%22', '54%26', '70%26', '71%11', '72%29', '74%30', '50%25'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number: ValidTypeofTest_002
     * @tc.name: requireStringLiterals 配置参数为 false，不上报
     * @tc.desc: requireStringLiterals 配置参数为 false，不上报
     */
    test('ValidTypeofTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'ValidTypeofNoReport.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })

    /**
     * @tc.number: ValidTypeofTest_003
     * @tc.name: requireStringLiterals 配置参数为 true，上报
     * @tc.desc: requireStringLiterals 配置参数为 true，上报
     */
    test('ValidTypeofTest_003', async () => {
        rule.option = [{
            "requireStringLiterals": true
        }]
        checkEntry = await testCaseCheck('./test/unittest/sample/ValidTypeof', rule, CHECK_MODE.FILE2CHECK, ValidTypeofCheck);
        realPath = checkEntry.scene.getRealProjectDir();
        const detectFile: string = path.join(realPath, 'ets', 'ValidTypeofRequireStringLiteralsTrueReport.ets');
        const expectReportList = ['23%20', '27%20', '30%20', '34%20', '37%20', '39%20', '41%20', '43%20', '45%20', '47%20', '80%16', '81%16', '59%25', '68%26', '69%25', '70%11', '71%26', '55%25'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    })

    /**
     * @tc.number: ValidTypeofTest_004
     * @tc.name: requireStringLiterals 配置参数为 true，不上报
     * @tc.desc: requireStringLiterals 配置参数为 true，不上报
     */
    test('ValidTypeofTest_004', () => {
        const detectFile: string = path.join(realPath, 'ets', 'ValidTypeofRequireStringLiteralsTrueNoReport.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })
})