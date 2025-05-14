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

import { assert, beforeAll, describe, expect, test } from 'vitest';
import { CHECK_MODE, testCaseCheck } from './common/testCommon';
import path from 'path';
import { Rule } from '../../../src/Index';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';
import { AvoidCallsInUIAbilityLifecycleCheck } from '../../../src/checker/stability/AvoidCallsInUIAbilityLifecycleCheck';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('');
    checkEntry = await testCaseCheck('./test/unittest/sample/AvoidCallsInUIAbilityLifecycle', rule, CHECK_MODE.FILE2CHECK, AvoidCallsInUIAbilityLifecycleCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('AvoidCallsInUIAbilityLifecycleTest', () => {

    /**
     * @tc.number: AvoidCallsInUIAbilityLifecycleTest_001
     * @tc.name: UIAbility的生命周期中调用了@ohos.measure和@ohos.font
     * @tc.desc: UIAbility的生命周期中调用了@ohos.measure和@ohos.font
     */
    test('AvoidCallsInUIAbilityLifecycleTest_001', () => {
        // const detectFile: string = path.join(realPath, 'ets', 'AvoidCallsInUIAbilityLifecycleReport.ets');
        // const expectReportList = [
        //     '22%31%41%', '27%10%21%', '36%31%41%', '41%10%21%', '50%31%41%', '55%10%21%', '64%31%41%', '69%10%21%',
        //     '78%31%41%', '83%10%21%', '92%31%41%', '97%10%21%', '106%31%41%', '111%10%21%', '121%31%41%', '126%10%21%'
        // ];
        // const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        // assert.isDefined(detectFileReport, 'The file path is error.');
        // assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        // detectFileReport?.issues.forEach((issue, index) => {
        //     assert.include(issue.defect.fixKey, expectReportList[index]);
        // });
    });

    /**
     * @tc.number: AvoidCallsInUIAbilityLifecycleTest_002
     * @tc.name: UIAbility的生命周期中未调用@ohos.measure和@ohos.font
     * @tc.desc: UIAbility的生命周期中未调用@ohos.measure和@ohos.font
     */
    test('AvoidCallsInUIAbilityLifecycleTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'AvoidCallsInUIAbilityLifecycleNoReport.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    });
})