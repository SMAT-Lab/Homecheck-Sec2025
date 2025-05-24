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

import { assert, beforeAll, describe, test } from 'vitest';
import { SpaceInfixOpsCheck } from '../../../src/checker/ArkTS-eslint/SpaceInfixOpsCheck';
import { CHECK_MODE, testCaseCheck } from './common/testCommon';
import path from 'path';
import { Rule } from '../../../src/Index';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';
import { ALERT_LEVEL } from '../../../src/model/Rule';

let realPath: string = '';
let checkEntry: CheckEntry;
let rule: Rule;

beforeAll(async () => {
    rule = new Rule('@ArkTS-eslint/no-inferrable-types-check', ALERT_LEVEL.WARN);
    rule.option = [
        {
            "int32Hint": false
        }
    ]
    checkEntry = await testCaseCheck('./test/unittest/sample/SpaceInfixOps', rule, CHECK_MODE.FILE2CHECK, SpaceInfixOpsCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('SpaceInfixOpsCheckTest', () => {
    /**
     * @tc.number: SpaceInfixOpsCheckTest_001
     * @tc.name: 确保中缀运算符周围有空格, 不上报
     * @tc.desc: 确保中缀运算符周围有空格, 不上报
     */
    test('SpaceInfixOpsCheckTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'SpaceInfixOpsNoReport.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })

    /**
     * @tc.number:  SpaceInfixOpsCheckTest_002
     * @tc.name: 确保中缀运算符周围有空格， 上报
     * @tc.desc: 确保中缀运算符周围有空格， 上报
     */
    test('SpaceInfixOpsCheckTest_002', async() => {
        rule.option = [
            {
                "int32Hint": false
            }
        ]
        checkEntry = await testCaseCheck('./test/unittest/sample/SpaceInfixOps', rule, CHECK_MODE.FILE2CHECK, SpaceInfixOpsCheck);
        realPath = checkEntry.scene.getRealProjectDir();
        const detectFile: string = path.join(realPath, 'ets', 'SpaceInfixOpsReport.ets');
        const expectReportList = ['16%14%', '18%17%', '19%16%', '21%14%', '22%16%', '25%3%', '27%3%', '29%4%', '31%3%', '31%6%', '33%10%', '35%10%', '35%13%', '37%18%'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number:  SpaceInfixOpsCheckTest_003
     * @tc.name: 确保中缀运算符周围有空格， 上报
     * @tc.desc: 确保中缀运算符周围有空格， 上报
     */
    test('SpaceInfixOpsCheckTest_003', async() => {
        rule.option = [
            {
                "int32Hint": true
            }
        ]
        checkEntry = await testCaseCheck('./test/unittest/sample/SpaceInfixOps', rule, CHECK_MODE.FILE2CHECK, SpaceInfixOpsCheck);
        realPath = checkEntry.scene.getRealProjectDir();
        const detectFile: string = path.join(realPath, 'ets', 'SpaceInfixOpsReport.ets');
        const expectReportList = ['19%16%', '21%14%', '22%16%', '25%3%', '27%3%', '29%4%', '31%3%', '31%6%', '33%10%', '35%10%', '35%13%', '37%18%'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });
})