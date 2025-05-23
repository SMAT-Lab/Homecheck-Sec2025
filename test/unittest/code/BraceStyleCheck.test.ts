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
import { BraceStyleCheck } from '../../../src/checker/ArkTS-eslint/BraceStyleCheck';
import { CHECK_MODE, testCaseCheck } from './common/testCommon';
import path from 'path';
import { ALERT_LEVEL } from '../../../src/model/Rule';
import { Rule } from '../../../src/Index';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';
let realPath: string = '';
let checkEntry: CheckEntry;
let rule: Rule;

beforeAll(async () => {
    rule = new Rule('@ArkTS-eslint/brace-style-check', ALERT_LEVEL.ERROR);
    rule.option = ["1tbs", { "allowSingleLine": false }]
    checkEntry = await testCaseCheck('./test/unittest/sample/BraceStyle', rule, CHECK_MODE.FILE2CHECK, BraceStyleCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('BraceStyleTest', () => {
    /**
     * @tc.number: BraceStyleTest_001
     * @tc.name: BraceStyle 配置参数为 1tbs , 上报
     * @tc.desc: BraceStyle 配置参数为 1tbs , 上报
     */
    test('BraceStyleTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'BraceStyleReport.ets');
        const expectReportList = ['17%1', '38%9%'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number: BraceStyleTest_002
     * @tc.name: BraceStyle 配置参数为 1tbs ，不上报
     * @tc.desc: BraceStyle 配置参数为 1tbs ，不上报
     */
    test('BraceStyleTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'BraceStyleNoReport.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })
})