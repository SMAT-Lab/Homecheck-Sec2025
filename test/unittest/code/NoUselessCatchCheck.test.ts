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
import { NoUselessCatchCheck } from '../../../src/checker/ArkTS-eslint/NoUselessCatchCheck';
import { CHECK_MODE, testCaseCheck } from './common/testCommon';
import path from 'path';
import { ALERT_LEVEL } from '../../../src/model/Rule';
import { Rule } from '../../../src/Index';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';

let realPath: string = '';
let checkEntry: CheckEntry;
let rule: Rule;

beforeAll(async () => {
    rule = new Rule('@ArkTS-eslint/no-useless-catch-check', ALERT_LEVEL.ERROR);
    checkEntry = await testCaseCheck('./test/unittest/sample/NoUselessCatch', rule, CHECK_MODE.FILE2CHECK, NoUselessCatchCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('NoUselessCatchTest', () => {
    /**
     * @tc.number: NoUselessCatchTest_001
     * @tc.name: 禁止使用不必要的catch捕获，上报
     * @tc.desc: 禁止使用不必要的catch捕获，上报
     */
    test('NoUselessCatchTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NoUselessCatchReport.ets');
        const expectReportList = ['24%7', '45%13', '60%3'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number: NoUselessCatchTest_002
     * @tc.name: 禁止使用不必要的catch捕获，不上报
     * @tc.desc: 禁止使用不必要的catch捕获，不上报
     */
    test('NoUselessCatchTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NoUselessCatchNoReport.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })
})