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
import { PreferFunctionTypeCheck } from '../../../src/checker/ArkTS-eslint/PreferFunctionTypeCheck';
import { CHECK_MODE, testCaseCheck } from './common/testCommon';
import path from 'path';
import { Rule } from '../../../src/Index';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('');
    checkEntry = await testCaseCheck('./test/unittest/sample/PreferFunctionType', rule, CHECK_MODE.FILE2CHECK, PreferFunctionTypeCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('PreferFunctionTypeTest', () => {
    test('PreferFunctionTypeReportCheck_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'PreferFunctionTypeReport.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })
    test('PreferFunctionTypeNoReportCheck_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'PreferFunctionTypeNoReport.ets');
        const expectReportList = ['18%7','24%7', '29%7','35%7','40%7','45%7','49%7','54%7','59%7','65%22','71%22',
                                   '75%36','80%7%','86%22','93%22','102%7','108%7','113%7','117%19','121%13','125%22',
                                   '139%7','152%17','156%18'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });
})
