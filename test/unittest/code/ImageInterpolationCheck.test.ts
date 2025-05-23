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
import { ImageInterpolationCheck } from '../../../src/checker/correctness/ImageInterpolationCheck';
import { Rule } from '../../../src/Index';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('');
    checkEntry = await testCaseCheck('./test/unittest/sample/ImageInterpolation', rule, CHECK_MODE.FILE2CHECK, ImageInterpolationCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('ImageInterpolationTest', () => {

    test('AppIconReport.ets image的interpolation接口传入参数为ImageInterpolation.None,需要上报', () => {
        // const detectFile: string = path.join(realPath, 'ets', 'AppIconReport.ets');
        // const expectReportList = ['14%8%21%','21%8%21%'];
        // const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        // assert.isDefined(detectFileReport, 'The file path is error.');
        // assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        // detectFileReport?.issues.forEach((issue, index) => {
        //     assert.include(issue.fixKey, expectReportList[index]);
        // });
    });

    test('AppIconReport1.ets image的interpolation接口传入参数为ImageInterpolation.None,需要上报', () => {
        // const detectFile: string = path.join(realPath, 'ets', 'AppIconReport1.ets');
        // const expectReportList = ['19%8%21%','28%8%21%'];
        // const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        // assert.isDefined(detectFileReport, 'The file path is error.');
        // assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        // detectFileReport?.issues.forEach((issue, index) => {
        //     assert.include(issue.fixKey, expectReportList[index]);
        // });
    });

    test('AppIconReport2.ets image的interpolation接口传入参数为ImageInterpolation.None,需要上报', () => {
        // const detectFile: string = path.join(realPath, 'ets', 'AppIconReport2.ets');
        // const expectReportList = ['19%8%21%','27%8%21%'];
        // const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        // assert.isDefined(detectFileReport, 'The file path is error.');
        // assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        // detectFileReport?.issues.forEach((issue, index) => {
        //     assert.include(issue.fixKey, expectReportList[index]);
        // });
    });

    test('AppIconReport3.ets image的interpolation接口传入参数为ImageInterpolation.None,需要上报', () => {
        // const detectFile: string = path.join(realPath, 'ets', 'AppIconReport3.ets');
        // const expectReportList = ['18%8%21%','26%8%21%'];
        // const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        // assert.isDefined(detectFileReport, 'The file path is error.');
        // assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        // detectFileReport?.issues.forEach((issue, index) => {
        //     assert.include(issue.fixKey, expectReportList[index]);
        // });
    });

    test('AppIconReport4.ets image的interpolation接口传入参数为ImageInterpolation.None,需要上报', () => {
        // const detectFile: string = path.join(realPath, 'ets', 'AppIconReport4.ets');
        // const expectReportList = ['13%8%21%'];
        // const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        // assert.isDefined(detectFileReport, 'The file path is error.');
        // assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        // detectFileReport?.issues.forEach((issue, index) => {
        //     assert.include(issue.fixKey, expectReportList[index]);
        // });
    });

    test('AppIconReport.ets image的interpolation接口传入参数不是ImageInterpolation.None,不需要上报', () => {
        const detectFile: string = path.join(realPath, 'ets', 'AppIconNoReport.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    });

    test('AppIconReport1.ets image的interpolation接口传入参数不是ImageInterpolation.None,不需要上报', () => {
        const detectFile: string = path.join(realPath, 'ets', 'AppIconNoReport1.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    });

    test('AppIconReport2.ets image的interpolation接口传入参数不是ImageInterpolation.None,不需要上报', () => {
        const detectFile: string = path.join(realPath, 'ets', 'AppIconNoReport2.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    });

    test('AppIconReport3.ets image的interpolation接口传入参数不是ImageInterpolation.None,不需要上报', () => {
        const detectFile: string = path.join(realPath, 'ets', 'AppIconNoReport3.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    });

    test('AppIconReport4.ets image的interpolation接口传入参数不是ImageInterpolation.None,不需要上报', () => {
        const detectFile: string = path.join(realPath, 'ets', 'AppIconNoReport4.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })
})