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

import {assert, beforeAll, describe, test} from 'vitest';
import {CHECK_MODE, testCaseCheck} from './common/testCommon';
import path from 'path';
import {Rule} from '../../../src/Index';
import {CheckEntry} from '../../../src/utils/common/CheckEntry';
import {ALERT_LEVEL} from "../../../src/model/Rule";
import {PreferReadonlyCheck} from "../../../src/checker/ArkTS-eslint/PreferReadonlyCheck";

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('@ArkTS-eslint/prefer-readonly-check', ALERT_LEVEL.SUGGESTION);
    checkEntry = await testCaseCheck('./test/unittest/sample/PreferReadonly', rule, CHECK_MODE.FILE2CHECK, PreferReadonlyCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('PreferReadonlyReportTest', () => {
    test('PreferReadonlyCheckReportTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'PreferReadonlyNoReport.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })

    test('PreferReadonlyCheckNoReportTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'PreferReadonlyReport.ets');
        const expectReportList = ['22%3', '28%3', '31%3', '34%3', '40%7', '37%3', '48%7', '45%3', '53%3', 
                                  '59%3', '72%3', '83%3', '89%3', '95%3', '101%3', '107%3', '113%3', '119%3', 
                                  '125%3', '131%3', '140%30', '145%13', '149%3', '153%5', '157%3', '165%3', 
                                  '176%3', '185%3', '191%3', '199%3', '207%3', '213%3', '219%3', '225%3', 
                                  '231%3', '237%3', '243%3', '249%3', '255%3', '261%3', '267%3', '273%3', 
                                  '279%3', '285%3', '291%3', '297%3', '303%3', '310%3', '317%3', '326%3', 
                                  '328%3', '330%3', '343%3', '344%3', '345%3', '349%13'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });
})