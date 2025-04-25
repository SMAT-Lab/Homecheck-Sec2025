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
import { AudioPauseOrMuteCheck } from '../../../src/checker/correctness/AudioPauseOrMuteCheck';
import { Rule } from '../../../src/Index';
import { ALERT_LEVEL } from '../../../src/model/Rule';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const testPath = './test/unittest/sample/AudioPauseOrMute';
    const rule: Rule = new Rule('@correctness/audio-pause-or-mute-check', ALERT_LEVEL.WARN);
    checkEntry = await testCaseCheck(testPath, rule, CHECK_MODE.PROJECT2CHECK, AudioPauseOrMuteCheck, true);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('AudioPauseOrMuteCheckTest', () => {

    /**
     * @tc.number: AudioPauseOrMuteCheckTest_001
     * @tc.name: callback场景未注册outputDeviceChangeWithInfo和audioOutputDeviceChangeWithInfo
     * @tc.desc: callback场景未注册outputDeviceChangeWithInfo和audioOutputDeviceChangeWithInfo
     */
    test('AudioPauseOrMuteCheckTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'AudioPauseOrMuteReport0.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('37%9%22') || issue.defect.fixKey.includes('48%9%27')
                || issue.defect.fixKey.includes('63%11%24') || issue.defect.fixKey.includes('74%11%29')));
        expect(detectFileReports.length).toBe(4);
    });

    /**
     * @tc.number: AudioPauseOrMuteCheckTest_002
     * @tc.name: promise then场景未注册outputDeviceChangeWithInfo和audioOutputDeviceChangeWithInfo
     * @tc.desc: promise then场景未注册outputDeviceChangeWithInfo和audioOutputDeviceChangeWithInfo
     */
    test('AudioPauseOrMuteCheckTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'AudioPauseOrMuteReport1.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('37%9%22') || issue.defect.fixKey.includes('46%9%27')
                || issue.defect.fixKey.includes('61%11%24') || issue.defect.fixKey.includes('72%11%29')));
        expect(detectFileReports.length).toBe(4);
    });

    /**
     * @tc.number: AudioPauseOrMuteCheckTest_003
     * @tc.name: promise return场景未注册outputDeviceChangeWithInfo和audioOutputDeviceChangeWithInfo
     * @tc.desc: promise return场景未注册outputDeviceChangeWithInfo和audioOutputDeviceChangeWithInfo
     */
    test('AudioPauseOrMuteCheckTest_003', () => {
        const detectFile: string = path.join(realPath, 'ets', 'AudioPauseOrMuteReport2.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('38%31%44') || issue.defect.fixKey.includes('46%36%54')
                || issue.defect.fixKey.includes('56%33%46') || issue.defect.fixKey.includes('64%40%58')
                || issue.defect.fixKey.includes('72%35%48') || issue.defect.fixKey.includes('79%54%67')));
        expect(detectFileReports.length).toBe(6);
    });

    /**
     * @tc.number: AudioPauseOrMuteCheckTest_004
     * @tc.name: promise return场景跨方法调用未注册outputDeviceChangeWithInfo和audioOutputDeviceChangeWithInfo
     * @tc.desc: promise return场景跨方法调用未注册outputDeviceChangeWithInfo和audioOutputDeviceChangeWithInfo
     */
    test('AudioPauseOrMuteCheckTest_004', () => {
        const detectFile: string = path.join(realPath, 'ets', 'AudioPauseOrMuteReport3.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('39%31%44') || issue.defect.fixKey.includes('47%36%54')
                || issue.defect.fixKey.includes('70%33%46') || issue.defect.fixKey.includes('78%40%58')));
        expect(detectFileReports.length).toBe(4);
    });

    /**
    * @tc.number: AudioPauseOrMuteCheckTest_005
    * @tc.name: promise return场景跨方法调用未注册outputDeviceChangeWithInfo和audioOutputDeviceChangeWithInfo
    * @tc.desc: promise return场景跨方法调用未注册outputDeviceChangeWithInfo和audioOutputDeviceChangeWithInfo
    */
    test('AudioPauseOrMuteCheckTest_005', () => {
        const detectFile: string = path.join(realPath, 'ets', 'AudioPauseOrMuteReport4.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('41%11%24') || issue.defect.fixKey.includes('54%11%29')));
        expect(detectFileReports.length).toBe(2);
    });

    /**
     * @tc.number: AudioPauseOrMuteCheckTest_006
     * @tc.name: callback场景注册outputDeviceChangeWithInfo和audioOutputDeviceChangeWithInfo
     * @tc.desc: callback场景注册outputDeviceChangeWithInfo和audioOutputDeviceChangeWithInfo
     */
    test('AudioPauseOrMuteCheckTest_006', () => {
        const detectFile: string = path.join(realPath, 'ets', 'AudioPauseOrMuteNoReport0.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile)));
        expect(detectFileReports.length).toBe(0);
    });

    /**
     * @tc.number: AudioPauseOrMuteCheckTest_007
     * @tc.name: promise then场景注册outputDeviceChangeWithInfo和audioOutputDeviceChangeWithInfo
     * @tc.desc: promise then场景注册outputDeviceChangeWithInfo和audioOutputDeviceChangeWithInfo
     */
    test('AudioPauseOrMuteCheckTest_007', () => {
        const detectFile: string = path.join(realPath, 'ets', 'AudioPauseOrMuteNoReport1.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile)));
        expect(detectFileReports.length).toBe(0);
    });

    /**
     * @tc.number: AudioPauseOrMuteCheckTest_008
     * @tc.name: promise return场景注册outputDeviceChangeWithInfo和audioOutputDeviceChangeWithInfo
     * @tc.desc: promise return场景注册outputDeviceChangeWithInfo和audioOutputDeviceChangeWithInfo
     */
    test('AudioPauseOrMuteCheckTest_008', () => {
        const detectFile: string = path.join(realPath, 'ets', 'AudioPauseOrMuteNoReport2.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile)));
        expect(detectFileReports.length).toBe(0);
    });

    /**
     * @tc.number: AudioPauseOrMuteCheckTest_009
     * @tc.name: promise return场景跨方法注册outputDeviceChangeWithInfo和audioOutputDeviceChangeWithInfo
     * @tc.desc: promise return场景跨方法注册outputDeviceChangeWithInfo和audioOutputDeviceChangeWithInfo
     */
    test('AudioPauseOrMuteCheckTest_009', () => {
        const detectFile: string = path.join(realPath, 'ets', 'AudioPauseOrMuteNoReport3.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile)));
        expect(detectFileReports.length).toBe(0);
    });

    /**
     * @tc.number: AudioPauseOrMuteCheckTest_010
     * @tc.name: promise return场景, 自定义promise, 注册outputDeviceChangeWithInfo和audioOutputDeviceChangeWithInfo
     * @tc.desc: promise return场景, 自定义promise, 注册outputDeviceChangeWithInfo和audioOutputDeviceChangeWithInfo
     */
    test('AudioPauseOrMuteCheckTest_010', () => {
        const detectFile: string = path.join(realPath, 'ets', 'AudioPauseOrMuteNoReport4.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile)));
        expect(detectFileReports.length).toBe(0);
    });

    /**
     * @tc.number: AudioPauseOrMuteCheckTest_011
     * @tc.name: callback, promise then, return场景通过get/set方式注册outputDeviceChangeWithInfo和audioOutputDeviceChangeWithInfo
     * @tc.desc: callback, promise then, return场景通过get/set方式注册outputDeviceChangeWithInfo和audioOutputDeviceChangeWithInfo
     */
    test('AudioPauseOrMuteCheckTest_011', () => {
        const detectFile: string = path.join(realPath, 'ets', 'AudioPauseOrMuteNoReport5.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile)));
        expect(detectFileReports.length).toBe(0);
    });
})