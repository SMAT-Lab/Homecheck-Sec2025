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
import { ImagePixelFormatCheck } from '../../../src/checker/correctness/ImagePixelFormatCheck';
import { Rule } from '../../../src/Index';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('');
    checkEntry = await testCaseCheck('./test/unittest/sample/ImagePixelFormat', rule, CHECK_MODE.FILE2CHECK, ImagePixelFormatCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('ImagePixelFormatTest', () => {

    test('AodFailTaskReport.ets image组件的createPixelMap接口中，pixelFormat的值如果是PixelMapFormat.RGB_565,告警', () => {
        // const detectFile: string = path.join(realPath, 'ets', 'AodFailTaskReport.ets');
        // const expectReportList = ['14%34%48','24%34%48','32%11%25'];
        // const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        // assert.isDefined(detectFileReport, 'The file path is error.');
        // assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        // detectFileReport?.issues.forEach((issue, index) => {
        //     assert.include(issue.fixKey, expectReportList[index]);
        // });
    });

    test('StatusBarColorManagerReport.ets image组件的createPixelMap接口中，pixelFormat的值如果是PixelMapFormat.RGB_565,告警', () => {
        // const detectFile: string = path.join(realPath, 'ets', 'StatusBarColorManagerReport.ets');
        // const expectReportList = ['23%63%77','30%18%32','37%63%77%'];
        // const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        // assert.isDefined(detectFileReport, 'The file path is error.');
        // assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        // detectFileReport?.issues.forEach((issue, index) => {
        //     assert.include(issue.fixKey, expectReportList[index]);
        // });
    });

    test('AodFailTaskNoReport.ets image组件的createPixelMap接口中，pixelFormat的值如果不是PixelMapFormat.RGB_565,不告警', () => {
        const detectFile: string = path.join(realPath, 'ets', 'AodFailTaskNoReport.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    });

    test('StatusBarColorManagerNoReport.ets image组件的createPixelMap接口中，pixelFormat的值如果不是PixelMapFormat.RGB_565,不告警', () => {
        const detectFile: string = path.join(realPath, 'ets', 'StatusBarColorManagerNoReport.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })
})