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
import { MaxLinesCheck } from '../../../src/checker/ArkTS-eslint/MaxLinesCheck';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    let rule: Rule = new Rule('@ArkTS-eslint/max-lines-check', ALERT_LEVEL.SUGGESTION);
    rule.option = [{
        'max': 19
    }];
    checkEntry = await testCaseCheck('./test/unittest/sample/MaxLines', rule, CHECK_MODE.FILE2CHECK, MaxLinesCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('MaxLinesTest', () => {
    /**
     * @tc.number: MaxLinesTest_001
     * @tc.name: 代码行数超过最大行数限制，上报
     * @tc.desc: 代码行数超过最大行数限制，上报
     */
    test('MaxLinesTest_001', () => {
        const detectFile: string = path.join(realPath, 'MaxLinesReport.ts');
        const expectReportList = ['20%1%'];
        const detectFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() == detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number: MaxLinesTest_002
     * @tc.name: 文件忽略空行和注释后代码行数不超过最大行数限制，不上报
     * @tc.desc: 文件忽略空行和注释后代码行数不超过最大行数限制，不上报
     */
    test('MaxLinesTest_002', () => {
        const detectFile: string = path.join(realPath, 'MaxLinesNoReport.ts');
        const detectedFileReport = checkEntry.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    })
})