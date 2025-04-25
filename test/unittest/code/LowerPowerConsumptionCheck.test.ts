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

import { beforeAll, describe, expect, test } from 'vitest';
import { CHECK_MODE, testCaseCheck } from './common/testCommon';
import path from 'path';
import { LowerPowerConsumptionCheck } from '../../../src/checker/performance/LowerPowerConsumptionCheck';
import { Rule } from '../../../src/Index';
import { ALERT_LEVEL } from '../../../src/model/Rule';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const testPath = './test/unittest/sample/LowerPowerConsumption';
    const rule: Rule = new Rule('@performance/lower-power-consumption-check', ALERT_LEVEL.SUGGESTION);
    checkEntry = await testCaseCheck(testPath, rule, CHECK_MODE.FILE2CHECK, LowerPowerConsumptionCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('LowerPowerConsumptionTest', () => {

    /**
     * @tc.number: LowerPowerConsumptionTest_001
     * @tc.name: usage所在变量为局部变量，usage类型为STREAM_USAGE_UNKNOWN，需要上报
     * @tc.desc: usage所在变量为局部变量，usage类型为STREAM_USAGE_UNKNOWN，需要上报
     */
    test('LowerPowerConsumptionTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'LowerPowerConsumptionReport.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('26%5%9')));
        expect(detectFileReports?.length).toBe(1);
    });

    /**
     * @tc.number: LowerPowerConsumptionTest_002
     * @tc.name: usage所在变量为成员变量，usage类型为STREAM_USAGE_UNKNOWN，需要上报
     * @tc.desc: usage所在变量为成员变量，usage类型为STREAM_USAGE_UNKNOWN，需要上报
     */
    test('LowerPowerConsumptionTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'LowerPowerConsumptionReport2.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('26%5%9')));
        expect(detectFileReports?.length).toBe(1);
    });

    /**
     * @tc.number: LowerPowerConsumptionTest_003
     * @tc.name: usage所在变量为全局变量，usage类型为STREAM_USAGE_UNKNOWN，需要上报
     * @tc.desc: usage所在变量为全局变量，usage类型为STREAM_USAGE_UNKNOWN，需要上报
     */
    test('LowerPowerConsumptionTest_003', () => {
        const detectFile: string = path.join(realPath, 'ets', 'LowerPowerConsumptionReport3.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('25%3%7')));
        expect(detectFileReports?.length).toBe(1);
    });

    /**
     * @tc.number: LowerPowerConsumptionTest_004
     * @tc.name: usage所在变量为局部变量，usage类型为STREAM_USAGE_MUSIC，不需要上报
     * @tc.desc: usage所在变量为局部变量，usage类型为STREAM_USAGE_MUSIC，不需要上报
     */
    test('LowerPowerConsumptionTest_004', () => {
        const detectFile: string = path.join(realPath, 'ets', 'LowerPowerConsumptionNoReport.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        expect(file2Check?.issues.length).toBe(0);
    });

    /**
     * @tc.number: LowerPowerConsumptionTest_005
     * @tc.name: usage所在变量为成员变量，usage类型为STREAM_USAGE_NAVIGATION，不需要上报
     * @tc.desc: usage所在变量为成员变量，usage类型为STREAM_USAGE_NAVIGATION，不需要上报
     */
    test('LowerPowerConsumptionTest_005', () => {
        const detectFile: string = path.join(realPath, 'ets', 'LowerPowerConsumptionNoReport2.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        expect(file2Check?.issues.length).toBe(0);
    });

    /**
     * @tc.number: LowerPowerConsumptionTest_006
     * @tc.name: usage所在变量为全局变量，usage类型为STREAM_USAGE_NAVIGATION，不需要上报
     * @tc.desc: usage所在变量为全局变量，usage类型为STREAM_USAGE_NAVIGATION，不需要上报
     */
    test('LowerPowerConsumptionTest_006', () => {
        const detectFile: string = path.join(realPath, 'ets', 'LowerPowerConsumptionNoReport3.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        expect(file2Check?.issues.length).toBe(0);
    });
})