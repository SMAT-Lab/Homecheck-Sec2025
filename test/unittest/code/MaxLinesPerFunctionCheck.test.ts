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

import path from 'path';
import { assert, beforeAll, describe, test } from 'vitest';
import { MaxLinesPerFunctionCheck } from '../../../src/checker/ArkTS-eslint/MaxLinesPerFunctionCheck';
import { Rule } from '../../../src/model/Rule';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';
import { CHECK_MODE, testCaseCheck } from './common/testCommon';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('');
    rule.option = [{ max: 2, skipBlankLines: true, skipComments: true, IIFEs: true }];
    checkEntry = await testCaseCheck('./test/unittest/sample/MaxLinesPerFunctionCheck', rule, CHECK_MODE.FILE2CHECK, MaxLinesPerFunctionCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('MaxLinesPerFunctionCheckTest', () => {
    /**
     * @tc.number: MaxLinesPerFunctionCheckTest_001
     */
    test('MaxLinesPerFunctionCheckTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'MaxLinesPerFunction.ets');
        const expectReportList = ['17%1', '22%1', '28%1', '35%1', '41%1', '47%2', '51%1'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number: MaxLinesPerFunctionCheckTest_002
     */
    test('MaxLinesPerFunctionCheckTest_002', () => {
        const detectFile: string = path.join(realPath, 'ts', 'MaxLinesPerFunction.ts');
        const expectReportList = ['17%1', '22%1', '28%1', '35%1', '41%1', '47%2', '51%1'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    })
})