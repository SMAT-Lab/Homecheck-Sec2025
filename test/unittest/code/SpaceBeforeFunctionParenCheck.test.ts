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
import { SpaceBeforeFunctionParenCheck } from '../../../src/checker/ArkTS-eslint/SpaceBeforeFunctionParenCheck';
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
            "anonymous": "never",
            "named": "never",
            "asyncArrow": "never"
        }
    ]
    checkEntry = await testCaseCheck('./test/unittest/sample/SpaceBeforeFunctionParen', rule, CHECK_MODE.FILE2CHECK, SpaceBeforeFunctionParenCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('SpaceBeforeFunctionParenCheckTest', () => {
    /**
         * @tc.number: SpaceBeforeFunctionParenCheckTest_001
         * @tc.name: 确保函数括号之前强制执行一致的间距, 不上报
         * @tc.desc: 确保函数括号之前强制执行一致的间距, 不上报
         */
        test('SpaceBeforeFunctionParenCheckTest_001', () => {
            const detectFile: string = path.join(realPath, 'ets', 'SpaceBeforeFunctionParenNoReport.ets');
            const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
            assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
        })
    
        /**
         * @tc.number:  SpaceBeforeFunctionParenCheckTest_002
         * @tc.name: 确保函数括号之前强制执行一致的间距， 上报
         * @tc.desc: 确保函数括号之前强制执行一致的间距， 上报
         */
        test('SpaceBeforeFunctionParenCheckTest_002', async() => {
            rule.option = [
                {
                    "anonymous": "always",
                    "named": "never",
                    "asyncArrow": "always"
                }
            ]
            checkEntry = await testCaseCheck('./test/unittest/sample/SpaceBeforeFunctionParen', rule, CHECK_MODE.FILE2CHECK, SpaceBeforeFunctionParenCheck);
            realPath = checkEntry.scene.getRealProjectDir();
            const detectFile: string = path.join(realPath, 'ets', 'SpaceBeforeFunctionParenReport.ets');
            const expectReportList = ['16%16%', '17%19%', '19%26%', '24%16%', '30%8%', '39%23%', '39%42%', '41%22%'];
            const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
            assert.isDefined(detectFileReport, 'The file path is error.');
            assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
            detectFileReport?.issues.forEach((issue, index) => {
                assert.include(issue.defect.fixKey, expectReportList[index]);
            });
        });
    
        /**
         * @tc.number:  SpaceBeforeFunctionParenCheckTest_003
         * @tc.name: 确保函数括号之前强制执行一致的间距， 上报
         * @tc.desc: 确保函数括号之前强制执行一致的间距， 上报
         */
        test('SpaceBeforeFunctionParenCheckTest_003', async() => {
            rule.option = [
                {
                    "anonymous": "alway",
                    "named": "always",
                    "asyncArrow": "never"
                }
            ]
            checkEntry = await testCaseCheck('./test/unittest/sample/SpaceBeforeFunctionParen', rule, CHECK_MODE.FILE2CHECK, SpaceBeforeFunctionParenCheck);
            realPath = checkEntry.scene.getRealProjectDir();
            const detectFile: string = path.join(realPath, 'ets', 'SpaceBeforeFunctionParenReport.ets');
            const expectReportList = ['35%16%', '36%6%'];
            const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
            assert.isDefined(detectFileReport, 'The file path is error.');
            assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
            detectFileReport?.issues.forEach((issue, index) => {
                assert.include(issue.defect.fixKey, expectReportList[index]);
            });
        });
})