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
import { BanTSLintCommentCheck } from '../../../src/checker/ArkTS-eslint/BanTSLintCommentCheck';
import { CHECK_MODE, testCaseCheck } from './common/testCommon';
import path from 'path';
import { ALERT_LEVEL } from '../../../src/model/Rule';
import { Rule } from '../../../src/Index';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';
let realPath: string = '';
let checkEntry: CheckEntry;
let rule: Rule;

beforeAll(async () => {
    rule = new Rule('@ArkTS-eslint/ban-tslint-comment-check', ALERT_LEVEL.ERROR);
    checkEntry = await testCaseCheck('./test/unittest/sample/BanTslintComment', rule, CHECK_MODE.FILE2CHECK, BanTSLintCommentCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('BanTslintCommentTest', () => {
    /**
     * @tc.number: BanTslintCommentTest_001
     * @tc.name: 不允许//tslint:<规则标志>注释，上报
     * @tc.desc: 不允许//tslint:<规则标志>注释，上报
     */
    test('BanTslintCommentTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'BanTslintCommentReport.ets');
        const expectReportList = ['37%33', '16%1', '22%3', '36%11'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number: BanTslintCommentTest_002
     * @tc.name: 不允许//tslint:<规则标志>注释，不上报
     * @tc.desc: 不允许//tslint:<规则标志>注释，不上报
     */
    test('BanTslintCommentTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'BanTslintCommentNoReport.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })
})