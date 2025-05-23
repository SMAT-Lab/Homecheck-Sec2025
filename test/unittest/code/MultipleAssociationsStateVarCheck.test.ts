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
import { MultipleAssociationsStateVarCheck } from '../../../src/checker/performance/MultipleAssociationsStateVarCheck';
import { Rule } from '../../../src/Index';
import { ALERT_LEVEL } from '../../../src/model/Rule';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const testPath = './test/unittest/sample/MultipleAssociationsStateVar';
    const rule: Rule = new Rule('@performance/multiple-associations-state-var-check', ALERT_LEVEL.SUGGESTION);
    checkEntry = await testCaseCheck(testPath, rule, CHECK_MODE.PROJECT2CHECK, MultipleAssociationsStateVarCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('MultipleAssociationsStateVarCheckTest', () => {

    /**
     * @tc.number: MultipleAssociationsStateVarCheckTest_001
     * @tc.name: ForEach内的自定义控件关联同一状态变量未添加@Watch修饰
     * @tc.desc: ForEach内的自定义控件关联同一状态变量未添加@Watch修饰
     */
    test('MultipleAssociationsStateVarCheckTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'MultipleAssociationsStateVarReport0.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('54%9%16')));
        expect(detectFileReports.length).toBe(1);
    });

    /**
     * @tc.number: MultipleAssociationsStateVarCheckTest_002
     * @tc.name: 仅有一个子组件关联，但在循环中，相当于有多个子组件，告警
     * @tc.desc: 仅有一个子组件关联，但在循环中，相当于有多个子组件，告警
     */
    test('MultipleAssociationsStateVarCheckTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'MultipleAssociationsStateVarReport1.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('39%9%20')));
        expect(detectFileReports.length).toBe(1);
    });

    /**
     * @tc.number: MultipleAssociationsStateVarCheckTest_003
     * @tc.name: 在用例002的基础上，子组件跨文件场景，告警
     * @tc.desc: 在用例002的基础上，子组件跨文件场景，告警
     */
    test('MultipleAssociationsStateVarCheckTest_003', () => {
        const detectFile: string = path.join(realPath, 'ets', 'ListItemComponent.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('5%9%20')));
        expect(detectFileReports.length).toBe(1);
    });

    /**
     * @tc.number: MultipleAssociationsStateVarCheckTest_004
     * @tc.name: 子组件不在循环中，但多个组件同时关联，告警
     * @tc.desc: 子组件不在循环中，但多个组件同时关联，告警
     */
    test('MultipleAssociationsStateVarCheckTest_004', () => {
        const detectFile: string = path.join(realPath, 'ets', 'MultipleAssociationsStateVarReport3.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('44%9%16')));
        expect(detectFileReports.length).toBe(1);
    });

    /**
     * @tc.number: MultipleAssociationsStateVarCheckTest_005
     * @tc.name: 检测到@Watch修饰自定义组件，不告警
     * @tc.desc: 检测到@Watch修饰自定义组件，不告警
     */
    test('MultipleAssociationsStateVarCheckTest_005', () => {
        const detectFile: string = path.join(realPath, 'ets', 'MultipleAssociationsStateVarNoReport0.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile)));
        expect(detectFileReports.length).toBe(0);
    });

    /**
     * @tc.number: MultipleAssociationsStateVarCheckTest_006
     * @tc.name: 检测到@Watch修饰自定义组件，不告警
     * @tc.desc: 检测到@Watch修饰自定义组件，不告警
     */
    test('MultipleAssociationsStateVarCheckTest_006', () => {
        const detectFile: string = path.join(realPath, 'ets', 'MultipleAssociationsStateVarNoReport1.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile)));
        expect(detectFileReports.length).toBe(0);
    })
})