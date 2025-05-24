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
import { ImageFormatCheck } from '../../../src/checker/performance/ImageFormatCheck';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const testPath = './test/unittest/sample/ImageFormat/ets';
    const rule: Rule = new Rule('@performance/image-format-check', ALERT_LEVEL.SUGGESTION);
    checkEntry = await testCaseCheckDedicated(testPath, rule, CHECK_MODE.PROJECT2CHECK, ImageFormatCheck, true);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('ImageFormatTest', () => {

    /**
     * @tc.number: ImageFormatTest_001
     * @tc.name: 检测app.json5中图片格式
     * @tc.desc: 检测app.json5中图片格式
     */
    test('ImageFormatTest_001', () => {
        const detectFile: string = path.join(realPath, 'AppScope', 'app.json5');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('7%14%28')));
        expect(detectFileReports.length).toBe(1);
    });

    /**
     * @tc.number: ImageFormatTest_002
     * @tc.name: 检测module.json5中图片格式
     * @tc.desc: 检测module.json5中图片格式
     */
    test('ImageFormatTest_002', () => {
        const detectFile: string = path.join(realPath, 'entry', 'src', 'main', 'module.json5');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('30%18%28') || issue.defect.fixKey.includes('34%29%44')));
        expect(detectFileReports.length).toBe(2);
    });

    /**
     * @tc.number: ImageFormatTest_003
     * @tc.name: 检测Image中图片格式
     * @tc.desc: 检测Image中图片格式
     */
    test('ImageFormatTest_003', () => {
        const detectFile: string = path.join(realPath, 'entry', 'src', 'main', 'ets', 'Image_Report.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('22%17%35') || issue.defect.fixKey.includes('26%23%53')
                || issue.defect.fixKey.includes('28%23%45') || issue.defect.fixKey.includes('31%14%41')
                || issue.defect.fixKey.includes('43%72%105')));
        expect(detectFileReports.length).toBe(5);
    });

    /**
     * @tc.number: ImageFormatTest_004
     * @tc.name: 检测getDrawableDescriptor中的图片格式
     * @tc.desc: 检测getDrawableDescriptor中的图片格式
     */
    test('ImageFormatTest_004', () => {
        const detectFile: string = path.join(realPath, 'entry', 'src', 'main', 'ets', 'Image_Report.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('11%82%95') || issue.defect.fixKey.includes('12%25%38')));
        expect(detectFileReports.length).toBe(2);
    });

    /**
     * @tc.number: ImageFormatTest_005
     * @tc.name: 检测getRawFd和getRawFdSync中的图片格式
     * @tc.desc: 检测getRawFd和getRawFdSync中的图片格式
     */
    test('ImageFormatTest_005', () => {
        const detectFile: string = path.join(realPath, 'entry', 'src', 'main', 'ets', 'Image_Report.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('14%64%86') || issue.defect.fixKey.includes('15%61%83')));
        expect(detectFileReports.length).toBe(2);
    });

    /**
     * @tc.number: ImageFormatTest_006
     * @tc.name: 无法检测场景
     * @tc.desc: 无法检测场景
     */
    test('ImageFormatTest_006', () => {
        const detectFile: string = path.join(realPath, 'entry', 'src', 'main', 'ets', 'Image_NoReport.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile)));
        expect(detectFileReports.length).toBe(0);
    })
})