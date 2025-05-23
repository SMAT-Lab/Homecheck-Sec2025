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
import { AvsessionButtonsCheck } from '../../../src/checker/correctness/AvsessionButtonsCheck';
import { Rule } from '../../../src/Index';
import { ALERT_LEVEL } from '../../../src/model/Rule';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const testPath = './test/unittest/sample/AvsessionButtons';
    const rule: Rule = new Rule('@correctness/avsession-buttons-check', ALERT_LEVEL.ERROR);
    checkEntry = await testCaseCheck(testPath, rule, CHECK_MODE.PROJECT2CHECK, AvsessionButtonsCheck, true);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('AvsessionButtonsCheckTest', () => {

    test('AvsessionButtonsCheckTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'AvsessionButtonsReport1.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('10%11%25') || issue.defect.fixKey.includes('41%11%25') || issue.defect.fixKey.includes('76%11%25')));
        expect(detectFileReports.length).toBe(3);
    });

    test('AvsessionButtonsCheckTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'AvsessionButtonsReport2.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('10%11%25') || issue.defect.fixKey.includes('43%11%25') || issue.defect.fixKey.includes('80%11%25')));
        expect(detectFileReports.length).toBe(3);
    });

    test('AvsessionButtonsCheckTest_003', () => {
        const detectFile: string = path.join(realPath, 'ets', 'AvsessionButtonsReport3.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('10%30%44') || issue.defect.fixKey.includes('39%39%53') || issue.defect.fixKey.includes('71%30%44')));
        expect(detectFileReports.length).toBe(3);
    });

    test('AvsessionButtonsCheckTest_004', () => {
        const detectFile: string = path.join(realPath, 'ets', 'AvsessionButtonsNoReport1.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile)));
        expect(detectFileReports.length).toBe(0);
    });

    test('AvsessionButtonsCheckTest_005', () => {
        const detectFile: string = path.join(realPath, 'ets', 'AvsessionButtonsNoReport2.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile)));
        expect(detectFileReports.length).toBe(0);
    });

    test('AvsessionButtonsCheckTest_006', () => {
        const detectFile: string = path.join(realPath, 'ets', 'AvsessionButtonsNoReport3.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile)));
        expect(detectFileReports.length).toBe(0);
    });

    test('AvsessionButtonsCheckTest_007', () => {
        const detectFile: string = path.join(realPath, 'ets', 'AvsessionButtonsNoReport4.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile)));
        expect(detectFileReports.length).toBe(0);
    })
})