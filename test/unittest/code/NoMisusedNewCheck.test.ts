/*
 * Copyright (c) 2024 Huawei Device Co., Ltd.
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
import { NoMisusedNewCheck } from '../../../src/checker/ArkTS-eslint/NoMisusedNewCheck';
import { CHECK_MODE, testCaseCheck } from './common/testCommon';
import path from 'path';
import { Rule } from '../../../src/Index';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('');
    checkEntry = await testCaseCheck('./test/unittest/sample/NoMisusedNew', rule, CHECK_MODE.FILE2CHECK, NoMisusedNewCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('NoMisusedNewCheckTest', () => {

    /**
     * @tc.number: NoMisusedNewCheckTest_001
     * @tc.name: class 类中使用了 new 方法或 interface 类中使用了 constructor 方法
     * @tc.desc: class 类中使用了 new 方法或 interface 类中使用了 constructor 方法
     */
    test('NoMisusedNewCheckTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NoMisusedNewReport.ets');
        const expectReportList = ['17%3', '21%3', '22%3'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    })

    /**
     * @tc.number: NoMisusedNewCheckTest_002
     * @tc.name: class 类中使用 constructor 方法
     * @tc.desc: class 类中使用 constructor 方法
     */
    test('NoMisusedNewCheckTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NoMisusedNewNoReport.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })
})