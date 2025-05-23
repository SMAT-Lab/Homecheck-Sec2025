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
import { NoImpliedEvalCheck } from '../../../src/checker/ArkTS-eslint/NoImpliedEvalCheck';
import { CHECK_MODE, testCaseCheck } from './common/testCommon';
import path from 'path';
import { Rule } from '../../../src/Index';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('');
    checkEntry = await testCaseCheck('./test/unittest/sample/NoImpliedEval', rule, CHECK_MODE.FILE2CHECK, NoImpliedEvalCheck);
    realPath = checkEntry.scene.getRealProjectDir()
})

describe('NoImpliedEvalCheckTest', () => {

    test('NoImpliedEvalNoReportTest_001', () => {
      const detectFile: string = path.join(realPath, 'ets', 'NoImpliedEvalReport.ets');
             const expectReportList = ['16%1', '17%1', '19%1', '23%1', '25%1', '26%1', '27%1', '28%1', '29%1', '30%1', 
                                        '31%1', '32%1', '33%1', '34%1', '35%1', '36%1', '45%1', '46%1', '47%1', '48%1', 
                                        '52%1', '53%1', '54%1', '55%1', '57%1', '58%1', '59%1', '60%1', '62%1', '63%1', 
                                        '64%1', '65%1', '67%1', '68%1', '69%1', '70%1', '72%1', '73%1', '74%1', '75%1', 
                                        '84%1', '85%1', '86%2', '87%2', '88%2', '89%2', '90%2', '91%1', '92%2', '93%1', 
                                        '94%2', '95%2', '96%2', '97%2', '98%2', '99%1', '100%2', '101%2', '102%2', '103%2', 
                                        '104%2', '105%2', '106%2', '107%2', '108%2', '111%1', '112%1', '113%1', '114%1', 
                                        '115%1', '116%1', '117%1', '77%1', '78%1', '79%1', '80%1'];
             const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
             assert.isDefined(detectFileReport, 'The file path is error.');
             assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
             detectFileReport?.issues.forEach((issue, index) => {
                 assert.include(issue.defect.fixKey, expectReportList[index]);
             });
    });

    test('NoImpliedEvalReportTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NoImpliedEvalNoReport.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })
})