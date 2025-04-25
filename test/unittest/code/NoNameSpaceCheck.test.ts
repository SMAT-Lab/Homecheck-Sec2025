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
import { CheckEntry, Rule } from '../../../src/Index';
import { NoNameSpaceCheck } from '../../../src/checker/ArkTS-eslint/NoNameSpaceCheck';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('');
    rule.option = [
        {
          "allowDeclarations": false,
          "allowDefinitionFiles": true
        }
      ];
    checkEntry = await testCaseCheck('./test/unittest/sample/NoNameSpace', rule, CHECK_MODE.FILE2CHECK, NoNameSpaceCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('NoNameSpaceTest', () => {
    /**
     * @tc.number: NoNameSpaceTest_001
     */
    test('NoNameSpaceTest_001', () => {
        const detectFile: string = path.join(realPath, 'ts', 'NoNameSpaceReport.ts');
        const expectReportList = ['16%1%1', '17%1%1', '19%1%1', '20%1%1'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'ES2015 module syntax is preferred over namespaces.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number: NoNameSpaceTest_002
     */
    test('NoNameSpaceTest_002', () => {
        const detectFile: string = path.join(realPath, 'ts', 'NoNameSpaceNoReport.ts');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })
})