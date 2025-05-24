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
import { NoLoopFuncCheck } from '../../../src/checker/ArkTS-eslint/NoLoopFuncCheck';
import { CHECK_MODE, testCaseCheck } from './common/testCommon';
import path from 'path';
import { Rule } from '../../../src/Index';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('');
    checkEntry = await testCaseCheck('./test/unittest/sample/NoLoopFunc', rule, CHECK_MODE.FILE2CHECK, NoLoopFuncCheck);
    realPath = checkEntry.scene.getRealProjectDir()
})

describe('NoLoopFuncCheckTest', () => {
    /**
     * @tc.number: NoLoopFuncCheckReportTest_001
     * @tc.name: NoLoopFuncCheckReport
     * @tc.desc: NoLoopFuncCheckReport
     */
    test('NoLoopFuncCheckReportTest_001', () => {
        const detectFile: string = path.join(realPath, 'ts', 'NoLoopFuncCheckReport.ts');
        const expectReportList = ['16%4', '22%6', '28%4', '33%4', '38%3', '43%12', '48%3', '55%4', '64%4', '70%4', '75%4', '82%4', '88%4', '95%4', '103%6', '113%6', '121%6', '128%27', '135%6', '155%4', '161%4', '171%4', '180%6']
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number: NoLoopFuncCheckNoReportTest_002
     * @tc.name: NoLoopFuncCheckNoReport
     * @tc.desc: NoLoopFuncCheckNoReport
     */
    test('NoLoopFuncCheckNoReportTest_002', () => {
        const detectFile: string = path.join(realPath, 'ts', 'NoLoopFuncCheckNoReport.ts');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    });
});