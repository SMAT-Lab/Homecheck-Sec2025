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
import { json } from 'stream/consumers';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';
import { Rule } from '../../../src/Index';
import { NoControlRegexCheck } from '../../../src/checker/ArkTS-eslint/NoControlRegexCheck';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('');
    // test\unittest\sample\NoControlRegex
    checkEntry = await testCaseCheck('./test/unittest/sample/NoControlRegex', rule, CHECK_MODE.FILE2CHECK, NoControlRegexCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('NoControlRegexTest', () => {
    /**
     * @tc.number: NoControlRegexTest_001
     * @tc.name: Regex包含控制字符，上报,ts文件
     * @tc.desc: Regex包含控制字符，上报,ts文件
     */
    test('NoControlRegexTest_001', () => {
        const detectFile: string = path.join(realPath, 'ts', 'NoControlRegexReport.ts');
        const expectReportList = ['17%16%', '18%16%', '19%16%', '20%16%', '21%16%' , '22%27%', '25%29%', '30%31%',];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });
    /**
     * @tc.number: NoControlRegexTest_004
     * @tc.name: Regex包含控制字符，上报,ets文件
     * @tc.desc: Regex包含控制字符，上报,ets文件
     */
    test('NoControlRegexTest_004', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NoControlRegexReport.ets');
        const expectReportList = ['17%16%', '18%16%', '19%16%', '20%16%', '21%16%' , '22%27%', '25%29%', '30%31%',];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
      * @tc.number: NoControlRegexTest_002
      * @tc.name: Regex不包含控制字符，不上报,ets文件
      * @tc.desc: Regex不包含控制字符，不上报,ets文件
      */
    test('NoControlRegexTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NoControlRegexNoReport.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })
    /**
     * @tc.number: NoControlRegexTest_003
     * @tc.name: Regex不包含控制字符，不上报,ts文件
     * @tc.desc: Regex不包含控制字符，不上报,ts文件
     */
    test('NoControlRegexTest_003', () => {
        const detectFile: string = path.join(realPath, 'ts', 'NoControlRegexNoReport.ts');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })
})
