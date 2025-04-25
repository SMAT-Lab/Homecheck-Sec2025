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
import { EqeqeqCheck } from '../../../src/checker/ArkTS-eslint/EqeqeqCheck';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('@ArkTS-eslint/eqeqeq-check');
    checkEntry = await testCaseCheck('./test/unittest/sample/Eqeqeq', rule, CHECK_MODE.FILE2CHECK, EqeqeqCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('EqeqeqCheckTest', () => {
    /**
     * @tc.number: EqeqeqCheckTest_001
     * @tc.name: Eqeqeq检查不安全的相等运算符，上报
     * @tc.desc: Eqeqeq检查不安全的相等运算符，上报
     */
    test('EqeqeqCheckTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'EqeqeqReport.ets');
        const expectReportList = ['17%3', '19%3', '21%10', '23%10', '25%10', '27%6', '29%3', '31%9', '33%3', '35%6', '37%4', '39%5',
            '41%5', '43%3', '45%3', '47%5', '49%5', '51%10', '51%4', '53%10', '53%4', '55%3', '57%2', '59%9', '61%10', '63%9']
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number: EqeqeqCheckTest_002
     * @tc.name: Eqeqeq检查不安全的相等运算符，配置可选项(options: ["always"])，上报
     * @tc.desc: Eqeqeq检查不安全的相等运算符，配置可选项(options: ["always"])，上报
     */
    test('EqeqeqCheckTest_002', async () => {
        const rule: Rule = new Rule('@ArkTS-eslint/eqeqeq-check');
        rule.option = ['always'];
        checkEntry = await testCaseCheck('./test/unittest/sample/Eqeqeq', rule, CHECK_MODE.FILE2CHECK, EqeqeqCheck);
        realPath = checkEntry.scene.getRealProjectDir();
        const detectFile: string = path.join(realPath, 'ets', 'EqeqeqReport1.ets');
        const expectReportList = ['16%10', '18%3', '20%9', '22%3'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    })

    /**
     * @tc.number: EqeqeqCheckTest_003
     * @tc.name: Eqeqeq检查不安全的相等运算符，配置可选项(options: ["smart"])，上报
     * @tc.desc: Eqeqeq检查不安全的相等运算符，配置可选项(options: ["smart"])，上报
     */
    test('EqeqeqCheckTest_003', async () => {
        const rule: Rule = new Rule('@ArkTS-eslint/eqeqeq-check');
        rule.option = ['smart'];
        checkEntry = await testCaseCheck('./test/unittest/sample/Eqeqeq', rule, CHECK_MODE.FILE2CHECK, EqeqeqCheck);
        realPath = checkEntry.scene.getRealProjectDir();
        const detectFile: string = path.join(realPath, 'ets', 'EqeqeqReport2.ets');
        const expectReportList = ['16%6', '18%3'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    })

    /**
     * @tc.number: EqeqeqCheckTest_004
     * @tc.name: Eqeqeq检查不安全的相等运算符，配置可选项(options: ["always", { null: "never" }])，上报
     * @tc.desc: Eqeqeq检查不安全的相等运算符，配置可选项(options: ["always", { null: "never" }])，上报
     */
    test('EqeqeqCheckTest_004', async () => {
        const rule: Rule = new Rule('@ArkTS-eslint/eqeqeq-check');
        rule.option = ['always', { null: 'never' }];
        checkEntry = await testCaseCheck('./test/unittest/sample/Eqeqeq', rule, CHECK_MODE.FILE2CHECK, EqeqeqCheck);
        realPath = checkEntry.scene.getRealProjectDir();
        const detectFile: string = path.join(realPath, 'ets', 'EqeqeqReport3.ets');
        const expectReportList = ['16%6', '18%6', '20%6', '22%6'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    })

    /**
     * @tc.number: EqeqeqCheckTest_005
     * @tc.name: Eqeqeq检查不安全的相等运算符，配置可选项(options: ["allow-null"])，上报
     * @tc.desc: Eqeqeq检查不安全的相等运算符，配置可选项(options: ["allow-null"])，上报
     */
    test('EqeqeqCheckTest_005', async () => {
        const rule: Rule = new Rule('@ArkTS-eslint/eqeqeq-check');
        rule.option = ['allow-null'];
        checkEntry = await testCaseCheck('./test/unittest/sample/Eqeqeq', rule, CHECK_MODE.FILE2CHECK, EqeqeqCheck);
        realPath = checkEntry.scene.getRealProjectDir();
        const detectFile: string = path.join(realPath, 'ets', 'EqeqeqReport4.ets');
        const expectReportList = ['16%10', '18%10', '20%9', '22%3', '24%6'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    })

    /**
     * @tc.number: EqeqeqCheckTest_006
     * @tc.name: Eqeqeq检查不安全的相等运算符，不上报
     * @tc.desc: Eqeqeq检查不安全的相等运算符，不上报
     */
    test('EqeqeqCheckTest_006', async () => {
        const rule: Rule = new Rule('@ArkTS-eslint/eqeqeq-check');
        checkEntry = await testCaseCheck('./test/unittest/sample/Eqeqeq', rule, CHECK_MODE.FILE2CHECK, EqeqeqCheck);
        realPath = checkEntry.scene.getRealProjectDir();
        const detectFile: string = path.join(realPath, 'ets', 'EqeqeqNoReport.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })

    /**
     * @tc.number: EqeqeqCheckTest_007
     * @tc.name: Eqeqeq检查不安全的相等运算符，配置可选项(options: ["smart"])，不上报
     * @tc.desc: Eqeqeq检查不安全的相等运算符，配置可选项(options: ["smart"])，不上报
     */
    test('EqeqeqCheckTest_007', async () => {
        const rule: Rule = new Rule('@ArkTS-eslint/eqeqeq-check');
        rule.option = ['smart'];
        checkEntry = await testCaseCheck('./test/unittest/sample/Eqeqeq', rule, CHECK_MODE.FILE2CHECK, EqeqeqCheck);
        realPath = checkEntry.scene.getRealProjectDir();
        const detectFile: string = path.join(realPath, 'ets', 'EqeqeqNoReport1.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })

    /**
     * @tc.number: EqeqeqCheckTest_008
     * @tc.name: Eqeqeq检查不安全的相等运算符，配置可选项(options: ["always", { null: "ignore" }])，不上报
     * @tc.desc: Eqeqeq检查不安全的相等运算符，配置可选项(options: ["always", { null: "ignore" }])，不上报
     */
    test('EqeqeqCheckTest_008', async () => {
        const rule: Rule = new Rule('@ArkTS-eslint/eqeqeq-check');
        rule.option = ['always', { null: 'ignore' }];
        checkEntry = await testCaseCheck('./test/unittest/sample/Eqeqeq', rule, CHECK_MODE.FILE2CHECK, EqeqeqCheck);
        realPath = checkEntry.scene.getRealProjectDir();
        const detectFile: string = path.join(realPath, 'ets', 'EqeqeqNoReport2.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })

    /**
     * @tc.number: EqeqeqCheckTest_009
     * @tc.name: Eqeqeq检查不安全的相等运算符，配置可选项(options: ["always", { null: "always" }])，不上报
     * @tc.desc: Eqeqeq检查不安全的相等运算符，配置可选项(options: ["always", { null: "always" }])，不上报
     */
    test('EqeqeqCheckTest_009', async () => {
        const rule: Rule = new Rule('@ArkTS-eslint/eqeqeq-check');
        rule.option = ['always', { null: 'always' }];
        checkEntry = await testCaseCheck('./test/unittest/sample/Eqeqeq', rule, CHECK_MODE.FILE2CHECK, EqeqeqCheck);
        realPath = checkEntry.scene.getRealProjectDir();
        const detectFile: string = path.join(realPath, 'ets', 'EqeqeqNoReport3.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })

    /**
     * @tc.number: EqeqeqCheckTest_010
     * @tc.name: Eqeqeq检查不安全的相等运算符，配置可选项(options: ["always", { null: "never" }])，不上报
     * @tc.desc: Eqeqeq检查不安全的相等运算符，配置可选项(options: ["always", { null: "never" }])，不上报
     */
    test('EqeqeqCheckTest_010', async () => {
        const rule: Rule = new Rule('@ArkTS-eslint/eqeqeq-check');
        rule.option = ['always', { null: 'never' }];
        checkEntry = await testCaseCheck('./test/unittest/sample/Eqeqeq', rule, CHECK_MODE.FILE2CHECK, EqeqeqCheck);
        realPath = checkEntry.scene.getRealProjectDir();
        const detectFile: string = path.join(realPath, 'ets', 'EqeqeqNoReport4.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })
})