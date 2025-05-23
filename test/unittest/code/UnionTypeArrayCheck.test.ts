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
import { CHECK_MODE, testCaseCheck } from './common/testCommon';
import path from 'path';
import { UnionTypeArrayCheck } from '../../../src/checker/performance/UnionTypeArrayCheck';
import { Rule } from '../../../src/Index';
import { ALERT_LEVEL } from '../../../src/model/Rule';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const testPath = './test/unittest/sample/UnionTypeArray';
    const rule: Rule = new Rule('@performance/union-type-array-check', ALERT_LEVEL.SUGGESTION);
    checkEntry = await testCaseCheck(testPath, rule, CHECK_MODE.FILE2CHECK, UnionTypeArrayCheck, true);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('UnionTypeArrayTest', () => {
    test('UnionTypeArrayTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'UnionTypeArrayNoReport.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        expect(file2Check?.issues.length).toBe(0);
    })

    test('UnionTypeArrayTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'UnionTypeArrayReport.ets');
        const expectReportList = ['1%5%10%', '2%5%7', '3%5%7', '4%5%12'];
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('1%5%10%') || issue.defect.fixKey.includes('2%5%7') ||
                issue.defect.fixKey.includes('3%5%7') || issue.defect.fixKey.includes('4%5%12')));
        expect(detectFileReports?.length).toBe(4);
    });
})