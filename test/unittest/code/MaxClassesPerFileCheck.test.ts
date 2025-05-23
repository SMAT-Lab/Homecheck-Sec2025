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
import { ALERT_LEVEL, Rule } from '../../../src/model/Rule';
import { MaxClassesPerFileCheck } from '../../../src/checker/ArkTS-eslint/MaxClassesPerFileCheck';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
})

describe('MaxClassesPerFileCheckTest', () => {

    /**
     * @tc.number: MaxClassesPerFileCheckTest_001
     * @tc.name: MaxClassesPerFileCheck可选项max等于2，上报
     * @tc.desc:MaxClassesPerFileCheck可选项max等于2，上报
     */
    test('MaxClassesPerFileCheckTest_001', async () => {
        let rule: Rule = new Rule('@ArkTS-eslint/max-classes-per-file-check', ALERT_LEVEL.ERROR);
        rule.option = [{ "max": 1 }];
        checkEntry = await testCaseCheck('./test/unittest/sample/MaxClassesPerFile', rule, CHECK_MODE.FILE2CHECK, MaxClassesPerFileCheck);
        realPath = checkEntry.scene.getRealProjectDir();
        const detectFile: string = path.join(realPath, 'ets', 'MaxClassesPerFileReport.ets');
        const expectReportList = ['16%1'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number: MaxClassesPerFileCheckTest_002
     * @tc.name: MaxClassesPerFileCheck不传选项max，默认等于1，不上报
     * @tc.desc: MaxClassesPerFileCheck不传选项max，默认等于1，不上报
     */
    test('MaxClassesPerFileCheckTest_002', async () => {
        let rule: Rule = new Rule('@ArkTS-eslint/max-classes-per-file-check', ALERT_LEVEL.ERROR);
        checkEntry = await testCaseCheck('./test/unittest/sample/MaxClassesPerFile', rule, CHECK_MODE.FILE2CHECK, MaxClassesPerFileCheck);
        realPath = checkEntry.scene.getRealProjectDir();
        const detectFile: string = path.join(realPath, 'ets', 'MaxClassesPerFileNoReport.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    });

    /**
     * @tc.number: MaxClassesPerFileCheckTest_003
     * @tc.name: MaxClassesPerFileCheck不传选项max，默认等于1，不上报
     * @tc.desc: MaxClassesPerFileCheck不传选项max，默认等于1，不上报
     */
    test('MaxClassesPerFileCheckTest_003', async () => {
        let rule: Rule = new Rule('@ArkTS-eslint/max-classes-per-file-check', ALERT_LEVEL.ERROR);
        checkEntry = await testCaseCheck('./test/unittest/sample/MaxClassesPerFile', rule, CHECK_MODE.FILE2CHECK, MaxClassesPerFileCheck);
        realPath = checkEntry.scene.getRealProjectDir();
        const detectFile: string = path.join(realPath, 'ets', 'MaxClassesPerFileNoReport1.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    });

    /**
     * @tc.number: MaxClassesPerFileCheckTest_004
     * @tc.name: MaxClassesPerFileCheck不传选项max，默认等于1，不上报
     * @tc.desc: MaxClassesPerFileCheck不传选项max，默认等于1，不上报
     */
    test('MaxClassesPerFileCheckTest_004', async () => {
        let rule: Rule = new Rule('@ArkTS-eslint/max-classes-per-file-check', ALERT_LEVEL.ERROR);
        checkEntry = await testCaseCheck('./test/unittest/sample/MaxClassesPerFile', rule, CHECK_MODE.FILE2CHECK, MaxClassesPerFileCheck);
        realPath = checkEntry.scene.getRealProjectDir();
        const detectFile: string = path.join(realPath, 'ets', 'MaxClassesPerFileNoReport2.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    });

    /**
     * @tc.number: MaxClassesPerFileCheckTest_004
     * @tc.name: MaxClassesPerFileCheck配置可选项ignoreExpressions和max参数，不上报
     * @tc.desc: MaxClassesPerFileCheck配置可选项ignoreExpressions和max参数，不上报
     */
    test('MaxClassesPerFileCheckTest_005', async () => {
        let rule: Rule = new Rule('@ArkTS-eslint/max-classes-per-file-check', ALERT_LEVEL.ERROR);
        rule.option = [{ "ignoreExpressions": true, "max": 1 }];
        checkEntry = await testCaseCheck('./test/unittest/sample/MaxClassesPerFile', rule, CHECK_MODE.FILE2CHECK, MaxClassesPerFileCheck);
        realPath = checkEntry.scene.getRealProjectDir();
        const detectFile: string = path.join(realPath, 'ets', 'MaxClassesPerFileNoReport3.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    });
})