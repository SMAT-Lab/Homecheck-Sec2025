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
import { AvoidInspectorInterfaceCheck } from '../../../src/checker/stability/AvoidInspectorInterfaceCheck';
import { Rule } from '../../../src/Index';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule('');
    checkEntry = await testCaseCheck('./test/unittest/sample/AvoidInspectorInterface', rule, CHECK_MODE.FILE2CHECK, AvoidInspectorInterfaceCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('AvoidInspectorInterfaceTest', () => {

    /**
     * @tc.number: AvoidInspectorInterfaceTest_001
     * @tc.name: 有使用getInspectorInfo接口，需要上报
     * @tc.desc: 有使用getInspectorInfo接口，需要上报
     */
    test('AvoidInspectorInterfaceTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'AvoidInspectorInterfaceReport.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('28%41%56')));
        expect(detectFileReports?.length).toBe(1);
    });

    /**
     * @tc.number: AvoidInspectorInterfaceTest_002
     * @tc.name: 有使用getInspectorByKey、getInspectorTree接口，需要上报
     * @tc.desc: 有使用getInspectorByKey、getInspectorTree接口，需要上报
     */
    test('AvoidInspectorInterfaceTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'AvoidInspectorInterfaceReport2.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('18%15%31') || issue.defect.fixKey.includes('19%16%31')));
        expect(detectFileReports?.length).toBe(2);
    });

    /**
     * @tc.number: AvoidInspectorInterfaceTest_003
     * @tc.name: 有使用getFilteredInspectorTree、getFilteredInspectorTreeById接口，需要上报
     * @tc.desc: 有使用getFilteredInspectorTree、getFilteredInspectorTreeById接口，需要上报
     */
    test('AvoidInspectorInterfaceTest_003', () => {
        const detectFile: string = path.join(realPath, 'ets', 'AvoidInspectorInterfaceReport3.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('28%19%42') || issue.defect.fixKey.includes('29%19%46')));
        expect(detectFileReports?.length).toBe(2);
    });

    /**
     * @tc.number: AvoidInspectorInterfaceTest_004
     * @tc.name: 未使用Inspector相关接口，不需要上报
     * @tc.desc: 未使用Inspector相关接口，不需要上报
     */
    test('AvoidInspectorInterfaceTest_004', () => {
        const detectFile: string = path.join(realPath, 'ets', 'AvoidInspectorInterfaceNoReport.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        expect(file2Check?.issues.length).toBe(0);
    });
})