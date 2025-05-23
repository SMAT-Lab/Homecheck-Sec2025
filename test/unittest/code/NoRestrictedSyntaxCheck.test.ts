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
import { NoRestrictedSyntaxCheck } from '../../../src/checker/ArkTS-eslint/NoRestrictedSyntaxCheck';
import { CHECK_MODE, testCaseCheck } from './common/testCommon';
import path from 'path';
import { Rule } from '../../../src/Index';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';
import { ALERT_LEVEL } from '../../../src/model/Rule';

let realPath: string = '';
let checkEntry: CheckEntry;
let rule: Rule;

beforeAll(async () => {
    rule = new Rule('@ArkTS-eslint/no-restricted-syntax-check', ALERT_LEVEL.WARN);
    rule.option = [
        "FunctionExpression", "WithStatement", "BinaryExpression[operator='in']"
    ]
    checkEntry = await testCaseCheck('./test/unittest/sample/NoRestrictedSyntax', rule, CHECK_MODE.FILE2CHECK, NoRestrictedSyntaxCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('NoRestrictedSyntaxCheckTest', () => {
    /**
         * @tc.number: NoRestrictedSyntaxCheckTest_001
         * @tc.name: 此规则不允许指定的（即用户定义的）语法, 不上报
         * @tc.desc: 此规则不允许指定的（即用户定义的）语法, 不上报
         */
        test('NoRestrictedSyntaxCheckTest_001', () => {
            const detectFile: string = path.join(realPath, 'ets', 'NoRestrictedSyntaxNoReport.ets');
            const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
            assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
        })
    
        /**
         * @tc.number:  NoRestrictedSyntaxCheckTest_002
         * @tc.name: 此规则不允许指定的（即用户定义的）语法， 上报
         * @tc.desc: 此规则不允许指定的（即用户定义的）语法， 上报
         */
        test('NoRestrictedSyntaxCheckTest_002', async() => {
            rule.option = [
                "FunctionExpression", "WithStatement"
            ]
            checkEntry = await testCaseCheck('./test/unittest/sample/NoRestrictedSyntax', rule, CHECK_MODE.FILE2CHECK, NoRestrictedSyntaxCheck);
            realPath = checkEntry.scene.getRealProjectDir();
            const detectFile: string = path.join(realPath, 'ets', 'NoRestrictedSyntaxReport.ets');
            const expectReportList = ['16%1%', '20%20%'];
            const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
            assert.isDefined(detectFileReport, 'The file path is error.');
            assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
            detectFileReport?.issues.forEach((issue, index) => {
                assert.include(issue.defect.fixKey, expectReportList[index]);
            });
        });
    
        /**
         * @tc.number:  NoRestrictedSyntaxCheckTest_003
         * @tc.name: 此规则不允许指定的（即用户定义的）语法， 上报
         * @tc.desc: 此规则不允许指定的（即用户定义的）语法， 上报
         */
        test('NoRestrictedSyntaxCheckTest_003', async() => {
            rule.option = [
                "TryStatement", "CallExpression", "CatchClause"
            ]
            checkEntry = await testCaseCheck('./test/unittest/sample/NoRestrictedSyntax', rule, CHECK_MODE.FILE2CHECK, NoRestrictedSyntaxCheck);
            realPath = checkEntry.scene.getRealProjectDir();
            const detectFile: string = path.join(realPath, 'ets', 'NoRestrictedSyntaxReport.ets');
            const expectReportList = ['17%5%', '24%1%', '24%7%', '24%18%', '24%30%'];
            const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
            assert.isDefined(detectFileReport, 'The file path is error.');
            assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
            detectFileReport?.issues.forEach((issue, index) => {
                assert.include(issue.defect.fixKey, expectReportList[index]);
            });
        });
})