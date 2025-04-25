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
import { NoConfusingVoidExpressionCheck } from '../../../src/checker/ArkTS-eslint/NoConfusingVoidExpressionCheck';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('@ArkTS-eslint/no-confusing-void-expression-check');
    checkEntry = await testCaseCheck('./test/unittest/sample/NoConfusingVoidExpression', rule, CHECK_MODE.FILE2CHECK, NoConfusingVoidExpressionCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('NoConfusingVoidExpressionCheckTest', () => {
    /**
     * @tc.number: NoExtraSemiCheckTest_001
     * @tc.name: NoConfusingVoidExpression规则可防止void类型表达式被用在误导性的位置，上报
     * @tc.desc: NoConfusingVoidExpression规则可防止void类型表达式被用在误导性的位置，上报
     */
    test('NoConfusingVoidExpressionCheckTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NoConfusingVoidExpressionReport.ets');
        const expectReportList = ['16%11', '18%11', '20%15', '22%2', '24%7', '26%6', '28%1', '30%2', '32%10',
            '34%2', '37%17', '40%7', '42%15', '44%28', '46%15', '48%28', '50%23', '52%15', '52%35', '55%10', '61%10',
            '67%10', '72%10', '77%12', '83%20', '89%16', '94%18', '99%17', '104%17', '108%26', '111%26'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number: NoConfusingVoidExpressionCheckTest_002
     * @tc.name: NoConfusingVoidExpression规则可防止void类型表达式被用在误导性的位置，不上报
     * @tc.desc: NoConfusingVoidExpression规则可防止void类型表达式被用在误导性的位置，不上报
     */
    test('NoConfusingVoidExpressionCheckTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NoConfusingVoidExpressionNoReport.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })

    /**
     * @tc.number: NoConfusingVoidExpressionCheckTest_003
     * @tc.name: NoConfusingVoidExpression规则可防止void类型表达式被用在误导性的位置，option = [{ "ignoreArrowShorthand": true }],不上报
     * @tc.desc: NoConfusingVoidExpression规则可防止void类型表达式被用在误导性的位置，option = [{ "ignoreArrowShorthand": true }],不上报
     */
    test('NoConfusingVoidExpressionCheckTest_003', async () => {
        const rule: Rule = new Rule('@ArkTS-eslint/no-confusing-void-expression-check');
        rule.option = [{ "ignoreArrowShorthand": true }];
        checkEntry = await testCaseCheck('./test/unittest/sample/NoConfusingVoidExpression', rule, CHECK_MODE.FILE2CHECK, NoConfusingVoidExpressionCheck);
        const detectFile: string = path.join(realPath, 'ets', 'NoConfusingVoidExpressionNoReport1.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })

    /**
     * @tc.number: NoConfusingVoidExpressionCheckTest_004
     * @tc.name: NoConfusingVoidExpression规则可防止void类型表达式被用在误导性的位置，option = [{ "ignoreVoidOperator": true }],不上报
     * @tc.desc: NoConfusingVoidExpression规则可防止void类型表达式被用在误导性的位置，option = [{ "ignoreVoidOperator": true }],不上报
     */
    test('NoConfusingVoidExpressionCheckTest_004', async () => {
        const rule: Rule = new Rule('@ArkTS-eslint/no-confusing-void-expression-check');
        rule.option = [{ "ignoreVoidOperator": true }];
        checkEntry = await testCaseCheck('./test/unittest/sample/NoConfusingVoidExpression', rule, CHECK_MODE.FILE2CHECK, NoConfusingVoidExpressionCheck);
        const detectFile: string = path.join(realPath, 'ets', 'NoConfusingVoidExpressionNoReport2.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })

    /**
     * @tc.number: NoConfusingVoidExpressionCheckTest_005
     * @tc.name: NoConfusingVoidExpression规则可防止void类型表达式被用在误导性的位置，option = [{ "ignoreVoidOperator": true }],上报
     * @tc.desc: NoConfusingVoidExpression规则可防止void类型表达式被用在误导性的位置，option = [{ "ignoreVoidOperator": true }],上报
     */
    test('NoConfusingVoidExpressionCheckTest_005', async () => {
        const rule: Rule = new Rule('@ArkTS-eslint/no-confusing-void-expression-check');
        rule.option = [{ "ignoreVoidOperator": true }];
        checkEntry = await testCaseCheck('./test/unittest/sample/NoConfusingVoidExpression', rule, CHECK_MODE.FILE2CHECK, NoConfusingVoidExpressionCheck);
        const detectFile: string = path.join(realPath, 'ets', 'NoConfusingVoidExpressionReport1.ets');
        const expectReportList = ['16%8','18%15','20%1','22%18','24%15','26%3'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    })
})