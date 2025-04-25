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
import { NoArrayConstructorTSCheck } from '../../../src/checker/ArkTS-eslint/NoArrayConstructorTSCheck';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('@ArkTS-eslint/no-array-constructor-check');
    checkEntry = await testCaseCheck('./test/unittest/sample/NoArrayConstructorTS', rule, CHECK_MODE.FILE2CHECK, NoArrayConstructorTSCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('NoArrayConstructorTSCheckTest', () => {
    /**
     * @tc.number: NoArrayConstructorTSCheckTest_001
     * @tc.name: NoArrayConstructorTS检查Array构造方法创建数组，上报
     * @tc.desc: NoArrayConstructorTS检查Array构造方法创建数组，上报
     */
    test('NoArrayConstructorTSCheckTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NoArrayConstructorTSReport.ets');
        const expectReportList = ['16%1','18%1','20%1','22%1','24%1','26%1','28%1','30%1','32%1'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number: NoArrayConstructorTSCheckTest_002
     * @tc.name: NoArrayConstructorTS检查Array构造方法部分创建数组，不上报
     * @tc.desc: NoArrayConstructorTS检查Array构造方法部分创建数组，不上报
     */
    test('NoArrayConstructorTSCheckTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NoArrayConstructorTSNoReport.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })
})