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
import { UseIsNaNCheck } from '../../../src/checker/ArkTS-eslint/UseIsNaNCheck';

let realPath: string = '';
let checkEntry: CheckEntry;



beforeAll(async () => {
    let rule: Rule = new Rule("@ArkTS-eslint/use-isnan-check", ALERT_LEVEL.SUGGESTION);
    rule.option = [{
        "enforceForSwitchCase": false,
        "enforceForIndexOf": false
    }];

    checkEntry = await testCaseCheck('./test/unittest/sample/UseIsNaN', rule, CHECK_MODE.FILE2CHECK, UseIsNaNCheck);
  
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('UseIsNaNTest', () => {
    /**
     * @tc.number: UseIsNaNTest_001
     * @tc.name: 在条件语句中使用NaN进行比较,上报
     * @tc.desc: 在条件语句中使用NaN进行比较,上报
     */
    test('UseIsNaNTest_001', () => {
        const detectFile: string = path.join(realPath, 'UseIsNaNReport.ets');
        const expectReportList = ['18%9%','22%5%','26%5%','30%5%'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() == detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number: UseIsNaNTest_002
     * @tc.name: 在条件语句中使用isNaN进行比较(包括switch代码块中条件语句),并使用indexOfNaN/lastIndexOfNaN接口，不上报
     * @tc.desc: 在条件语句中使用isNaN进行比较(包括switch代码块中条件语句),并使用indexOfNaN/lastIndexOfNaN接口，不上报
     */
    test('UseIsNaNTest_002', () => {
        const detectFile: string = path.join(realPath, 'UseIsNanNoReport.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })
})