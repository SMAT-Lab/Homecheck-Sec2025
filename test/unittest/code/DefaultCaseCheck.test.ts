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
import { ALERT_LEVEL,Rule } from '../../../src/model/Rule';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';
import { DefaultCaseCheck } from '../../../src/checker/ArkTS-eslint/DefaultCaseCheck';

let realPath: string = '';
let checkEntry: CheckEntry;


beforeAll(async () => {
  
    let commentRule: Rule = new Rule('@ArkTS-eslint/default-case-check', ALERT_LEVEL.SUGGESTION);
    commentRule.option = [{
        "commentPattern": "^skip\\sdefault",
    }];
    checkEntry = await testCaseCheck('./test/unittest/sample/DefaultCase', commentRule, CHECK_MODE.FILE2CHECK, DefaultCaseCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('DefaultCaseTest', () => {
    /**
     * @tc.number: DefaultCaseTest_001
     * @tc.name: 通过注释方式忽略default-case，上报
     * @tc.desc: 传入正则表达式,在switch代码块中检查最后一行注释是否匹配正则表达式，不符合，上报
     */
    test('DefaultCaseTest_001', () => {
        const detectFile: string = path.join(realPath, 'DefaultCaseReport.ets');
        const expectReportList = ['18%9%', '24%10%','32%10%'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() == detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });  

    /**
     * @tc.number: DefaultCaseTest_003
     * @tc.name: 通过注释方式忽略default-case，不上报
     * @tc.desc: 传入正则表达式,在switch代码块中检查最后一行注释是否匹配正则表达式，符合，不上报
     */
    test('DefaultCaseTest_003', () => {
        const detectFile: string = path.join(realPath, 'DefaultCaseNoReport.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })


})