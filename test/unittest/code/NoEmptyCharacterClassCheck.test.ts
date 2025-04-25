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
import { NoCondAssignCheck } from '../../../src/checker/ArkTS-eslint/NoCondAssignCheck';
import { Rule } from '../../../src/model/Rule';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';
import { CHECK_MODE, testCaseCheck } from './common/testCommon';
import { NoEmptyCharacterClassCheck } from '../../../src/checker/ArkTS-eslint/NoEmptyCharacterClassCheck';
let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('');
    checkEntry = await testCaseCheck('./test/unittest/sample/NoEmptyCharacterClass', rule, CHECK_MODE.FILE2CHECK, NoEmptyCharacterClassCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('NoEmptyCharacterClassTest', () => {
    /**
     * @tc.number: NoEmptyCharacterClassTest_001
     * @tc.name: 不允许使用八进制文字，不上报,ts文件
     * @tc.desc: 不允许使用八进制文字，不上报,ts文件
     */
    test('NoEmptyCharacterClassTest_001', () => {
        const detectFile: string = path.join(realPath, 'ts', 'NoEmptyCharacterClassNoReport.ts');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })
    /**
     * @tc.number: NoEmptyCharacterClassTest_002
     * @tc.name: 不允许使用八进制文字，上报,ts文件
     * @tc.desc: 不允许使用八进制文字，上报,ts文件
     */
    test('NoEmptyCharacterClassTest_002', () => {
        const detectFile: string = path.join(realPath, 'ts', 'NoEmptyCharacterClassReport.ts');
        const expectReportList = ['17%1%', '18%17%', '20%1%', '21%17%', '23%1%', '24%17%', '26%1%', '27%17%', '29%15%'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    })
})
