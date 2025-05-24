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
import { LowerAppBrightnessCheck } from '../../../src/checker/performance/LowerAppBrightnessCheck';
import { Rule } from '../../../src/Index';
import { ALERT_LEVEL } from '../../../src/model/Rule';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const testPath = './test/unittest/sample/LowerAppBrightness';
    const rule: Rule = new Rule('@performance/lower-app-brightness-check', ALERT_LEVEL.SUGGESTION);
    checkEntry = await testCaseCheck(testPath, rule, CHECK_MODE.FILE2CHECK, LowerAppBrightnessCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('LowerAppBrightnessTest', () => {

    /**
     * @tc.number: LowerAppBrightnessTest_001
     * @tc.name: 同一个方法内，当前为深色模式，未设置当前应用窗口亮度，需要上报
     * @tc.desc: 同一个方法内，当前为深色模式，未设置当前应用窗口亮度，需要上报
     */
    test('LowerAppBrightnessTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'LowerAppBrightnessReport.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('22%5%6')));
        expect(detectFileReports?.length).toBe(1);
    });

    /**
     * @tc.number: LowerAppBrightnessTest_002
     * @tc.name: 同一个文件内，当前为深色模式，未设置当前应用窗口亮度，需要上报
     * @tc.desc: 同一个文件内，当前为深色模式，未设置当前应用窗口亮度，需要上报
     */
    test('LowerAppBrightnessTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'LowerAppBrightnessReport2.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('22%5%6')));
        expect(detectFileReports?.length).toBe(1);
    });

    /**
     * @tc.number: LowerAppBrightnessTest_003
     * @tc.name: 同一个类内，当前为深色模式，未设置当前应用窗口亮度，需要上报
     * @tc.desc: 同一个类内，当前为深色模式，未设置当前应用窗口亮度，需要上报
     */
    test('LowerAppBrightnessTest_003', () => {
        const detectFile: string = path.join(realPath, 'ets', 'LowerAppBrightnessReport3.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('22%5%6')));
        expect(detectFileReports?.length).toBe(1);
    });

    /**
     * @tc.number: LowerAppBrightnessTest_004
     * @tc.name: 同一个方法内，当前为省电模式，未设置当前应用窗口亮度，需要上报
     * @tc.desc: 同一个方法内，当前为省电模式，未设置当前应用窗口亮度，需要上报
     */
    test('LowerAppBrightnessTest_004', () => {
        const detectFile: string = path.join(realPath, 'ets', 'LowerAppBrightnessReport4.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('23%5%6')));
        expect(detectFileReports?.length).toBe(1);
    });

    /**
     * @tc.number: LowerAppBrightnessTestt_005
     * @tc.name: 同一个方法内，当前为深色模式，设置了当前应用窗口亮度，不需要上报
     * @tc.desc: 同一个方法内，当前为深色模式，设置了当前应用窗口亮度，不需要上报
     */
    test('LowerAppBrightnessTest_005', () => {
        const detectFile: string = path.join(realPath, 'ets', 'LowerAppBrightnessNoReport.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        expect(file2Check?.issues.length).toBe(0);
    });

    /**
     * @tc.number: LowerAppBrightnessTest_006
     * @tc.name: 同一个文件内，当前为深色模式，设置了当前应用窗口亮度，不需要上报
     * @tc.desc: 同一个文件内，当前为深色模式，设置了当前应用窗口亮度，不需要上报
     */
    test('LowerAppBrightnessTest_006', () => {
        const detectFile: string = path.join(realPath, 'ets', 'LowerAppBrightnessNoReport2.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        expect(file2Check?.issues.length).toBe(0);
    });

    /**
     * @tc.number: LowerAppBrightnessTest_007
     * @tc.name: 同一个类内，当前为深色模式，设置了当前应用窗口亮度，不需要上报
     * @tc.desc: 同一个类内，当前为深色模式，设置了当前应用窗口亮度，不需要上报
     */
    test('LowerAppBrightnessTest_007', () => {
        const detectFile: string = path.join(realPath, 'ets', 'LowerAppBrightnessNoReport3.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        expect(file2Check?.issues.length).toBe(0);
    });

    /**
     * @tc.number: LowerAppBrightnessTest_008
     * @tc.name: 同一个方法内，当前为省电模式，设置了当前应用窗口亮度，不需要上报
     * @tc.desc: 同一个方法内，当前为省电模式，设置了当前应用窗口亮度，不需要上报
     */
    test('LowerAppBrightnessTest_008', () => {
        const detectFile: string = path.join(realPath, 'ets', 'LowerAppBrightnessNoReport4.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        expect(file2Check?.issues.length).toBe(0);
    });

    /**
     * @tc.number: LowerAppBrightnessTest_008
     * @tc.name: 同一个方法内，if判断的变量为全局变量，当前为省电模式，设置了当前应用窗口亮度，不需要上报
     * @tc.desc: 同一个方法内，if判断的变量为全局变量，当前为省电模式，设置了当前应用窗口亮度，不需要上报
     */
    test('LowerAppBrightnessTest_009', () => {
        const detectFile: string = path.join(realPath, 'ets', 'LowerAppBrightnessNoReport5.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        expect(file2Check?.issues.length).toBe(0);
    });
})