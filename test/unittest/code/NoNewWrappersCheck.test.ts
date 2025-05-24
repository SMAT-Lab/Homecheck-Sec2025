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
import { NoNewWrappersCheck } from '../../../src/checker/ArkTS-eslint/NoNewWrappersCheck';
import { CHECK_MODE, testCaseCheck } from './common/testCommon';
import path from 'path';
import { Rule } from '../../../src/Index';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';
import { ALERT_LEVEL } from '../../../src/model/Rule';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('@ArkTS-eslint/no-new-wrappers-check', ALERT_LEVEL.ERROR);
    checkEntry = await testCaseCheck('./test/unittest/sample/NoNewWrappers', rule, CHECK_MODE.FILE2CHECK, NoNewWrappersCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('NoNewWrappersTest', () => {
    /**
     * @tc.number: NoNewWrappersTest_001
     * @tc.name: 消除 String、Number 和 Boolean 与 new 运算符的使用，上报
     * @tc.desc: 消除 String、Number 和 Boolean 与 new 运算符的使用，上报
     */
    test('NoNewWrappersTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NoNewWrappersReport.ets');
        const expectReportList = ["20%32",'21%32','22%34','24%23','25%23','26%25'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number: NoNewWrappersTest_002
     * @tc.name: 消除 String、Number 和 Boolean 与 new 运算符的使用，不上报
     * @tc.desc: 消除 String、Number 和 Boolean 与 new 运算符的使用，不上报
     */
    test('NoNewWrappersTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NoNewWrappersNoReport.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })
    /**
     * @tc.number: NoNewWrappersTest_003
     * @tc.name: 消除 String、Number 和 Boolean 与 new 运算符的使用，上报
     * @tc.desc: 消除 String、Number 和 Boolean 与 new 运算符的使用，上报
     */
    test('NoNewWrappersTest_003', () => {
        const detectFile: string = path.join(realPath, 'ts', 'NoNewWrappersReport.ts');
        const expectReportList = ["17%28",'18%28','19%29','21%28','22%28','23%29'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number: NoNewWrappersTest_004
     * @tc.name: 消除 String、Number 和 Boolean 与 new 运算符的使用，不上报
     * @tc.desc: 消除 String、Number 和 Boolean 与 new 运算符的使用，不上报
     */
    test('NoNewWrappersTest_004', () => {
        const detectFile: string = path.join(realPath, 'ts', 'NoNewWrappersNoReport.ts');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })
})