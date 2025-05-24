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
import { NoExAssignCheck } from '../../../src/checker/ArkTS-eslint/NoExAssignCheck';
import path from 'path';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('');
    // test\unittest\sample\NoExAssign
    checkEntry = await testCaseCheck('./test/unittest/sample/NoExAssign', rule, CHECK_MODE.FILE2CHECK, NoExAssignCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('NoExAssignTest', () => {
    /**
     * @tc.number: NoExAssignTest_001
     * @tc.name: 不允许在 catch 子句中重新分配异常，上报,ts文件
     * @tc.desc: 不允许在 catch 子句中重新分配异常，上报,ts文件
     */
    test('NoExAssignTest_001', () => {
        const detectFile: string = path.join(realPath, 'ts', 'NoExAssignReport.ts');
        const expectReportList = ['19%3%', '21%21%', '22%22%', '23%23%', '24%28%', '25%31%',];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });
    //  /**
    //   * @tc.number: NoExAssignTest_002
    //   * @tc.name: 不允许在 catch 子句中重新分配异常,不上报,ts文件
    //   * @tc.desc: 不允许在 catch 子句中重新分配异常,不上报,ts文件
    //   */
    test('NoExAssignTest_002', () => {
        const detectFile: string = path.join(realPath, 'ts', 'NoExAssignNoReport.ts');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })
})
