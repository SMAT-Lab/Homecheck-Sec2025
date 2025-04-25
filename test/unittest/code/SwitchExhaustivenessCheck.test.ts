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
import { SwitchExhaustivenessCheck } from '../../../src/checker/ArkTS-eslint/SwitchExhaustivenessCheck';
import { CHECK_MODE, testCaseCheck } from './common/testCommon';
import path from 'path';
import { Rule } from '../../../src/model/Rule';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('');
    checkEntry = await testCaseCheck('./test/unittest/sample/SwitchExhaustiveness', rule, CHECK_MODE.FILE2CHECK, SwitchExhaustivenessCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('SwitchExhaustivenessTest', () => {
    /**
     * @tc.number: SwitchExhaustivenessTest_001
     * @tc.name: switch语句对于联合类型中值的判断不是详尽无遗的，上报
     * @tc.desc: switch语句对于联合类型中值的判断不是详尽无遗的，上报
     */
    test('SwitchExhaustivenessTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'SwitchExhaustivenessReport.ets');
        const expectReportList = ['27%9', '37%9', '71%9'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number: SwitchExhaustivenessTest_002
     * @tc.name: switch语句对于联合类型中值的判断是详尽无遗的，不上报
     * @tc.desc: switch语句对于联合类型中值的判断是详尽无遗的，不上报
     */
    test('SwitchExhaustivenessTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'SwitchExhaustivenessNoReport.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })
})