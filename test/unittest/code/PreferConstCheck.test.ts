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
import { PreferConstCheck } from '../../../src/checker/ArkTS-eslint/PreferConstCheck';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('@ArkTS-eslint/prefer-const-check');
    checkEntry = await testCaseCheck('./test/unittest/sample/PreferConst', rule, CHECK_MODE.FILE2CHECK, PreferConstCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('PreferConstCheckTest', () => {

    /**
     * @tc.number: PreferConstCheckTest_001
     * @tc.name: PreferConst如果变量从未被重新分配，则使用const声明更好，不上报
     * @tc.desc: PreferConst如果变量从未被重新分配，则使用const声明更好，不上报
     */
    test('PreferConstCheckTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'PreferConstNoReport.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })

    /**
     * @tc.number: PreferConstCheckTest_002
     * @tc.name: PreferConst如果变量从未被重新分配，则使用const声明更好，上报
     * @tc.desc: PreferConst如果变量从未被重新分配，则使用const声明更好，上报
     */
    test('PreferConstCheckTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'PreferConstReport.ets');
        const expectReportList = ['16%5', '18%10', '20%10', '22%6', '24%9', '26%19', '28%24', '30%24',
            '32%20', '34%27', '36%23', '38%18', '40%36', '42%31', '44%9', '46%30', '48%23', '50%6', '52%6',
            '54%15', '54%23', '56%40', '58%35', '60%37', '62%7', '62%13', '64%25', '66%26', '66%30', '68%38',
            '70%38', '72%5', '74%5', '74%16', '76%5', '76%13', '76%27', '78%7', '78%11', '78%15', '78%36',
            '78%40', '80%5', '80%16', '80%53', '80%61', '82%5', '82%29', '82%37', '84%6', '84%10', '86%6',
            '86%10', '86%14', '88%36', '90%5', '92%33', '94%25', '96%38', '98%26', '100%44', '102%31',
            '104%28', '104%33', '106%39', '106%44', '108%43', '108%48', '110%31', '115%5', '127%19', '131%18'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number: PreferConstCheckTest_003
     * @tc.name: PreferConst如果变量从未被重新分配，则使用const声明更好，配置项options = [{destructuring: "any",ignoreReadBeforeAssign: true}];上报
     * @tc.desc: PreferConst如果变量从未被重新分配，则使用const声明更好，配置项options = [{destructuring: "any",ignoreReadBeforeAssign: true}];上报
     */
    test('PreferConstCheckTest_003', async () => {
        const rule: Rule = new Rule('@ArkTS-eslint/prefer-const-check');
        rule.option = [{ destructuring: "any", ignoreReadBeforeAssign: true }];
        checkEntry = await testCaseCheck('./test/unittest/sample/PreferConst', rule, CHECK_MODE.FILE2CHECK, PreferConstCheck);
        const detectFile: string = path.join(realPath, 'ets', 'PreferConstReport1.ets');
        const expectReportList = ['16%7', '16%15', '17%3', '22%7', '22%16', '23%3', '26%7', '26%16', '31%7', '31%16', '32%3'];
        const detectFileReport = await checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });
})