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

import { assert, beforeAll, expect, describe, test } from 'vitest';
import { CHECK_MODE, testCaseCheck } from './common/testCommon';
import path from 'path';
import { Rule } from '../../../src/Index';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';
import { NoUnnecessaryBooleanLiteralCompareCheck } from '../../../src/checker/ArkTS-eslint/NoUnnecessaryBooleanLiteralCompareCheck';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('');
    checkEntry = await testCaseCheck('./test/unittest/sample/NoUnnecessaryBooleanLiteralCompare', rule, CHECK_MODE.FILE2CHECK, NoUnnecessaryBooleanLiteralCompareCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('NoUnnecessaryBooleanLiteralCompareTest', () => {

    /**
     * @tc.number: NoUnnecessaryBooleanLiteralCompareTest_001
     * @tc.name: 没有必要将布尔值与布尔字面量进行比较，上报。
     * @tc.desc: 没有必要将布尔值与布尔字面量进行比较，上报。
     */
    test('NoUnnecessaryBooleanLiteralCompareTest_001', () => {
        const detectFile: string = path.join(realPath, 'ts', 'NoUnnecessaryBooleanLiteralCompareReport.ts');
        const expectReportList = ['16%5', '20%5', '24%5', '28%5', '32%7', '36%7', '39%1', '41%1', '44%5', '48%5', '52%5', '56%7', '60%7', '64%7',
            '68%5', '72%5', '75%5', '78%7', '82%5', '86%5',];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    })

    /**
     * @tc.number: NoUnnecessaryBooleanLiteralCompareTest_002
     * @tc.name: 没有必要将布尔值与布尔字面量进行比较，不上报。
     * @tc.desc: 没有必要将布尔值与布尔字面量进行比较，不上报。
     */
    test('NoUnnecessaryBooleanLiteralCompareTest_002', () => {
        const detectFile: string = path.join(realPath, 'ts', 'NoUnnecessaryBooleanLiteralCompareNoReport.ts');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    });
})