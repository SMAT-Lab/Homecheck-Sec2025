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

import { assert, beforeAll, describe, test } from 'vitest';
import { NoMagicNumbersCheck } from '../../../src/checker/ArkTS-eslint/NoMagicNumbersCheck';
import { CHECK_MODE, testCaseCheck } from './common/testCommon';
import path from 'path';
import { Rule } from '../../../src/Index';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
})

describe('NoMagicNumbersTest', () => {
    /**
     * @tc.number: NoMagicNumbersCheckNoReportTest_001
     * @tc.name: NoMagicNumbersTest
     * @tc.desc: NoMagicNumbersTest
     */
    test('NoMagicNumbersCheckNoReportTest_001', async () => {
      const rule: Rule = new Rule('@ArkTS-eslint/no-magic-numbers-check');
      checkEntry = await testCaseCheck('./test/unittest/sample/NoMagicNumbers', rule, CHECK_MODE.FILE2CHECK, NoMagicNumbersCheck);
      realPath = checkEntry.scene.getRealProjectDir()
      const detectFile: string = path.join(realPath, 'ets', 'NoMagicNumbersNoReport.ets');
             const expectReportList = ['16%16','17%16','18%30','19%23','20%16','21%17','22%24','26%15','26%19','26%23','29%21','29%23','29%25','29%27',
                '30%13','30%17','30%21','31%27','31%33','31%39','33%30','35%17','36%17','37%17','38%17','39%17','40%17','41%17','41%21','42%17','42%21',
                '45%12','46%11','52%17','52%21','52%25','58%23','58%27','58%32','59%33','61%22','62%18','63%15','64%13'
             ];
             const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
             assert.isDefined(detectFileReport, 'The file path is error.');
             assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
             detectFileReport?.issues.forEach((issue, index) => {
                 assert.include(issue.defect.fixKey, expectReportList[index]);
             });
    });

    test('NoMagicNumbersCheckNoReportTest_002', async () => {
        const rule: Rule = new Rule('@ArkTS-eslint/no-magic-numbers-check');
        rule.option = [{ "ignoreEnums": true }]
        checkEntry = await testCaseCheck('./test/unittest/sample/NoMagicNumbers', rule, CHECK_MODE.FILE2CHECK, NoMagicNumbersCheck);
        realPath = checkEntry.scene.getRealProjectDir()
        const detectFile: string = path.join(realPath, 'ets', 'NoMagicNumbersNoReport.ets');
               const expectReportList = ['16%16','17%16','18%30','19%23','20%16','21%17','22%24','26%15','26%19','26%23','29%21','29%23','29%25','29%27',
                '30%13','30%17','30%21','31%27','31%33','31%39','33%30','35%17','36%17','37%17','38%17','39%17','40%17','41%17','41%21','42%17','42%21',
                '52%17','52%21','52%25','58%23','58%27','58%32','59%33','61%22','62%18','63%15','64%13'
             ];
               const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
               assert.isDefined(detectFileReport, 'The file path is error.');
               assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
               detectFileReport?.issues.forEach((issue, index) => {
                   assert.include(issue.defect.fixKey, expectReportList[index]);
               });
      });

      test('NoMagicNumbersCheckNoReportTest_003', async () => {
        const rule: Rule = new Rule('@ArkTS-eslint/no-magic-numbers-check');
        rule.option = [{ "ignoreNumericLiteralTypes": true }]
        checkEntry = await testCaseCheck('./test/unittest/sample/NoMagicNumbers', rule, CHECK_MODE.FILE2CHECK, NoMagicNumbersCheck);
        realPath = checkEntry.scene.getRealProjectDir()
        const detectFile: string = path.join(realPath, 'ets', 'NoMagicNumbersNoReport.ets');
               const expectReportList = ['16%16','17%16','18%30','19%23','20%16','21%17','22%24','29%21','29%23','29%25','29%27',
                '31%27','31%33','31%39','33%30','35%17','36%17','37%17','38%17','39%17','40%17','41%17','41%21','42%17','42%21',
                '45%12','46%11','59%33','61%22','62%18','63%15','64%13'
             ];
               const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
               assert.isDefined(detectFileReport, 'The file path is error.');
               assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
               detectFileReport?.issues.forEach((issue, index) => {
                   assert.include(issue.defect.fixKey, expectReportList[index]);
               });
      });

      test('NoMagicNumbersCheckNoReportTest_004', async () => {
        const rule: Rule = new Rule('@ArkTS-eslint/no-magic-numbers-check');
        rule.option = [{ "ignoreReadonlyClassProperties": true }]
        checkEntry = await testCaseCheck('./test/unittest/sample/NoMagicNumbers', rule, CHECK_MODE.FILE2CHECK, NoMagicNumbersCheck);
        realPath = checkEntry.scene.getRealProjectDir()
        const detectFile: string = path.join(realPath, 'ets', 'NoMagicNumbersNoReport.ets');
        const expectReportList =['26%15','26%19','26%23','29%21','29%23','29%25','29%27',
            '30%13','30%17','30%21','31%27','31%33','31%39','33%30','35%17','36%17','37%17','38%17','39%17','40%17','41%17','41%21','42%17','42%21',
            '45%12','46%11','52%17','52%21','52%25','58%23','58%27','58%32','59%33','61%22','62%18','63%15','64%13'
         ];
               const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
               assert.isDefined(detectFileReport, 'The file path is error.');
               assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
               detectFileReport?.issues.forEach((issue, index) => {
                   assert.include(issue.defect.fixKey, expectReportList[index]);
               });
      });

      test('NoMagicNumbersCheckNoReportTest_005', async () => {
        const rule: Rule = new Rule('@ArkTS-eslint/no-magic-numbers-check');
        rule.option = [{ "ignoreTypeIndexes": true }]
        checkEntry = await testCaseCheck('./test/unittest/sample/NoMagicNumbers', rule, CHECK_MODE.FILE2CHECK, NoMagicNumbersCheck);
        realPath = checkEntry.scene.getRealProjectDir()
        const detectFile: string = path.join(realPath, 'ets', 'NoMagicNumbersNoReport.ets');
               const expectReportList = ['16%16','17%16','18%30','19%23','20%16','21%17','22%24','26%15','26%19','26%23','29%21','29%23','29%25','29%27',
                '30%13','30%17','30%21','31%27','31%33','31%39','33%30','45%12','46%11','52%17','52%21','52%25','58%23','58%27','58%32','59%33','61%22','62%18','63%15','64%13'
             ];
               const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
               assert.isDefined(detectFileReport, 'The file path is error.');
               assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
               detectFileReport?.issues.forEach((issue, index) => {
                   assert.include(issue.defect.fixKey, expectReportList[index]);
               });
      });
    /**
     * @tc.number: NoMagicNumbersCheckReportTest_006
     * @tc.name: NoForInArrayReportTest
     * @tc.desc: NoForInArrayReportTest
     */
    test('NoMagicNumbersCheckReportTest_006', async () => {
            const rule: Rule = new Rule('');
            checkEntry = await testCaseCheck('./test/unittest/sample/NoMagicNumbers', rule, CHECK_MODE.FILE2CHECK, NoMagicNumbersCheck);
            realPath = checkEntry.scene.getRealProjectDir()
            const detectFile: string = path.join(realPath, 'ets', 'NoMagicNumbersReport.ets');
            const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
            assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
        })
})