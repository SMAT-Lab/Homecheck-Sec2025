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
import { Rule } from '../../../src/Index';
import { ALERT_LEVEL } from '../../../src/model/Rule';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';
import { HomepagePrepareLoadCheck } from '../../../src/checker/performance/HomepagePrepareLoadCheck';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const testPath = './test/unittest/sample/HomepagePrepareLoad';
    const rule: Rule = new Rule('', ALERT_LEVEL.WARN);
    checkEntry = await testCaseCheck(testPath, rule, CHECK_MODE.PROJECT2CHECK, HomepagePrepareLoadCheck, true);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('HomepagePrepareLoadTest', () => {

    /**
     * @tc.number: HomepagePrepareLoadTest_001
     * @tc.name: EntryAbility没有预连接，首页有Web组件，Web的aboutToAppear、onAppear、onPageEnd里都没有预连接
     * @tc.desc: EntryAbility没有预连接，首页有Web组件，Web的aboutToAppear、onAppear、onPageEnd里都没有预连接
     */
    test('HomepagePrepareLoadTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'HomepagePrepareLoadReport', 'ets', 'entryability', 'HomepagePrepareLoadReport.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('6%3%10')));
        expect(detectFileReports.length).toBe(1);
    });

    /**
     * @tc.number: HomepagePrepareLoadTest_002
     * @tc.name: EntryAbility有预连接，不需要上报
     * @tc.desc: EntryAbility有预连接，不需要上报
     */
    test('HomepagePrepareLoadTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'HomepagePrepareLoadNoReport1', 'ets', 'entryability', 'HomepagePrepareLoadNoReport.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile)));
        expect(detectFileReports.length).toBe(0);
    });

    /**
     * @tc.number: HomepagePrepareLoadTest_003
     * @tc.name: EntryAbility没有预连接，首页有Web组件，Web的aboutToAppear里有预连接，不需要上报
     * @tc.desc: EntryAbility没有预连接，首页有Web组件，Web的aboutToAppear里有预连接，不需要上报
     */
    test('HomepagePrepareLoadTest_003', () => {
        const detectFile: string = path.join(realPath, 'ets', 'HomepagePrepareLoadNoReport2', 'ets', 'entryability', 'HomepagePrepareLoadNoReport.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile)));
        expect(detectFileReports.length).toBe(0);
    });

    /**
     * @tc.number: HomepagePrepareLoadTest_004
     * @tc.name: EntryAbility没有预连接，首页有Web组件，Web的onAppear里有预连接，不需要上报
     * @tc.desc: EntryAbility没有预连接，首页有Web组件，Web的onAppear里有预连接,不需要上报
     */
    test('HomepagePrepareLoadTest_004', () => {
        const detectFile: string = path.join(realPath, 'ets', 'HomepagePrepareLoadNoReport3', 'ets', 'entryability', 'HomepagePrepareLoadNoReport.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile)));
        expect(detectFileReports.length).toBe(0);
    });

    /**
     * @tc.number: HomepagePrepareLoadTest_005
     * @tc.name: EntryAbility没有预连接，首页有Web组件，Web的onPageEnd里有预连接，不需要上报
     * @tc.desc: EntryAbility没有预连接，首页有Web组件，Web的onPageEnd里有预连接，不需要上报
     */
    test('HomepagePrepareLoadTest_005', () => {
        const detectFile: string = path.join(realPath, 'ets', 'HomepagePrepareLoadNoReport4', 'ets', 'entryability', 'HomepagePrepareLoadNoReport.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile)));
        expect(detectFileReports.length).toBe(0);
    });

    /**
     * @tc.number: HomepagePrepareLoadTest_006
     * @tc.name: EntryAbility没有预连接，首页没有Web组件，不需要上报
     * @tc.desc: EntryAbility没有预连接，首页没有Web组件，不需要上报
     */
    test('HomepagePrepareLoadTest_006', () => {
        const detectFile: string = path.join(realPath, 'ets', 'HomepagePrepareLoadNoReport5', 'ets', 'entryability', 'HomepagePrepareLoadNoReport.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile)));
        expect(detectFileReports.length).toBe(0);
    });
})