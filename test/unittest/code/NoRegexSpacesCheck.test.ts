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
import { NoRegexSpacesCheck } from '../../../src/checker/ArkTS-eslint/NoRegexSpacesCheck';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('');
    // test\unittest\sample\NoInvalidRegexp
    checkEntry = await testCaseCheck('./test/unittest/sample/NoRegexSpaces', rule, CHECK_MODE.FILE2CHECK, NoRegexSpacesCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('NoRegexSpacesTest', () => {
    /**
     * @tc.number: NoInvalidRegexpTest_001
     * @tc.name: 无效Regex，上报,ts文件
     * @tc.desc: 无效Regex，上报,ts文件
     */
    test('NoRegexSpacesTest_001', () => {
        const detectFile: string = path.join(realPath, 'ts', 'NoRegexSpacesReport.ts');
        const expectReportList = ['15%11%','16%11%','17%11%','18%11%','19%11%','20%11%','21%11%','22%11%','23%11%','24%11%','25%11%','26%11%','27%11%','28%11%','29%11%'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });
    /**
     * @tc.number: NoRegexSpacesTest_002
     * @tc.name: 有效Regex，不上报,ts文件
     * @tc.desc: 有效Regex，不上报,ts文件
     */
    test('NoRegexSpacesTest_002', () => {
        const detectFile: string = path.join(realPath, 'ts', 'NoRegexSpacesNoReport.ts');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })
})
