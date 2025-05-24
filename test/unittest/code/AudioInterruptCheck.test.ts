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
import { AudioInterruptCheck } from '../../../src/checker/correctness/AudioInterruptCheck';
import { Rule } from '../../../src/Index';
import { ALERT_LEVEL } from '../../../src/model/Rule';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const testPath = './test/unittest/sample/AudioInterrupt';
    const rule: Rule = new Rule('@correctness/audio-interrupt-check', ALERT_LEVEL.ERROR);
    checkEntry = await testCaseCheck(testPath, rule, CHECK_MODE.PROJECT2CHECK, AudioInterruptCheck, true);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('AudioInterruptCheckTest', () => {

    /**
     * @tc.number: AudioInterruptCheckTest_001
     * @tc.name: callback场景未注册audioInterrupt
     * @tc.desc: callback场景未注册audioInterrupt
     */
    test('AudioInterruptCheckTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'AudioInterruptReport0.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('52%9%22') || issue.defect.fixKey.includes('63%9%27')
                || issue.defect.fixKey.includes('74%9%27') || issue.defect.fixKey.includes('82%9%22')
                || issue.defect.fixKey.includes('97%11%24') || issue.defect.fixKey.includes('108%11%29')
                || issue.defect.fixKey.includes('119%11%29') || issue.defect.fixKey.includes('127%11%24')));
        expect(detectFileReports.length).toBe(8);
    });

    /**
     * @tc.number: AudioInterruptCheckTest_002
     * @tc.name: promise then场景未注册audioInterrupt
     * @tc.desc: promise then场景未注册audioInterrupt
     */
    test('AudioInterruptCheckTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'AudioInterruptReport1.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('56%9%22') || issue.defect.fixKey.includes('65%9%27')
                || issue.defect.fixKey.includes('76%9%27') || issue.defect.fixKey.includes('84%30%41')
                || issue.defect.fixKey.includes('94%11%24') || issue.defect.fixKey.includes('105%11%29')
                || issue.defect.fixKey.includes('116%11%29') || issue.defect.fixKey.includes('127%32%43')));
        expect(detectFileReports.length).toBe(8);
    });

    /**
     * @tc.number: AudioInterruptCheckTest_003
     * @tc.name: promise return场景未注册audioInterrupt
     * @tc.desc: promise return场景未注册audioInterrupt
     */
    test('AudioInterruptCheckTest_003', () => {
        const detectFile: string = path.join(realPath, 'ets', 'AudioInterruptReport2.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('54%31%44') || issue.defect.fixKey.includes('59%36%54')
                || issue.defect.fixKey.includes('63%36%54') || issue.defect.fixKey.includes('71%63%74')
                || issue.defect.fixKey.includes('84%33%46') || issue.defect.fixKey.includes('92%40%58')
                || issue.defect.fixKey.includes('100%40%58') || issue.defect.fixKey.includes('108%65%76')
                || issue.defect.fixKey.includes('113%35%48') || issue.defect.fixKey.includes('120%52%65')));
        expect(detectFileReports.length).toBe(10);
    });

    /**
     * @tc.number: AudioInterruptCheckTest_004
     * @tc.name: promise return场景, 跨方法调用未注册audioInterrupt
     * @tc.desc: promise return场景, 跨方法调用未注册audioInterrupt
     */
    test('AudioInterruptCheckTest_004', () => {
        const detectFile: string = path.join(realPath, 'ets', 'AudioInterruptReport3.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('54%31%44') || issue.defect.fixKey.includes('62%36%54')
                || issue.defect.fixKey.includes('67%38%56') || issue.defect.fixKey.includes('76%61%72')
                || issue.defect.fixKey.includes('104%33%46') || issue.defect.fixKey.includes('109%40%58')
                || issue.defect.fixKey.includes('117%57%75') || issue.defect.fixKey.includes('125%65%76')));
        expect(detectFileReports.length).toBe(8);
    });

    /**
    * @tc.number: AudioInterruptCheckTest_005
    * @tc.name: callback, promise then, return场景经过多次转换, 注册audioInterrupt, 不支持的检测方式
    * @tc.desc: callback, promise then, return场景经过多次转换, 注册audioInterrupt, 不支持的检测方式
    */
    test('AudioInterruptCheckTest_005', () => {
        const detectFile: string = path.join(realPath, 'ets', 'AudioInterruptReport4.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('59%11%24') || issue.defect.fixKey.includes('72%11%29')
                || issue.defect.fixKey.includes('89%29%47')));
        expect(detectFileReports.length).toBe(3);
    });

    /**
     * @tc.number: AudioInterruptCheckTest_006
     * @tc.name: callback场景注册audioInterrupt
     * @tc.desc: callback场景注册audioInterrupt
     */
    test('AudioInterruptCheckTest_006', () => {
        const detectFile: string = path.join(realPath, 'ets', 'AudioInterruptNoReport0.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile)));
        expect(detectFileReports.length).toBe(0);
    });

    /**
     * @tc.number: AudioInterruptCheckTest_007
     * @tc.name: promise then场景注册audioInterrupt
     * @tc.desc: promise then场景注册audioInterrupt
     */
    test('AudioInterruptCheckTest_007', () => {
        const detectFile: string = path.join(realPath, 'ets', 'AudioInterruptNoReport1.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile)));
        expect(detectFileReports.length).toBe(0);
    });

    /**
     * @tc.number: AudioInterruptCheckTest_008
     * @tc.name: promise return场景注册audioInterrupt
     * @tc.desc: promise return场景注册audioInterrupt
     */
    test('AudioInterruptCheckTest_008', () => {
        const detectFile: string = path.join(realPath, 'ets', 'AudioInterruptNoReport2.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile)));
        expect(detectFileReports.length).toBe(0);
    });

    /**
     * @tc.number: AudioInterruptCheckTest_009
     * @tc.name: promise return场景跨方法, 注册audioInterrupt
     * @tc.desc: promise return场景跨方法, 注册audioInterrupt
     */
    test('AudioInterruptCheckTest_009', () => {
        const detectFile: string = path.join(realPath, 'ets', 'AudioInterruptNoReport3.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile)));
        expect(detectFileReports.length).toBe(0);
    });

    /**
     * @tc.number: AudioInterruptCheckTest_010
     * @tc.name: promise return场景, 自定义promise, 注册audioInterrupt
     * @tc.desc: promise return场景, 自定义promise, 注册audioInterrupt
     */
    test('AudioInterruptCheckTest_010', () => {
        const detectFile: string = path.join(realPath, 'ets', 'AudioInterruptNoReport4.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile)));
        expect(detectFileReports.length).toBe(0);
    });

   /**
     * @tc.number: AudioInterruptCheckTest_011
     * @tc.name: callback, promise then, return场景通过get/set方式注册audioInterrupt
     * @tc.desc: callback, promise then, return场景通过get/set方式注册audioInterrupt
     */
    test('AudioInterruptCheckTest_011', () => {
        const detectFile: string = path.join(realPath, 'ets', 'AudioInterruptNoReport5.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile)));
        expect(detectFileReports.length).toBe(0);
    });
})