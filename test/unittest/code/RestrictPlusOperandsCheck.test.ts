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
import { RestrictPlusOperandsCheck } from '../../../src/checker/ArkTS-eslint/RestrictPlusOperandsCheck';
import { CHECK_MODE, testCaseCheck } from './common/testCommon';
import path from 'path';
import { ALERT_LEVEL } from '../../../src/model/Rule';
import { Rule } from '../../../src/Index';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';
let realPath: string = '';
let checkEntry: CheckEntry;
let rule: Rule;

beforeAll(async () => {
    rule = new Rule('@ArkTS-eslint/restrict-plus-operands-check', ALERT_LEVEL.ERROR);
    checkEntry = await testCaseCheck('./test/unittest/sample/RestrictPlusOperands', rule, CHECK_MODE.FILE2CHECK, RestrictPlusOperandsCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('RestrictPlusOperandsTest', () => {
    /**
     * @tc.number: RestrictPlusOperandsTest_001
     * @tc.name: 要求两个加法操作数的类型相同，上报
     * @tc.desc: 要求两个加法操作数的类型相同，上报
     */
    test('RestrictPlusOperandsTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'RestrictPlusOperandsReport.ets');
        const expectReportList = ['19%21'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number: RestrictPlusOperandsTest_002
     * @tc.name: 要求两个加法操作数的类型相同，不上报
     * @tc.desc: 要求两个加法操作数的类型相同，不上报
     */
    test('RestrictPlusOperandsTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'RestrictPlusOperandsNoReport.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })
})