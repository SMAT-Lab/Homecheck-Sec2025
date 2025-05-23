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
import { Rule } from '../../../src/Index';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';
import { PreferArrowCallbackCheck } from '../../../src/checker/ArkTS-eslint/PreferArrowCallbackCheck';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('');
    checkEntry = await testCaseCheck('./test/unittest/sample/PreferArrowCallback', rule, CHECK_MODE.FILE2CHECK, PreferArrowCallbackCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('PreferArrowCallbackTest', () => {

    /**
     * @tc.number: PreferArrowCallbackTest_001np
     * @tc.name: 没有必要将布尔值与布尔字面量进行比较，上报。
     * @tc.desc: 没有必要将布尔值与布尔字面量进行比较，上报。
     */
    test('PreferArrowCallbackTest_001', () => {
        const detectFile: string = path.join(realPath, 'ts', 'PreferArrowCallbackReport.ts');
        const expectReportList = ['16%5', '19%5', '20%5', '21%5', '22%5', '23%5', '24%5', '25%5', '26%5', '27%5', '28%5', '29%5', '31%5', '38%5', '39%5', '40%7', '41%17', '42%11', 
            '42%27', '43%5', '44%12', '45%5', '46%5', '47%5', '48%5', '49%5', '50%5', '51%5', '52%7', '53%5'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    })
    /**
     * @tc.number: PreferArrowCallbackTest_002
     * @tc.name: 没有必要将布尔值与布尔字面量进行比较，不上报。
     * @tc.desc: 没有必要将布尔值与布尔字面量进行比较，不上报。
     */
    test('PreferArrowCallbackTest_002', () => {
        const detectFile: string = path.join(realPath, 'ts', 'PreferArrowCallbackNoReport.ts');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    });
})