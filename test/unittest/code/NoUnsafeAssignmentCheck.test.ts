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

import path from 'path';
import { assert, beforeAll, describe, test } from 'vitest';
import { NoUnsafeAssignmentCheck } from '../../../src/checker/ArkTS-eslint/NoUnsafeAssignmentCheck';
import { Rule } from '../../../src/model/Rule';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';
import { CHECK_MODE, testCaseCheck } from './common/testCommon';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('');
    checkEntry = await testCaseCheck('./test/unittest/sample/NoUnsafeAssignmentCheck', rule, CHECK_MODE.FILE2CHECK, NoUnsafeAssignmentCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('NoUnsafeAssignmentCheckTest', () => {
    /**
     * @tc.number: NoUnsafeAssignmentCheckTest_001
     */
    test('NoUnsafeAssignmentCheckTest_001', () => {
        const detectFile: string = path.join(realPath, 'NoUnsafeAssignment.ts');
        const expectReportList = ['17%1%21%', '18%1%17%', '21%14%46%', '22%14%62%', '23%14%50%', '24%14%66%'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });
})