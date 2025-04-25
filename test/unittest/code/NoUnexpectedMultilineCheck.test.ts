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
import { NoUnexpectedMultilineCheck } from '../../../src/checker/ArkTS-eslint/NoUnexpectedMultilineCheck';
import { CHECK_MODE, testCaseCheck } from './common/testCommon';
import path from 'path';
import { Rule } from '../../../src/Index';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('');
    checkEntry = await testCaseCheck('./test/unittest/sample/NoUnexpectedMultiline', rule, CHECK_MODE.FILE2CHECK, NoUnexpectedMultilineCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('NoUnexpectedMultilineCheckTest', () => {
    /**
     * @tc.number: NoUnexpectedMultilineCheckTest_001
     * @tc.name: 不允许混淆多行表达式定义正确
     * @tc.desc: 不允许混淆多行表达式定义正确
     */
    test('NoUnexpectedMultilineCheckTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NoUnexpectedMultilineNoReport.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })

    /**
     * @tc.number:  NoUnexpectedMultilineCheckTest_002
     * @tc.name: 不允许混淆多行表达式定义错误
     * @tc.desc: 不允许混淆多行表达式定义错误
     */
    test('NoUnexpectedMultilineCheckTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NoUnexpectedMultilineReport.ets');
        const expectReportList = ['17%1%'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });
})