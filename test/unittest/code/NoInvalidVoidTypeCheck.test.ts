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
import { ALERT_LEVEL, Rule } from '../../../src/model/Rule';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';
import { NoInvalidVoidTypeCheck } from '../../../src/checker/ArkTS-eslint/NoInvalidVoidTypeCheck';

let AagTRealPath: string = '';

let ArgCheckEntryT: CheckEntry;

beforeAll(async () => {
    let arg_rule_t: Rule = new Rule('@ArkTS-eslint/no-invalid-void-type-check', ALERT_LEVEL.SUGGESTION);
    arg_rule_t.option = [{ allowInGenericTypeArguments: true }];
    ArgCheckEntryT = await testCaseCheck('./test/unittest/sample/NoInvalidVoidType/argstrue', arg_rule_t, CHECK_MODE.FILE2CHECK, NoInvalidVoidTypeCheck);
    AagTRealPath = ArgCheckEntryT.scene.getRealProjectDir();
})

describe('NoInvalidVoidTypeTest', () => {

    /**
     * @tc.number: NoInvalidVoidTypeTest_001
     * @tc.name: allowInGenericTypeArguments=true，上报
     * @tc.desc: 允许void作为泛型类型参数，void作为泛型参数或者返回值以外任意处使用void，则上报
     */
    test('NoInvalidVoidTypeTest_001', () => {
        const detectFile: string = path.join(AagTRealPath, 'ArgTNoInvalidVoidTypeReport.ets');
        const expectReportList = ['16%28%', '17%33%', '18%34%', '19%36%', '20%17%', '21%37%', '22%48%',
            '23%49%', '24%34%', '24%43%', '25%26%', '26%15%', '27%33%', '28%24%', '29%37%',
            '30%56%', '31%35%', '32%44%', '33%43%', '35%19%', '39%13%', '42%41%',
            '44%26%', '46%30%', '48%30%', '49%25%', '50%14%', '51%17%'];
        const detectFileReport = ArgCheckEntryT.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() == detectFile);
        assert.isDefined(detectFileReport, 'The file path is error.');
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number: NoInvalidVoidTypeTest_002
     * @tc.name: allowInGenericTypeArguments=true，不上报
     * @tc.desc: 允许void作为泛型类型参数，泛型类型参数为void，不上报
     */
    test('NoInvalidVoidTypeTest_002', () => {
        const detectFile: string = path.join(AagTRealPath, 'ArgTNoInvalidVoidTypeNoReport.ts');
        const detectedFileReport = ArgCheckEntryT.fileChecks.find((fileCheck) => fileCheck.arkFile.getFilePath() === detectFile);
        assert.equal(detectedFileReport?.issues.length, 0, 'The number of reported line should be 0.');
    });

})