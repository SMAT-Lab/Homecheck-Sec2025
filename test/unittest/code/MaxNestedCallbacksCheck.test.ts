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
import { Rule } from '../../../src/Index';
import { MaxNestedCallbacksCheck } from '../../../src/checker/ArkTS-eslint/MaxNestedCallbacksCheck';
import { ALERT_LEVEL } from '../../../src/model/Rule';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
})

describe('MaxNestedCallbacksCheckTest', () => {
    /**
     * @tc.number: MaxNestedCallbacksCheckTest_001
     * @tc.name: MaxNestedCallbacks可选项max最大等于0，上报
     * @tc.desc: MaxNestedCallbacks可选项max最大等于0，上报
     */
    test('MaxNestedCallbacksCheckTest_001', async () => {
        let rule: Rule = new Rule('@ArkTS-eslint/max-nested-callbacks-check', ALERT_LEVEL.ERROR);
        rule.option = [{ "max": 0 }];
        checkEntry = await testCaseCheck('./test/unittest/sample/MaxNestedCallbacks', rule, CHECK_MODE.FILE2CHECK, MaxNestedCallbacksCheck);
        realPath = checkEntry.scene.getRealProjectDir(); 
        const detectFile: string = path.join(realPath, 'ets', 'MaxNestedCallbacksCheckReport0.ets');
        const expectReportList = ['16%5','41%9','41%33'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number: MaxNestedCallbacksCheckTest_002
     * @tc.name: MaxNestedCallbacks可选项max最大等于2，上报
     * @tc.desc:MaxNestedCallbacks可选项max最大等于2，上报
     */
    test('MaxNestedCallbacksCheckTest_002', async () => {
        let rule: Rule = new Rule('@ArkTS-eslint/max-nested-callbacks-check', ALERT_LEVEL.ERROR);
        rule.option = [{ "max": 2 }];
        checkEntry = await testCaseCheck('./test/unittest/sample/MaxNestedCallbacks', rule, CHECK_MODE.FILE2CHECK, MaxNestedCallbacksCheck);
        realPath = checkEntry.scene.getRealProjectDir();
        const detectFile: string = path.join(realPath, 'ets', 'MaxNestedCallbacksCheckReport2.ets');
        const expectReportList = ['16%50','18%45','20%41','22%57','24%50','28%10','29%12','39%18','40%20','49%37','49%53','49%69',
            '49%85','49%101','49%117','49%133','49%149','49%165','49%181','49%197','49%213'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number: MaxNestedCallbacksCheckTest_003
     * @tc.name: MaxNestedCallbacks可选项max没有配置，默认最大嵌套10，嵌套11层，上报
     * @tc.desc: MaxNestedCallbacks可选项max没有配置，默认最大嵌套10，嵌套11层，上报
     */
    test('MaxNestedCallbacksCheckTest_003', async () => {
        let rule: Rule = new Rule('@ArkTS-eslint/max-nested-callbacks-check', ALERT_LEVEL.ERROR);
        checkEntry = await testCaseCheck('./test/unittest/sample/MaxNestedCallbacks', rule, CHECK_MODE.FILE2CHECK, MaxNestedCallbacksCheck);
        realPath = checkEntry.scene.getRealProjectDir(); 
        const detectFile: string = path.join(realPath, 'ets', 'MaxNestedCallbacksCheckReport11.ets');
        const expectReportList = ['16%165'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number: MaxNestedCallbacksCheckTest_004
     * @tc.name: MaxNestedCallbacks可选项max没有配置，默认最大嵌套10，嵌套10层，不上报
     * @tc.desc: MaxNestedCallbacks可选项max没有配置，默认最大嵌套10，嵌套10层，不上报
     */
    test('MaxNestedCallbacksCheckTest_004', async () => {
        let rule: Rule = new Rule('@ArkTS-eslint/max-nested-callbacks-check', ALERT_LEVEL.ERROR);
        checkEntry = await testCaseCheck('./test/unittest/sample/MaxNestedCallbacks', rule, CHECK_MODE.FILE2CHECK, MaxNestedCallbacksCheck);
        realPath = checkEntry.scene.getRealProjectDir();
        const detectFile: string = path.join(realPath, 'ets', 'MaxNestedCallbacksCheckNoReport10.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    });

    /**
     * @tc.number: MaxNestedCallbacksCheckTest_005
     * @tc.name: MaxNestedCallbacks可选项max最大等于2，不上报
     * @tc.desc: MaxNestedCallbacks可选项max最大等于2，不上报
     */
    test('MaxNestedCallbacksCheckTest_005', async () => {
        let rule: Rule = new Rule('@ArkTS-eslint/max-nested-callbacks-check', ALERT_LEVEL.ERROR);
        rule.option = [{ "max": 2 }];
        checkEntry = await testCaseCheck('./test/unittest/sample/MaxNestedCallbacks', rule, CHECK_MODE.FILE2CHECK, MaxNestedCallbacksCheck);
        realPath = checkEntry.scene.getRealProjectDir();
        const detectFile: string = path.join(realPath, 'ets', 'MaxNestedCallbacksCheckNoReport2.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    });

    /**
     * @tc.number: MaxNestedCallbacksCheckTest_006
     * @tc.name: MaxNestedCallbacks可选项max最大等于3，不上报
     * @tc.desc: MaxNestedCallbacks可选项max最大等于3，不上报
     */
    test('MaxNestedCallbacksCheckTest_006', async () => {
        let rule: Rule = new Rule('@ArkTS-eslint/max-nested-callbacks-check', ALERT_LEVEL.ERROR);
        rule.option = [{ "max": 3 }];
        checkEntry = await testCaseCheck('./test/unittest/sample/MaxNestedCallbacks', rule, CHECK_MODE.FILE2CHECK, MaxNestedCallbacksCheck);
        realPath = checkEntry.scene.getRealProjectDir();
        const detectFile: string = path.join(realPath, 'ets', 'MaxNestedCallbacksCheckNoReport3.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    });
})