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
import { CheckEntry } from '../../../src/utils/common/CheckEntry';
import { Rule } from '../../../src/Index';
import { CHECK_MODE, testCaseCheck } from './common/testCommon';
import { NoFallthroughCheck } from '../../../src/checker/ArkTS-eslint/NoFallthroughCheck';
import path from 'path';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('');
    // test\unittest\sample\NoExAssign
    checkEntry = await testCaseCheck('./test/unittest/sample/NoFallthrough', rule, CHECK_MODE.FILE2CHECK, NoFallthroughCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('NoFallthroughTest', () => {
    /**
     * @tc.number: NoFallthroughTest_001
     * @tc.name: 不允许在 catch 子句中重新分配异常，上报,ts文件
     * @tc.desc: 不允许在 catch 子句中重新分配异常，上报,ts文件
     */
    test('NoFallthroughTest_001', () => {
        const detectFile: string = path.join(realPath, 'ts', 'NoFallthroughReport.ts');
        const expectReportList = ['18%3%', '20%3%', '21%28%', '22%41%', '23%55%', '24%44%', '25%48%', '28%3%', '29%26%', '30%52%',
            '31%52%', '32%54%', '33%41%', '36%3%', '37%50%', '40%3%', '44%3%'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });
    //  /**
    //   * @tc.number: NoFallthroughTest_002
    //   * @tc.name: 不允许在 catch 子句中重新分配异常,不上报,ts文件
    //   * @tc.desc: 不允许在 catch 子句中重新分配异常,不上报,ts文件
    //   */
    test('NoFallthroughTest_002', () => {
        const detectFile: string = path.join(realPath, 'ts', 'NoFallthroughNoReport.ts');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })
})
