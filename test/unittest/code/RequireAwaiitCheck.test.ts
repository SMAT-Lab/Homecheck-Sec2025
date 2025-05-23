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
import { RequireAwaitCheck } from '../../../src/checker/ArkTS-eslint/RequireAwaitCheck';
let realPath: string = '';
let checkEntry: CheckEntry;
beforeAll(async () => {
    const rule: Rule = new Rule('');
    checkEntry = await testCaseCheck('./test/unittest/sample/RequireAwait', rule, CHECK_MODE.FILE2CHECK, RequireAwaitCheck);
    realPath = checkEntry.scene.getRealProjectDir()
});
describe('RequireAwaitTest', () => {
    test('RequireAwaitTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'requireAwaitReport.ets');
        const expectReportList = ['15%1', '19%19', '23%45', '25%1', '30%1', '33%1', '36%13', '39%1', '48%1', '52%2'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });
    test('RequireAwaitTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'requireAwaitNoReport.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    });
});