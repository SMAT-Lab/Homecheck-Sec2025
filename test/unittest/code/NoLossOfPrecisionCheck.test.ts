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
import { NoLossOfPrecisionCheck } from '../../../src/checker/ArkTS-eslint/NoLossOfPrecisionCheck';
import { CHECK_MODE, testCaseCheck } from './common/testCommon';
import path from 'path';
import { Rule } from '../../../src/Index';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('');
    checkEntry = await testCaseCheck('./test/unittest/sample/NoLossOfPrecision', rule, CHECK_MODE.FILE2CHECK, NoLossOfPrecisionCheck);
    realPath = checkEntry.scene.getRealProjectDir()
})

describe('NoLossOfPrecisionTest', () => {
    /**
     * @tc.number: NoLossOfPrecisionNoReportTest_001
     * @tc.name: NoLossOfPrecisionNoReportTest
     * @tc.desc: NoLossOfPrecisionNoReportTest
     */
    test('NoLossOfPrecisionNoReportTest_001', () => {
      const detectFile: string = path.join(realPath, 'ets', 'NoLossOfPrecisionNoReport.ets');
             const expectReportList = ['15%11','16%11','17%11','18%11','19%11','20%11','21%11','22%11','23%12','24%12','25%12','26%11','27%12','28%13',
                                       '29%12','30%11','31%11','32%11','33%11','34%11','35%11','36%11','37%11','38%12','39%12','40%12','41%12','42%12',
                                       '43%12','44%12','45%12','46%11','47%12','48%11','49%12','50%12','51%12','52%12','53%12'
                                      ];
             const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
             assert.isDefined(detectFileReport, 'The file path is error.');
             assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
             detectFileReport?.issues.forEach((issue, index) => {
                 assert.include(issue.defect.fixKey, expectReportList[index]);
             });
    });

    /**
     * @tc.number: NoLossOfPrecisionReportTest_002
     * @tc.name: NoLossOfPrecisionReportTest
     * @tc.desc: NoLossOfPrecisionReportTest
     */
    test('NoLossOfPrecisionReportTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NoLossOfPrecisionReport.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })
})