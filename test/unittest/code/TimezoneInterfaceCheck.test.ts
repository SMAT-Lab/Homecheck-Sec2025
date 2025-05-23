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
import { TimezoneInterfaceCheck } from '../../../src/checker/performance/TimezoneInterfaceCheck';
import { Rule } from '../../../src/Index';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('');
    checkEntry = await testCaseCheck('./test/unittest/sample/TimezoneInterface', rule, CHECK_MODE.FILE2CHECK, TimezoneInterfaceCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('TimezoneInterfaceTest', () => {
    /**
     * @tc.number: TimezoneInterfaceTest_001
     * @tc.name: 未使用calendar.get('zone_offset')接口，不上报
     * @tc.desc: 未使用calendar.get('zone_offset')接口，不上报
     */
    test('TimezoneInterfaceTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'TimezoneNoReport1.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })

    /**
     * @tc.number: TimezoneInterfaceTest_002
     * @tc.name: 使用zone_offset且使用dst_offset，不上报
     * @tc.desc: 使用zone_offset且使用dst_offset，不上报
     */
    test('TimezoneInterfaceTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'TimezoneNoReport2.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })

    /**
     * @tc.number: TimezoneInterfaceTest_003
     * @tc.name: 未使用'zone_offset'接口，且set参数为getID()，不上报
     * @tc.desc: 未使用'zone_offset'接口，且set参数为getID()，不上报
     */
    test('TimezoneInterfaceTest_003', () => {
        const detectFile: string = path.join(realPath, 'ets', 'TimezoneNoReport3.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })

    /**
     * @tc.number: TimezoneInterfaceTest_004
     * @tc.name: 使用zone_offset接口，且未使用dst_offset接口，上报
     * @tc.desc: 使用zone_offset接口，且未使用dst_offset接口，上报
     */
    test('TimezoneInterfaceTest_004', () => {
        const detectFile: string = path.join(realPath, 'ets', 'TimezoneReport1.ets');
        const expectReportList = ['21%15%25%'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number: TimezoneInterfaceTest_005
     * @tc.name: 使用三方库接口moment().utcOffset，上报
     * @tc.desc: 使用三方库接口moment().utcOffset，上报
     */
    test('TimezoneInterfaceTest_005', () => {
        const detectFile: string = path.join(realPath, 'ets', 'TimezoneReport2.ets');
        const expectReportList = ['18%10%18', '19%10%18', '20%10%18', '21%10%18'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });
})