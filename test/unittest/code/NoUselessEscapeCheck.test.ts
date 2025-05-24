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

import { assert, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { NoUselessEscapeCheck } from '../../../src/checker/ArkTS-eslint/NoUselessEscapeCheck';
import { CHECK_MODE, testCaseCheck } from './common/testCommon';
import path from 'path';
import { ALERT_LEVEL } from '../../../src/model/Rule';
import { Rule } from '../../../src/Index';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';

let realPath: string = '';
let checkEntry: CheckEntry;
let rule: Rule;

beforeAll(async () => {
    rule = new Rule('@ArkTS-eslint/no-useless-escape-check', ALERT_LEVEL.ERROR);
    checkEntry = await testCaseCheck('./test/unittest/sample/NoUselessEscape', rule, CHECK_MODE.FILE2CHECK, NoUselessEscapeCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('NoUselessEscapeCheck', () => {
    /**
     * @tc.number: NoUselessEscapeCheck_001
     * @tc.name: 检查不必要的转义符，上报
     * @tc.desc: 检查不必要的转义符，上报
     */
    test('NoUselessEscapeCheck_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NoUselessEscapeReport.ets');
        const expectReportList = ['15%10', '16%11', '17%2', '26%11', '41%25', '42%25', '43%30'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number: NoUselessEscapeCheck_002
     * @tc.name: 检查不必要的转义符，不上报
     * @tc.desc: 检查不必要的转义符，不上报
     */
    test('NoUselessEscapeCheck_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NoUselessEscapeNoReport.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })
})