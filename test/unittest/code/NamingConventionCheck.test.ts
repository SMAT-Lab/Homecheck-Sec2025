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
import { NamingConventionCheck } from '../../../src/checker/ArkTS-eslint/NamingConventionCheck';
import { CHECK_MODE, testCaseCheck } from './common/testCommon';
import path from 'path';
import { Rule } from '../../../src/Index';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';
import { ALERT_LEVEL } from '../../../src/model/Rule';

let realPath: string = '';
let checkEntry: CheckEntry;
let rule: Rule;

beforeAll(async () => {
    rule = new Rule('@ArkTS-eslint/naming-convention-check', ALERT_LEVEL.ERROR);
    checkEntry = await testCaseCheck('./test/unittest/sample/NamingConvention', rule, CHECK_MODE.FILE2CHECK, NamingConventionCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('NamingConventionTest', () => {
    /**
     * @tc.number: NamingConventionTest_001
     * @tc.name: 使用默认配置，上报
     * @tc.desc: 使用默认配置，上报
     */
    test('NamingConventionTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NamingConventionReport0.ets');
        const expectReportList = ['16%9', '17%9', '30%5', '31%7', '32%5', '33%7', '34%5', '20%1', '21%10', '26%17'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number: NamingConventionTest_002
     * @tc.name: 使用默认配置，不上报
     * @tc.desc: 使用默认配置，不上报
     */
    test('NamingConventionTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NamingConventionNoReport0.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })

    /**
     * @tc.number: NamingConventionTest_003
     * @tc.name: requireStringLiterals 配置参数为 true，上报
     * @tc.desc: requireStringLiterals 配置参数为 true，上报
     */
    test('NamingConventionTest_003', async () => {
        rule.option = [
      {
        "selector": "variable",
        "modifiers": [
          "const"
        ],
        "format": [
          "UPPER_CASE"
        ],
        "prefix": [
          "ANY_"
        ]
      },
      {
        "selector": "variable",
        "types": [
          "string"
        ],
        "format": [
          "camelCase"
        ],
        "prefix": [
          "string_"
        ]
      },
      {
        "selector": "variable",
        "types": [
          "number"
        ],
        "format": [
          "camelCase"
        ],
        "prefix": [
          "number_"
        ]
      },
      {
        "selector": "variable",
        "types": [
          "boolean"
        ],
        "format": [
          "camelCase"
        ],
        "prefix": [
          "boolean_"
        ]
      }]
        checkEntry = await testCaseCheck('./test/unittest/sample/NamingConvention', rule, CHECK_MODE.FILE2CHECK, NamingConventionCheck);
        realPath = checkEntry.scene.getRealProjectDir();
        const detectFile: string = path.join(realPath, 'ets', 'NamingConventionReport1.ets');
        const expectReportList = ['20%15', '26%15', '32%15', '16%15', '17%15', '18%15', '21%15', '23%15', '24%15', '27%15', '28%15', '29%15', '30%15', '33%15', '34%15', '35%15', '36%15', '37%15'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    })

    /**
     * @tc.number: NamingConventionTest_004
     * @tc.name: requireStringLiterals 配置参数为 true，不上报
     * @tc.desc: requireStringLiterals 配置参数为 true，不上报
     */
    test('NamingConventionTest_004', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NamingConventionNoReport1.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })
})