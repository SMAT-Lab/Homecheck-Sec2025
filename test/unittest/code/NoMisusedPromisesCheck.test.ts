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
import { ALERT_LEVEL, Rule } from '../../../src/model/Rule';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';
import { NoMisusedPromisesCheck } from '../../../src/checker/ArkTS-eslint/NoMisusedPromisesCheck';
import path from 'path';
let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    let rule: Rule = new Rule("@ArkTS-eslint/no-misused-promises-check", ALERT_LEVEL.ERROR,);
    rule.option = [
        {
            checksConditionals: true,
            checksSpreads: true,
            checksVoidReturn: true,
        },
    ]
    checkEntry = await testCaseCheck('./test/unittest/sample/NoMisusedPromises', rule, CHECK_MODE.FILE2CHECK, NoMisusedPromisesCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('NoMisusedPromisesTest', () => {
    /**
     * @tc.number: NoMisusedPromisesTest_001
     * @tc.name: 在不正确的位置使用Promise，上报
     * @tc.desc: 禁止条件语句、展开对象表达式中使用异步函数，并禁止预期返回void的任意位置返回异步函数，上报
     */
    test('NoMisusedPromisesTest_001', () => {
        const detectFile: string = path.join(realPath, 'NomisusedPromisesReport.ets');
        const expectReportList = ['18%5%', '22%13%', '24%8%', '28%19%', '32%13%', '48%22%'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() == detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number: NoMisusedPromisesTest_002
     * @tc.name: 在正确的位置使用Promise，不上报
     * @tc.desc: 在正确的位置使用Promise，符合规则不上报
     */
    test('NoMisusedPromisesTest_002', () => {
        const detectFile: string = path.join(realPath, 'NomisusedPromisesNoReport.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    });
})