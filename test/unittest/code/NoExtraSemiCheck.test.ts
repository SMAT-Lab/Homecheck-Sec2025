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
import { CheckEntry } from '../../../src/utils/common/CheckEntry';
import { Rule } from '../../../src/Index';
import { NoExtraSemiCheck } from '../../../src/checker/ArkTS-eslint/NoExtraSemiCheck';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('@ArkTS-eslint/no-extra-semi-check');
    checkEntry = await testCaseCheck('./test/unittest/sample/NoExtraSemi', rule, CHECK_MODE.FILE2CHECK, NoExtraSemiCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('NoExtraSemiCheckTest', () => {
    /**
     * @tc.number: NoExtraSemiCheckTest_001
     * @tc.name: NoExtraSemi检查多余的分号，上报
     * @tc.desc: NoExtraSemi检查多余的分号，上报
     */
    test('NoExtraSemiCheckTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NoExtraSemiReport.ets');
        const expectReportList = ['16%11', '20%2', '22%9', '24%10', '26%13', '28%13', '30%13', '32%10', '34%17', '36%10', '36%19',
            '38%6', '40%11', '42%11', '44%11', '46%16', '48%12', '50%18', '52%19', '54%13', '54%21', '54%29', '56%18', '59%26', '67%26', '67%51',
            '68%26', '77%24', '77%47', '78%24', '87%18', '87%35', '88%18', '89%24', '89%47', '90%24', '94%9', '98%4', '98%5', '98%6', '102%4', '103%2'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number: NoExtraSemiCheckTest_002
     * @tc.name: NoExtraSemi检查多余的分号，不上报
     * @tc.desc: NoExtraSemi检查多余的分号，不上报
     */
    test('NoExtraSemiCheckTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NoExtraSemiNoReport.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })
})