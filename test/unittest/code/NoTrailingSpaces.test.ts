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
import { NoTrailingSpacesCheck } from '../../../src/checker/ArkTS-eslint/NoTrailingSpacesCheck';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('');
    checkEntry = await testCaseCheck('./test/unittest/sample/NoTrailingSpaces', rule, CHECK_MODE.FILE2CHECK, NoTrailingSpacesCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('NoTrailingSpacesTest', () => {

    /**
     * @tc.number: NoTrailingSpacesTest_001
     * @tc.name: 禁止尾随空格，上报。
     * @tc.desc: 禁止尾随空格，上报。
     */
    test('NoTrailingSpacesTest_001', () => {
        const detectFile: string = path.join(realPath, 'ts', 'NoTrailingSpacesReport.ts');
        const expectReportList = ['17%13', '18%38', '19%26', '20%34', '21%23', '22%3', '23%24', '25%26', '26%1', '27%8', '31%7', '36%7', '37%1', '40%7',
            '42%1', '43%1', '53%11', '55%11', '56%7', '57%11', '59%1', '61%1', '63%11', '65%11', '67%7', '68%11', '69%7', '72%1'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    })

    /**
     * @tc.number: NoTrailingSpacesTest_002
     * @tc.name: 禁止尾随空格，不上报。
     * @tc.desc: 禁止尾随空格，不上报。
     */
    test('NoTrailingSpacesTest_002', () => {
        const detectFile: string = path.join(realPath, 'ts', 'NoTrailingSpacesNoReport.ts');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    });
})