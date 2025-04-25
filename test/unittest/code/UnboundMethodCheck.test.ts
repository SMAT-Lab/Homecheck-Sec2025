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
import { UnboundMethodCheck } from '../../../src/checker/ArkTS-eslint/UnboundMethodCheck';
import { CHECK_MODE, testCaseCheck } from './common/testCommon';
import path from 'path';
import { Rule } from '../../../src/Index';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';
import { ALERT_LEVEL } from '../../../src/model/Rule';

let realPath: string = '';
let checkEntry: CheckEntry;
let rule: Rule;

beforeAll(async () => {
    rule = new Rule('@ArkTS-eslint/unbound-method-check', ALERT_LEVEL.WARN);
    rule.option = [
        {
            "ignoreStatic": false
        }
    ]
    checkEntry = await testCaseCheck('./test/unittest/sample/UnboundMethod', rule, CHECK_MODE.FILE2CHECK, UnboundMethodCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('UnboundMethodCheckTest', () => {
    /**
     * @tc.number: UnboundMethodCheckTest_001
     * @tc.name: 未绑定方式引用类方法, 不上报
     * @tc.desc: 未绑定方式引用类方法, 不上报
     */
    test('UnboundMethodCheckTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'UnboundMethodNoReport.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })

    /**
     * @tc.number:  UnboundMethodCheckTest_002
     * @tc.name: 未绑定方式引用类方法， 上报
     * @tc.desc: 未绑定方式引用类方法， 上报
     */
    test('UnboundMethodCheckTest_002', async() => {
        rule.option = [
            {
                "ignoreStatic": false
            }
        ]
        checkEntry = await testCaseCheck('./test/unittest/sample/UnboundMethod', rule, CHECK_MODE.FILE2CHECK, UnboundMethodCheck);
        realPath = checkEntry.scene.getRealProjectDir();
        const detectFile: string = path.join(realPath, 'ets', 'UnboundMethodReport.ets');
        const expectReportList = ['22%1%', '24%1%'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number:  UnboundMethodCheckTest_003
     * @tc.name: 未绑定方式引用类方法， 上报
     * @tc.desc: 未绑定方式引用类方法， 上报
     */
    test('UnboundMethodCheckTest_003', async() => {
        rule.option = [
            {
                "ignoreStatic": true
            }
        ]
        checkEntry = await testCaseCheck('./test/unittest/sample/UnboundMethod', rule, CHECK_MODE.FILE2CHECK, UnboundMethodCheck);
        realPath = checkEntry.scene.getRealProjectDir();
        const detectFile: string = path.join(realPath, 'ets', 'UnboundMethodReport.ets');
        const expectReportList = ['22%1%'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });
})