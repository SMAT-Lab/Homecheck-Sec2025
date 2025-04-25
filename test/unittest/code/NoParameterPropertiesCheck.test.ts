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
import { NoParameterPropertiesCheck } from '../../../src/checker/ArkTS-eslint/NoParameterPropertiesCheck';
import { CHECK_MODE, testCaseCheck } from './common/testCommon';
import path from 'path';
import { Rule } from '../../../src/Index';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('');
    checkEntry = await testCaseCheck('./test/unittest/sample/NoParameterProperties', rule, CHECK_MODE.FILE2CHECK, NoParameterPropertiesCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('NoParameterPropertiesCheckTest', () => {
    /**
     * @tc.number: NoParameterPropertiesCheckTest_001
     * @tc.name: 在类构造函数中使用参数属性
     * @tc.desc: 在类构造函数中使用参数属性
     */
    test('NoParameterPropertiesCheckTest_001', () => {
        const detectFile: string = path.join(realPath, 'ts', 'NoParameterPropertiesReport.ts');
        const expectReportList = ['18%22'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    })

    /**
     * @tc.number: NoParameterPropertiesCheckTest_002
     * @tc.name: 在类构造函数中没有使用参数属性
     * @tc.desc: 在类构造函数中没有使用参数属性
     */
    test('NoParameterPropertiesCheckTest_002', () => {
        const detectFile: string = path.join(realPath, 'ts', 'NoParameterPropertiesNoReport.ts');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })
})