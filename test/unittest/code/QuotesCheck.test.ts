/*
 * Copyright (c) 2025 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the 'License');
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
import { QuotesCheck } from '../../../src/checker/ArkTS-eslint/QuotesCheck';
import { CHECK_MODE, testCaseCheck } from './common/testCommon';
import path from 'path';
import { Rule } from '../../../src/Index';
import { ALERT_LEVEL } from '../../../src/model/Rule';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('@ArkTS-eslint/quotes-check', ALERT_LEVEL.ERROR);
    checkEntry = await testCaseCheck('./test/unittest/sample/Quotes', rule, CHECK_MODE.FILE2CHECK, QuotesCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('QuotesCheckTest', () => {
    /**
     * @tc.number: QuotesCheckTest_001
     * @tc.desc: 上报 
     */
    test('QuotesCheckTest_001', () => {
        const detectFile: string = path.join(realPath, 'ts', 'QuotesReport.ts');
        const expectReportLineNum = 27;
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportLineNum, 'The number of reported line is different from the expected number of line.');
    });

    /**
     * @tc.number: QuotesCheckTest_002
     * @tc.desc: 不上报
     */
    test('QuotesCheckTest_002', () => {
        const detectFile: string = path.join(realPath, 'ts', 'QuotesNoReport.ts');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 10, 'The number of reported line should be 10.');
    });

})
