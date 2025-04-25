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
import { AvsessionMetadataCheck } from '../../../src/checker/correctness/AvsessionMetadataCheck';
import { Rule } from '../../../src/Index';
import { ALERT_LEVEL } from '../../../src/model/Rule';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const testPath = './test/unittest/sample/AvsessionMetadata';
    const rule: Rule = new Rule('', ALERT_LEVEL.WARN);
    checkEntry = await testCaseCheck(testPath, rule, CHECK_MODE.PROJECT2CHECK, AvsessionMetadataCheck, true);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('AvsessionMetadataCheckTest', () => {

    test('AvsessionMetadataCheckTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'AvsessionMetadataReport1.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('36%11%25')));
        expect(detectFileReports.length).toBe(1);
    });

    test('AvsessionMetadataCheckTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'AvsessionMetadataReport2.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('36%15%29')));
        expect(detectFileReports.length).toBe(1);
    });

    test('AvsessionMetadataCheckTest_003', () => {
        const detectFile: string = path.join(realPath, 'ets', 'AvsessionMetadataReport3.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('38%13%27')));
        expect(detectFileReports.length).toBe(1);
    });

    test('AvsessionMetadataCheckTest_004', () => {
        const detectFile: string = path.join(realPath, 'ets', 'AvsessionMetadataReport4.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('9%13%27')));
        expect(detectFileReports.length).toBe(1);
    });

    test('AvsessionMetadataCheckTest_005', () => {
        const detectFile: string = path.join(realPath, 'ets', 'AvsessionMetadataReport5.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('9%11%25')));
        expect(detectFileReports.length).toBe(1);
    });

    test('AvsessionMetadataCheckTest_006', () => {
        const detectFile: string = path.join(realPath, 'ets', 'AvsessionMetadataReport6.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('39%11%25')));
        expect(detectFileReports.length).toBe(1);
    });

    test('AvsessionMetadataCheckTest_007', () => {
        const detectFile: string = path.join(realPath, 'ets', 'AvsessionMetadataNoReport1.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile)));
        expect(detectFileReports.length).toBe(0);
    })

    test('AvsessionMetadataCheckTest_008', () => {
        const detectFile: string = path.join(realPath, 'ets', 'AvsessionMetadataNoReport2.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile)));
        expect(detectFileReports.length).toBe(0);
    })

    test('AvsessionMetadataCheckTest_009', () => {
        const detectFile: string = path.join(realPath, 'ets', 'AvsessionMetadataNoReport3.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile)));
        expect(detectFileReports.length).toBe(0);
    })
})