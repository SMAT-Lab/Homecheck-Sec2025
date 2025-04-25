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
import { CHECK_MODE, testCaseCheck } from './common/testCommon';
import path from 'path';
import { ALERT_LEVEL,Rule } from '../../../src/model/Rule';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';
import { TypedefCheck } from '../../../src/checker/ArkTS-eslint/TypedefCheck';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    let rule: Rule = new Rule("@ArkTS-eslint/typedef-check",ALERT_LEVEL.ERROR,);
    rule.option = [
        {
            arrayDestructuring: true,
            arrowParameter: false,
            memberVariableDeclaration: false,
            objectDestructuring: false,
            parameter: false,
            propertyDeclaration: false,
            variableDeclaration: false,
            variableDeclarationIgnoreFunction: false
        },
    ]
    checkEntry = await testCaseCheck('./test/unittest/sample/TypedefCheck', rule, CHECK_MODE.FILE2CHECK, TypedefCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('TypedefTest', () => {
    /**
     * @tc.number: TypedefTest
     */
    test('TypedefTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'TypedefReport.ets');
        const expectReportList = ['16%7'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number: TypedefTest_002
     */
    test('TypedefTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'TypedefNoReoprt.ets');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })
})