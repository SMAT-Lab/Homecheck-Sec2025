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
import { NoDynamicDeleteCheck } from '../../../src/checker/ArkTS-eslint/NoDynamicDeleteCheck';
import { CHECK_MODE, testCaseCheck } from './common/testCommon';
import path from 'path';
import { Rule } from '../../../src/model/Rule';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('');
    checkEntry = await testCaseCheck('./test/unittest/sample/NoDynamicDelete', rule, CHECK_MODE.FILE2CHECK, NoDynamicDeleteCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('NoDynamicDeleteCheckTest', () => {
    /**
     * @tc.number: NoDynamicDeleteCheckTest_001
     * @tc.name: 在computed key表达式上使用“delete”运算符，上报
     * @tc.desc: 在computed key表达式上使用“delete”运算符，上报
     */
    test('NoDynamicDeleteCheckTest_001', () => {
        const detectFile: string = path.join(realPath, 'ts', 'NoDynamicDeleteReport.ts');
        const expectReportList = ['20%18', '21%18', '25%18', '26%18', '33%18', '35%18', '41%18',
            '43%18', '45%18', '50%18', '53%18', '56%18'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number: NoDynamicDeleteCheckTest_002
     * @tc.name: 未在computed key表达式上使用“delete”运算符，不上报
     * @tc.desc: 未在computed key表达式上使用“delete”运算符，不上报
     */
    test('NoDynamicDeleteCheckTest_002', () => {
        const detectFile: string = path.join(realPath, 'ts', 'NoDynamicDeleteNoReport.ts');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })
})