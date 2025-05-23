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
import { NoInvalidRegexpCheck } from '../../../src/checker/ArkTS-eslint/NoInvalidRegexpCheck';
import { Rule } from '../../../src/Index';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('');
    // test\unittest\sample\NoInvalidRegexp
    checkEntry = await testCaseCheck('./test/unittest/sample/NoInvalidRegexp', rule, CHECK_MODE.FILE2CHECK, NoInvalidRegexpCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('NoInvalidRegexpTest', () => {
    /**
     * @tc.number: NoInvalidRegexpTest_001
     * @tc.name: 无效Regex，上报,ts文件
     * @tc.desc: 无效Regex，上报,ts文件
     */
    test('NoInvalidRegexpTest_001', () => {
        const detectFile: string = path.join(realPath, 'ts', 'NoInvalidRegexpReport.ts');
        const expectReportList = ['16%1%', '17%1%', '18%1%', '19%1%', '20%1%', '21%1%', '22%1%', '23%1%', '24%1%', '25%1%', '26%1%', '27%1%'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });
    /**
     * @tc.number: NoInvalidRegexpTest_002
     * @tc.name: 有效Regex，不上报,ts文件
     * @tc.desc: 有效Regex，不上报,ts文件
     */
    test('NoInvalidRegexpTest_002', () => {
        const detectFile: string = path.join(realPath, 'ts', 'NoInvalidRegexpNoReport.ts');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })
})
