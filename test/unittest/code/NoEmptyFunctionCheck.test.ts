/*
/*
 * Copyright (c) 2024 Huawei Device Co., Ltd.
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
import { NoEmptyFunctionCheck } from '../../../src/checker/ArkTS-eslint/NoEmptyFunctionCheck';
import { CHECK_MODE, testCaseCheck } from './common/testCommon';
import path from 'path';
import { Rule } from '../../../src/Index';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('');
    checkEntry = await testCaseCheck('./test/unittest/sample/NoEmptyFunctionCheck', rule, CHECK_MODE.FILE2CHECK, NoEmptyFunctionCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('NoEmptyFunctionCheckTest', () => {
    
    test('NoEmptyFunctionCheckTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NoEmptyFunctionCheckNoReport.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })

   
    test('NoEmptyFunctionCheckTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NoEmptyFunctionCheckReports.ets');
        const expectReportList = ['15%16%', '17%24%','19%20','21%17','23%26','26%19','28%20','30%9','32%10','34%13','36%18','40%17','42%9','44%10','46%13','48%18','50%16','52%17','54%20','56%25'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });
})