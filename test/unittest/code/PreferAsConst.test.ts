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
import { CHECK_MODE, testCaseCheck } from './common/testCommon';
import path from 'path';
import { Rule } from '../../../src/Index';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';
import { PreferAsConstCheck } from '../../../src/checker/ArkTS-eslint/PreferAsConstCheck';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('');
    checkEntry = await testCaseCheck('./test/unittest/sample/PreferAsConst', rule, CHECK_MODE.FILE2CHECK, PreferAsConstCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('PreferAsConstTest', () => {
    test('PreferAsConstTest_001', () => {
        const detectFile: string = path.join(realPath, 'ts', 'PreferAsConstReport.ts');
        const expectReportList = ['15%10', '16%12', '17%27', '19%27', '20%23', '21%9', '22%10', '23%10', '24%27', '25%12', '26%12', '27%20', '28%16', '31%8', '35%8', '39%10', '43%18', '47%14'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    test('PreferAsConstTest_002', () => {
        const detectFile: string = path.join(realPath, 'ts', 'PreferAsConstNoReport.ts');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })
})