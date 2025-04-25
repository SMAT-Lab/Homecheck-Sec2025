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
import { NoExtraNonNullAssertionCheck } from '../../../src/checker/ArkTS-eslint/NoExtraNonNullAssertionCheck';
import { CHECK_MODE, testCaseCheck } from './common/testCommon';
import path from 'path';
import { Rule } from '../../../src/Index';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';
import { ALERT_LEVEL } from '../../../src/model/Rule';

let realPath: string = '';
let checkEntry: CheckEntry;
let rule: Rule;

beforeAll(async () => {
    rule = new Rule('@ArkTS-eslint/no-extra-non-null-assertion-check', ALERT_LEVEL.ERROR);
    checkEntry = await testCaseCheck('./test/unittest/sample/NoExtraNonNullAssertion', rule, CHECK_MODE.FILE2CHECK, NoExtraNonNullAssertionCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('NoExtraNonNullAssertionCheckTest', () => {
    /**
     * @tc.number: NoExtraNonNullAssertionCheckTest_001
     * @tc.name: 上报
     * @tc.desc: 上报
     */
    test('NoExtraNonNullAssertionTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NoExtraNonNullAssertionReport.ets');
        const expectReportList = ['17%13', '17%13', '20%23', '20%23', '24%10', '28%13', '31%23', '35%10', '39%10', '43%14', '46%11', '50%10', '54%11'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number: NoExtraNonNullAssertionCheckTest_002
     * @tc.name: 不上报
     * @tc.desc: 不上报
     */
    test('NoExtraNonNullAssertionCheckTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NoExtraNonNullAssertionNoReport.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })
})