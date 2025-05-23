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
import { NoOctalCheck } from '../../../src/checker/ArkTS-eslint/NoOctalCheck';
import { Rule } from '../../../src/Index';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('');
    // test\unittest\sample\NoInvalidRegexp
    checkEntry = await testCaseCheck('./test/unittest/sample/NoOctal', rule, CHECK_MODE.FILE2CHECK, NoOctalCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('NoOctalTest', () => {
    /**
     * @tc.number: NoOctalTest_001
     * @tc.name: 不允许使用八进制文字，上报,ets文件
     * @tc.desc: 不允许使用八进制文字，上报,ets文件
     */
    test('NoOctalTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NoOctalReport.ets');
        const expectReportList = ['15%11%', '16%9%', '17%9%', '18%18%', '32%28%',];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });
    /**
     * @tc.number: NoOctalTest_002
     * @tc.name: 不允许使用八进制文字，不上报,ets文件
     * @tc.desc: 不允许使用八进制文字，不上报,ets文件
     */
    test('NoOctalTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NoOctalNoReport.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })
    /**
     * @tc.number: NoOctalTest_003
     * @tc.name: 不允许使用八进制文字，不上报,ts文件
     * @tc.desc: 不允许使用八进制文字，不上报,ts文件
     */
    test('NoOctalTest_003', () => {
        const detectFile: string = path.join(realPath, 'ts', 'NoOctalNoReport.ts');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })
    /**
     * @tc.number: NoOctalTest_004
     * @tc.name: 不允许使用八进制文字，上报,ts文件
     * @tc.desc: 不允许使用八进制文字，上报,ts文件
     */
    test('NoOctalTest_004', () => {
        const detectFile: string = path.join(realPath, 'ts', 'NoOctalReport.ts');
        const expectReportList = ['16%11%', '17%9%', '18%9%', '19%18%',];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    })
})
