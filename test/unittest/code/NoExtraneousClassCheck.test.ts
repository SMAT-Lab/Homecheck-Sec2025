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
import { NoExtraneousClassCheck } from '../../../src/checker/ArkTS-eslint/NoExtraneousClassCheck';
import { CHECK_MODE, testCaseCheck } from './common/testCommon';
import path from 'path';
import { Rule } from '../../../src/Index';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
})

describe('NoExtraneousClassTest', () => {
    /**
     * @tc.number: NoExtraneousClassCheckNoReportTest_001
     * @tc.name: NoExtraneousClassCheckNoReportTest
     * @tc.desc: NoExtraneousClassCheckNoReportTest
     */
    test('NoExtraneousClassCheckNoReportTest_001', async () => {
        const rule: Rule = new Rule('@ArkTS-eslint/no-extraneous-class-check');
        checkEntry = await testCaseCheck('./test/unittest/sample/NoExtraneousClass', rule, CHECK_MODE.FILE2CHECK, NoExtraneousClassCheck);
        realPath = checkEntry.scene.getRealProjectDir()
        const detectFile: string = path.join(realPath, 'ets', 'NoExtraneousClassCheckNoReport.ets');
        const expectReportList = ['31%14', '38%14', '47%7', '50%7', '54%11', '59%14'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });
    test('NoExtraneousClassCheckNoReportTest_002', async () => {
        const rule: Rule = new Rule('@ArkTS-eslint/no-extraneous-class-check');
        rule.option = [{ "allowStaticOnly": true }]
        checkEntry = await testCaseCheck('./test/unittest/sample/NoExtraneousClass', rule, CHECK_MODE.FILE2CHECK, NoExtraneousClassCheck);
        realPath = checkEntry.scene.getRealProjectDir()
        const detectFile: string = path.join(realPath, 'ets', 'NoExtraneousClassCheckNoReport.ets');
        const expectReportList = ['50%7'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });
    test('NoExtraneousClassCheckNoReportTest_003', async () => {
        const rule: Rule = new Rule('@ArkTS-eslint/no-extraneous-class-check');
        rule.option = [{ "allowEmpty": true }]
        checkEntry = await testCaseCheck('./test/unittest/sample/NoExtraneousClass', rule, CHECK_MODE.FILE2CHECK, NoExtraneousClassCheck);
        realPath = checkEntry.scene.getRealProjectDir()
        const detectFile: string = path.join(realPath, 'ets', 'NoExtraneousClassCheckNoReport.ets');
        const expectReportList = ['31%14', '38%14', '47%7', '54%11', '59%14'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => {
            return fileCheck.arkFile.getFilePath() === detectFile
        });
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });
    test('NoExtraneousClassCheckNoReportTest_004', async () => {
        const rule: Rule = new Rule('@ArkTS-eslint/no-extraneous-class-check');
        rule.option = [{ "allowWithDecorator": true }]
        checkEntry = await testCaseCheck('./test/unittest/sample/NoExtraneousClass', rule, CHECK_MODE.FILE2CHECK, NoExtraneousClassCheck);
        realPath = checkEntry.scene.getRealProjectDir()
        const detectFile: string = path.join(realPath, 'ets', 'NoExtraneousClassCheckNoReport.ets');
        const expectReportList = ['31%14', '38%14', '47%7', '50%7', '54%11', '59%14'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });
    /**
     * @tc.number: NoExtraneousClassCheckReportTest_005
     * @tc.name: NoExtraneousClassCheckReportTest
     * @tc.desc: NoExtraneousClassCheckReportTest
     */
    test('NoExtraneousClassCheckReportTest_005', async () => {
        const rule: Rule = new Rule('');
        checkEntry = await testCaseCheck('./test/unittest/sample/NoExtraneousClass', rule, CHECK_MODE.FILE2CHECK, NoExtraneousClassCheck);
        realPath = checkEntry.scene.getRealProjectDir()
        const detectFile: string = path.join(realPath, 'ets', 'NoExtraneousClassCheckReport.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })
})