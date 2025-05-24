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
import { NoInferrableTypesCheck } from '../../../src/checker/ArkTS-eslint/NoInferrableTypesCheck';
import { CHECK_MODE, testCaseCheck } from './common/testCommon';
import path from 'path';
import { Rule } from '../../../src/Index';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';
import { ALERT_LEVEL } from '../../../src/model/Rule';

let realPath: string = '';
let checkEntry: CheckEntry;
let rule: Rule;

beforeAll(async () => {
    rule = new Rule('@ArkTS-eslint/no-inferrable-types-check', ALERT_LEVEL.WARN);
    rule.option = [
        {
            "ignoreParameters": false,
            "ignoreProperties": false
        }
    ]
    checkEntry = await testCaseCheck('./test/unittest/sample/NoInferrableTypes', rule, CHECK_MODE.FILE2CHECK, NoInferrableTypesCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('NoInferrableTypesCheckTest', () => {
    /**
     * @tc.number: NoInferrableTypesCheckTest_001
     * @tc.name: 无需在初始化为布尔值、数字或字符串的这些构造之一上使用显式 : 类型注释, 不上报
     * @tc.desc: 无需在初始化为布尔值、数字或字符串的这些构造之一上使用显式 : 类型注释, 不上报
     */
    test('NoInferrableTypesCheckTest_001', () => {
        const detectFile: string = path.join(realPath, 'ts', 'NoInferrableTypesNoReport.ts');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })

    /**
     * @tc.number:  NoInferrableTypesCheckTest_002
     * @tc.name: 无需在初始化为布尔值、数字或字符串的这些构造之一上使用显式 : 类型注释， 上报
     * @tc.desc: 无需在初始化为布尔值、数字或字符串的这些构造之一上使用显式 : 类型注释， 上报
     */
    test('NoInferrableTypesCheckTest_002', () => {
        const detectFile: string = path.join(realPath, 'ts', 'NoInferrableTypesReport.ts');
        const expectReportList = ['16%7%', '17%7%', '18%7%', '19%7%', '20%7%', '21%7%', '22%7%', '23%7%', '24%7%', '25%7%', '26%7%', '27%7%', '28%7%', '29%7%', '30%7%', '31%7%', '32%7%', '35%3%', '38%13%', '38%32%'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number:  NoInferrableTypesCheckTest_003
     * @tc.name: 无需在初始化为布尔值、数字或字符串的这些构造之一上使用显式 : 类型注释， 上报
     * @tc.desc: 无需在初始化为布尔值、数字或字符串的这些构造之一上使用显式 : 类型注释， 上报
     */
    test('NoInferrableTypesCheckTest_003', async() => {
        rule.option = [
            {
                "ignoreParameters": true,
                "ignoreProperties": false
            }
        ]
        checkEntry = await testCaseCheck('./test/unittest/sample/NoInferrableTypes', rule, CHECK_MODE.FILE2CHECK, NoInferrableTypesCheck);
        realPath = checkEntry.scene.getRealProjectDir();
        const detectFile: string = path.join(realPath, 'ts', 'NoInferrableTypesReport.ts');
        const expectReportList = ['16%7%', '17%7%', '18%7%', '19%7%', '20%7%', '21%7%', '22%7%', '23%7%', '24%7%', '25%7%', '26%7%', '27%7%', '28%7%', '29%7%', '30%7%', '31%7%', '32%7%', '35%3%'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number:  NoInferrableTypesCheckTest_004
     * @tc.name: 无需在初始化为布尔值、数字或字符串的这些构造之一上使用显式 : 类型注释， 上报
     * @tc.desc: 无需在初始化为布尔值、数字或字符串的这些构造之一上使用显式 : 类型注释， 上报
     */
    test('NoInferrableTypesCheckTest_004', async() => {
        rule.option = [
            {
                "ignoreParameters": false,
                "ignoreProperties": true
            }
        ]
        checkEntry = await testCaseCheck('./test/unittest/sample/NoInferrableTypes', rule, CHECK_MODE.FILE2CHECK, NoInferrableTypesCheck);
        realPath = checkEntry.scene.getRealProjectDir();
        const detectFile: string = path.join(realPath, 'ts', 'NoInferrableTypesReport.ts');
        const expectReportList = ['16%7%', '17%7%', '18%7%', '19%7%', '20%7%', '21%7%', '22%7%', '23%7%', '24%7%', '25%7%', '26%7%', '27%7%', '28%7%', '29%7%', '30%7%', '31%7%', '32%7%', '38%13%', '38%32%'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });
})