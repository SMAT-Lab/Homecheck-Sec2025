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
import { CHECK_MODE, testCaseCheckDedicated } from './common/testCommon';
import path from 'path';
import { Rule } from '../../../src/Index';
import { ALERT_LEVEL } from '../../../src/model/Rule';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';
import { ImageSizeCheck } from '../../../src/checker/performance/ImageSizeCheck';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const testPath = './test/unittest/sample/ImageSize';
    const rule: Rule = new Rule('@performance/image-size-check', ALERT_LEVEL.SUGGESTION);
    checkEntry = await testCaseCheckDedicated(testPath, rule, CHECK_MODE.PROJECT2CHECK, ImageSizeCheck, true);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('ImageSizeCheckTest', () => {

    /**
     * @tc.number: ImageSizeCheckTest_001
     * @tc.name: 图片大于控件大小，控件宽高设置为像素，上报
     * @tc.desc: 图片大于控件大小，控件宽高设置为像素，上报
     */
    test('ImageSizeCheckTest_001', () => {
        const detectFile: string = path.join(realPath, 'entry', 'src', 'main', 'ets', 'ImageSize', 'ImageSizeReport0.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('7%7%11')));
        expect(detectFileReports.length).toBe(1);
    });

    /**
     * @tc.number: ImageSizeCheckTest_002
     * @tc.name: 图片大于控件大小，控件宽高设置为vp，上报
     * @tc.desc: 图片大于控件大小，控件宽高设置为vp，上报
     */
    test('ImageSizeCheckTest_002', () => {
        const detectFile: string = path.join(realPath, 'entry', 'src', 'main', 'ets', 'ImageSize', 'ImageSizeReport1.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('7%7%11')));
        expect(detectFileReports.length).toBe(1);
    });

    /**
     * @tc.number: ImageSizeCheckTest_003
     * @tc.name: 图片大于控件大小，控件宽高设置为默认vp，上报
     * @tc.desc: 图片大于控件大小，控件宽高设置为默认vp，上报
     */
    test('ImageSizeCheckTest_003', () => {
        const detectFile: string = path.join(realPath, 'entry', 'src', 'main', 'ets', 'ImageSize', 'ImageSizeReport2.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('7%7%11')));
        expect(detectFileReports.length).toBe(1);
    });

    /**
     * @tc.number: ImageSizeCheckTest_004
     * @tc.name: 图片大于控件大小，通过$r设置控件大小，上报
     * @tc.desc: 图片大于控件大小，通过$r设置控件大小，上报
     */
    test('ImageSizeCheckTest_004', () => {
        const detectFile: string = path.join(realPath, 'entry', 'src', 'main', 'ets', 'ImageSize', 'ImageSizeReport3.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('7%7%11')));
        expect(detectFileReports.length).toBe(0);
    });

    /**
     * @tc.number: ImageSizeCheckTest_005
     * @tc.name: 图片大于控件大小，通过size设置控件大小，上报
     * @tc.desc: 图片大于控件大小，通过size设置控件大小，上报
     */
    test('ImageSizeCheckTest_005', () => {
        const detectFile: string = path.join(realPath, 'entry', 'src', 'main', 'ets', 'ImageSize', 'ImageSizeReport4.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('7%7%11')));
        expect(detectFileReports.length).toBe(1);
    });

    /**
     * @tc.number: ImageSizeCheckTest_006
     * @tc.name: 图片大于控件大小，控件为通用控件，上报
     * @tc.desc: 图片大于控件大小，控件为通用控件，上报
     */
    test('ImageSizeCheckTest_006', () => {
        const detectFile: string = path.join(realPath, 'entry', 'src', 'main', 'ets', 'ImageSize', 'ImageSizeReport5.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('8%10%24')));
        expect(detectFileReports.length).toBe(1);
    });

    /**
     * @tc.number: AudioPauseOrMuteCheckTest_007
     * @tc.name: 图片大小小于控件大小，不上报
     * @tc.desc: 图片大小小于控件大小，不上报
     */
    test('ImageSizeCheckTest_007', () => {
        const detectFile: string = path.join(realPath, 'entry', 'src', 'main', 'ets', 'ImageSize', 'ImageSizeNoReport0.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile)));
        expect(detectFileReports.length).toBe(0);
    })
})