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
import { NoDuplicateImportsCheck } from '../../../src/checker/ArkTS-eslint/NoDuplicateImportsCheck';
import { CHECK_MODE, testCaseCheck } from './common/testCommon';
import path from 'path';
import { Rule } from '../../../src/Index';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
})

describe('NoDuplicateImportsTest', () => {
    /**
     * @tc.number: NoDuplicateImportsNoReportTest_001
     * @tc.name: NoDuplicateImportsNoReportTest
     * @tc.desc: NoDuplicateImportsNoReportTest
     */
    test('NoDuplicateImportsNoReportTest_001', async () => {
        const rule: Rule = new Rule('');
        checkEntry = await testCaseCheck('./test/unittest/sample/NoDuplicateImports', rule, CHECK_MODE.FILE2CHECK, NoDuplicateImportsCheck);
        realPath = checkEntry.scene.getRealProjectDir()
        const detectFile: string = path.join(realPath, 'ets', 'NoDuplicateImportsNoReport.ets');
        const expectReportList = ['57%1', '59%1', '63%1', '65%1', '67%1', '69%1', '71%1', '72%1', '75%1'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });
    test('NoDuplicateImportsNoReportTest_002', async () => {
        const rule: Rule = new Rule('');
        rule.option = [{ 'includeExports': true }]
        checkEntry = await testCaseCheck('./test/unittest/sample/NoDuplicateImports', rule, CHECK_MODE.FILE2CHECK, NoDuplicateImportsCheck);
        realPath = checkEntry.scene.getRealProjectDir()
        const detectFile: string = path.join(realPath, 'ets', 'NoDuplicateImportsNoReport.ets');
        const expectReportList = ['31%1', '57%1', '59%1', '62%1', '63%1', '63%1', '65%1', '67%1', '69%1', '71%1', '72%1', '75%1', '78%1', '80%1', '81%1',
            '81%1', '83%1', '85%1', '87%1', '89%1'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });
    /**
     * @tc.number: NoDuplicateImportsReportTest_003
     * @tc.name: NoDuplicateImportsReportTest
     * @tc.desc: NoDuplicateImportsReportTest
     */
    test('NoDuplicateImportsReportTest_003', async () => {
        const rule: Rule = new Rule('');
        checkEntry = await testCaseCheck('./test/unittest/sample/NoDuplicateImports', rule, CHECK_MODE.FILE2CHECK, NoDuplicateImportsCheck);
        realPath = checkEntry.scene.getRealProjectDir();
        const detectFile: string = path.join(realPath, 'ets', 'NoDuplicateImportsReport.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })
})