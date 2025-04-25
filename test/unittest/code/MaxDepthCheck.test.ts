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
import { CHECK_MODE, testCaseCheck } from './common/testCommon';
import path from 'path';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';
import { MaxDepthCheck } from '../../../src/checker/ArkTS-eslint/MaxDepthCheck';
import { ALERT_LEVEL, Rule } from '../../../src/model/Rule';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
})

describe('MaxDepthCheckTest', () => {
    /**
     * @tc.number: MaxDepthCheckTest_001
     * @tc.name: MaxDepth可选项max最大等于1，上报
     * @tc.desc: MaxDepth可选项max最大等于1，上报
     */
    test('MaxDepthCheckTest_001', async () => {
        let rule: Rule = new Rule('@ArkTS-eslint/max-depth-check', ALERT_LEVEL.ERROR);
        rule.option = [{ "max": 1 }];
        checkEntry = await testCaseCheck('./test/unittest/sample/MaxDepth', rule, CHECK_MODE.FILE2CHECK, MaxDepthCheck);
        realPath = checkEntry.scene.getRealProjectDir(); 
        const detectFile: string = path.join(realPath, 'ets', 'MaxDepthReport1.ets');
        const expectReportList = ['18%5','19%7','30%5','38%5','47%5'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number: MaxDepthCheckTest_002
     * @tc.name: MaxDepth可选项max最大等于2，上报
     * @tc.desc: MaxDepth可选项max最大等于2，上报
     */
    test('MaxDepthCheckTest_002', async () => {
        let rule: Rule = new Rule('@ArkTS-eslint/max-depth-check', ALERT_LEVEL.ERROR);
        rule.option = [{ "max": 2 }];
        checkEntry = await testCaseCheck('./test/unittest/sample/MaxDepth', rule, CHECK_MODE.FILE2CHECK, MaxDepthCheck);
        realPath = checkEntry.scene.getRealProjectDir(); 
        const detectFile: string = path.join(realPath, 'ets', 'MaxDepthReport2.ets');
        const expectReportList = ['19%7','30%9','42%9','56%13','62%13','84%7'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number: MaxDepthCheckTest_003
     * @tc.name: MaxDepth可选项max最大等于4，上报
     * @tc.desc: MaxDepth可选项max最大等于4，上报
     */
    test('MaxDepthCheckTest_003', async () => {
        let rule: Rule = new Rule('@ArkTS-eslint/max-depth-check', ALERT_LEVEL.ERROR);
        rule.option = [{ "max": 4 }];
        checkEntry = await testCaseCheck('./test/unittest/sample/MaxDepth', rule, CHECK_MODE.FILE2CHECK, MaxDepthCheck);
        realPath = checkEntry.scene.getRealProjectDir(); 
        const detectFile: string = path.join(realPath, 'ets', 'MaxDepthReport4.ets');
        const expectReportList = ['21%11','40%11'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number: MaxDepthCheckTest_004
     * @tc.name: MaxDepth可选项max最大等于2，不上报
     * @tc.desc: MaxDepth可选项max最大等于2，不上报
     */
    test('MaxDepthCheckTest_004', async () => {
        let rule: Rule = new Rule('@ArkTS-eslint/max-depth-check', ALERT_LEVEL.ERROR);
        rule.option = [{ "max": 2 }];
        checkEntry = await testCaseCheck('./test/unittest/sample/MaxDepth', rule, CHECK_MODE.FILE2CHECK, MaxDepthCheck);
        realPath = checkEntry.scene.getRealProjectDir();
        const detectFile: string = path.join(realPath, 'ets', 'MaxDepthNoReport2.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    });

    /**
     * @tc.number: MaxDepthCheckTest_005
     * @tc.name: MaxDepth可选项max最大等于3，不上报
     * @tc.desc: MaxDepth可选项max最大等于3，不上报
     */
    test('MaxDepthCheckTest_005', async () => {
        let rule: Rule = new Rule('@ArkTS-eslint/max-depth-check', ALERT_LEVEL.ERROR);
        rule.option = [{ "max": 3 }];
        checkEntry = await testCaseCheck('./test/unittest/sample/MaxDepth', rule, CHECK_MODE.FILE2CHECK, MaxDepthCheck);
        realPath = checkEntry.scene.getRealProjectDir();
        const detectFile: string = path.join(realPath, 'ets', 'MaxDepthNoReport3.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    });
})