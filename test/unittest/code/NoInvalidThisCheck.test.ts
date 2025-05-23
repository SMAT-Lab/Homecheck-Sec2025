/*
 * Copyright (c) 2025 Huawei Device Co., Ltd.
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

import path from 'path';
import { assert, beforeAll, describe, test } from 'vitest';
import { NoInvalidThisCheck } from '../../../src/checker/ArkTS-eslint/NoInvalidThisCheck';
import { Rule } from '../../../src/model/Rule';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';
import { CHECK_MODE, testCaseCheck } from './common/testCommon';

let realPath: string = '';
let checkEntry: CheckEntry;
let checkEntry1: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('');
    rule.option = [{ "capIsConstructor": true }];
    checkEntry = await testCaseCheck('./test/unittest/sample/NoInvalidThisCheck', rule, CHECK_MODE.FILE2CHECK, NoInvalidThisCheck);
    rule.option = [{ "capIsConstructor": false }];
    checkEntry1 = await testCaseCheck('./test/unittest/sample/NoInvalidThisCheck', rule, CHECK_MODE.FILE2CHECK, NoInvalidThisCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('NoInvalidThisCheckTest', () => {
    /**
     * @tc.number: NoInvalidThisCheckTest_001
     */
    test('NoInvalidThisCheckTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NoInvalidThisCheck.ets');
        const expectReportList = [
            "316%5", "326%17", "327%27", "331%17", "332%27", "336%17", "337%27", "347%17",
            "348%27", "358%17", "359%27", "363%17", "364%27", "370%25", "371%35", "380%25",
            "381%35", "390%25", "391%35", "400%25", "401%35", "408%21", "409%31", "416%21",
            "417%31", "424%25", "425%35", "432%21", "433%31", "440%25", "441%35", "448%21", 
            "449%31", "459%17", "460%27", "464%17", "465%27", "469%17",
            "470%27", "474%17", "475%27", "479%17", "480%27", "484%17", "485%27", "489%17",
            "490%27", "494%17", "495%27", "499%17", "500%27", "504%17", "505%27", "509%17",
            "510%27", "514%17", "515%27", "519%17", "520%27", "524%17", "525%27", "534%17", 
            "535%27", "539%17", "540%27", "549%17", "550%27",
            "554%17", "555%27", "560%21", "561%31", "567%21", "568%31"
          ];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number: NoInvalidThisCheckTest_002
     */
    test('NoInvalidThisCheckTest_002', () => {
        const detectFile: string = path.join(realPath, 'ts', 'NoInvalidThisCheck.ts');
        const expectReportList = [
            "316%5", "326%17", "327%27", "331%17", "332%27", "336%17", "337%27", "347%17",
            "348%27", "358%17", "359%27", "363%17", "364%27", "370%25", "371%35", "380%25",
            "381%35", "390%25", "391%35", "400%25", "401%35", "408%21", "409%31", "416%21",
            "417%31", "424%25", "425%35", "432%21", "433%31", "440%25", "441%35", "448%21", 
            "449%31", "459%17", "460%27", "464%17", "465%27", "469%17",
            "470%27", "474%17", "475%27", "479%17", "480%27", "484%17", "485%27", "489%17",
            "490%27", "494%17", "495%27", "499%17", "500%27", "504%17", "505%27", "509%17",
            "510%27", "514%17", "515%27", "519%17", "520%27", "524%17", "525%27", "534%17", 
            "535%27", "539%17", "540%27", "549%17", "550%27",
            "554%17", "555%27", "560%21", "561%31", "567%21", "568%31"
          ];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    })

    /**
     * @tc.number: NoInvalidThisCheckTest_003
     */
    test('NoInvalidThisCheckTest_003', () => {
        const detectFile: string = path.join(realPath, 'ts', 'NoInvalidThisCheck.ts');
        const expectReportList = [
            "49%17", "50%27", "54%17", "55%27", "59%17", "60%27", "64%17", "65%27",
            "69%17", "70%27", "281%17", "282%27", "287%21", "288%31", "316%5", "326%17",
            "327%27", "331%17", "332%27", "336%17", "337%27", "341%17", "342%27", "347%17",
            "348%27", "353%17", "354%27", "358%17", "359%27", 
            "363%17", "364%27", "370%25", "371%35", "380%25", "381%35", "390%25", "391%35",
            "400%25", "401%35", "408%21", "409%31", "416%21", "417%31", "424%25", "425%35",
            "432%21", "433%31", "440%25", "441%35", "448%21", "449%31", "459%17", "460%27",
            "464%17", "465%27", "469%17", "470%27", "474%17", "475%27",
            "479%17", "480%27", "484%17", "485%27", "489%17", "490%27", "494%17", "495%27",
            "499%17", "500%27", "504%17", "505%27", "509%17", "510%27", "514%17", "515%27",
            "519%17", "520%27", "524%17", "525%27", "529%17", "530%27", "534%17", "535%27",
            "539%17", "540%27", "544%17", "545%27", "549%17", "550%27",
            "554%17", "555%27", "560%21", "561%31", "567%21", "568%31"
          ];
        const detectFileReport = checkEntry1.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    })

    /**
     * @tc.number: NoInvalidThisCheckTest_004
     */
    test('NoInvalidThisCheckTest_004', () => {
        const detectFile: string = path.join(realPath, 'ets', 'NoInvalidThisCheck.ets');
        const expectReportList = [
            "49%17", "50%27", "54%17", "55%27", "59%17", "60%27", "64%17", "65%27",
            "69%17", "70%27", "281%17", "282%27", "287%21", "288%31", "316%5", "326%17",
            "327%27", "331%17", "332%27", "336%17", "337%27", "341%17", "342%27", "347%17",
            "348%27", "353%17", "354%27", "358%17", "359%27", 
            "363%17", "364%27", "370%25", "371%35", "380%25", "381%35", "390%25", "391%35",
            "400%25", "401%35", "408%21", "409%31", "416%21", "417%31", "424%25", "425%35",
            "432%21", "433%31", "440%25", "441%35", "448%21", "449%31", "459%17", "460%27",
            "464%17", "465%27", "469%17", "470%27", "474%17", "475%27",
            "479%17", "480%27", "484%17", "485%27", "489%17", "490%27", "494%17", "495%27",
            "499%17", "500%27", "504%17", "505%27", "509%17", "510%27", "514%17", "515%27",
            "519%17", "520%27", "524%17", "525%27", "529%17", "530%27", "534%17", "535%27",
            "539%17", "540%27", "544%17", "545%27", "549%17", "550%27",
            "554%17", "555%27", "560%21", "561%31", "567%21", "568%31"
          ];
        const detectFileReport = checkEntry1.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    })
})