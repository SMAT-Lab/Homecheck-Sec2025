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
import { GifHardwareDecodingCheck } from '../../../src/checker/performance/GifHardwareDecodingCheck';
import { Rule } from '../../../src/Index';
import { ALERT_LEVEL } from '../../../src/model/Rule';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const testPath = './test/unittest/sample/GifHardwareDecoding';
    const rule: Rule = new Rule('@performance/gif-hardware-decoding-check', ALERT_LEVEL.ERROR);
    checkEntry = await testCaseCheck(testPath, rule, CHECK_MODE.FILE2CHECK, GifHardwareDecodingCheck, true, true);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('GifHardwareDecodingCheckTest', () => {

    /**
     * @tc.number: GifHardwareDecodingCheckTest_001
     * @tc.name: gif-drawable库默认未开启硬解，未调用setOpenHardware设置，上报
     * @tc.desc: gif-drawable库默认未开启硬解，未调用setOpenHardware设置，上报
     */
    test('GifHardwareDecodingCheckTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'GifDrawableReport0.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile)) 
            && (issue.defect.fixKey.includes('21%10%15') || issue.defect.fixKey.includes('28%9%15')));
        expect(detectFileReports?.length).toBe(2);
    });

    /**
     * @tc.number: GifHardwareDecodingCheckTest_002
     * @tc.name: gif-drawable库默认未开启硬解，local变量调用setOpenHardware设置false，再赋值，上报
     * @tc.desc: gif-drawable库默认未开启硬解，local变量调用setOpenHardware设置false，再赋值，上报
     */
    test('GifHardwareDecodingCheckTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'GifDrawableReport1.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile)) 
            && (issue.defect.fixKey.includes('21%10%15') || issue.defect.fixKey.includes('28%9%15')));
        expect(detectFileReports?.length).toBe(2);
    })

    /**
     * @tc.number: GifHardwareDecodingCheckTest_003
     * @tc.name: gif-drawable库默认未开启硬解，调用setOpenHardware设置false，上报
     * @tc.desc: gif-drawable库默认未开启硬解，调用setOpenHardware设置false，上报
     */
    test('GifHardwareDecodingCheckTest_003', () => {
        const detectFile: string = path.join(realPath, 'ets', 'GifDrawableReport2.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile)) 
            && (issue.defect.fixKey.includes('22%10%15')));
        expect(detectFileReports?.length).toBe(1);
    })

    /**
     * @tc.number: GifHardwareDecodingCheckTest_004
     * @tc.name: gif-drawable库默认未开启硬解，local和field均调用setOpenHardware设置true，不上报
     * @tc.desc: gif-drawable库默认未开启硬解，local和field均调用setOpenHardware设置true，不上报
     */
    test('GifHardwareDecodingCheckTest_004', () => {
        const detectFile: string = path.join(realPath, 'ets', 'GifDrawableNoReport0.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile)));
        expect(detectFileReports?.length).toBe(0);
    })

    /**
     * @tc.number: GifHardwareDecodingCheckTest_005
     * @tc.name: gif-drawable库默认未开启硬解，local调用setOpenHardware设置true，再赋值，不上报
     * @tc.desc: gif-drawable库默认未开启硬解，local调用setOpenHardware设置true，再赋值，不上报
     */
    test('GifHardwareDecodingCheckTest_005', () => {
        const detectFile: string = path.join(realPath, 'ets', 'GifDrawableNoReport1.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile)));
        expect(detectFileReports?.length).toBe(0);
    })

    /**
     * @tc.number: GifHardwareDecodingCheckTest_006
     * @tc.name: gif-drawable库默认未开启硬解，调用setOpenHardware设置true，上报
     * @tc.desc: gif-drawable库默认未开启硬解，调用setOpenHardware设置true，上报
     */
    test('GifHardwareDecodingCheckTest_006', () => {
        const detectFile: string = path.join(realPath, 'ets', 'GifDrawableNoReport2.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile)));
        expect(detectFileReports?.length).toBe(0);
    })
})