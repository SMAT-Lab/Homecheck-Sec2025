/*
 * Copyright (c) 2024 Huawei Device Co., Ltd.
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
import { ForeachArgsCheck } from '../../../src/checker/performance/ForEachArgsCheck';
import { Rule } from '../../../src/Index';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('');
    checkEntry = await testCaseCheck('./test/unittest/sample/ForeachArgs', rule, CHECK_MODE.FILE2CHECK, ForeachArgsCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('ForeachArgsTest', () => {
    /**
     * @tc.number: ForeachArgsTest_001
     * @tc.name: Foreach组件未设置keyGenerator参数，上报
     * @tc.desc: Foreach组件未设置keyGenerator参数，上报
     */
    test('ForeachArgsTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'ForeachReport.ets');
        const expectReportList = ['24%9%15%'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number: ForeachArgsTest_002
     * @tc.name: Foreach组件设置了keyGenerator参数，不上报
     * @tc.desc: Foreach组件设置了keyGenerator参数，不上报
     */
    test('ForeachArgsTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'ForeachNoReport.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })

    /**
     * @tc.number: ForeachArgsTest_003
     * @tc.name: Foreach组件嵌套Foreach组件，上报
     * @tc.desc: Foreach组件嵌套Foreach组件，上报
     */
    test('ForeachArgsTest_003', () => {
        const detectFile: string = path.join(realPath, 'ets', 'ForeachReport1.ets');
        const expectReportList = ['23%7%13%', '25%11%17%'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    })
})