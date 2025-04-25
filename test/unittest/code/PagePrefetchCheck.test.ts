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
import { PagePrefetchCheck } from '../../../src/checker/performance/PagePrefetchCheck';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const testPath = './test/unittest/sample/PagePrefetch';
    const rule: Rule = new Rule('', ALERT_LEVEL.WARN);
    checkEntry = await testCaseCheck(testPath, rule, CHECK_MODE.PROJECT2CHECK, PagePrefetchCheck, true);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('PagePrefetchTest', () => {

    /**
     * @tc.number: PagePrefetchTest_001
     * @tc.name: 有Web组件，没有aboutToAppear、onAppear、onPageEnd方法
     * @tc.desc: 有Web组件，没有aboutToAppear、onAppear、onPageEnd方法
     */
    test('PagePrefetchTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'PagePrefetchReport1.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('15%7%9')));
        expect(detectFileReports.length).toBe(1);
    });

    /**
     * @tc.number: PagePrefetchTest_002
     * @tc.name: 有Web组件，有onPageEnd方法但方法里面没有预下载
     * @tc.desc: 有Web组件，有onPageEnd方法但方法里面没有预下载
     */
    test('PagePrefetchTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'PagePrefetchReport2.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('15%7%9')));
        expect(detectFileReports.length).toBe(1);
    });

    /**
     * @tc.number: PagePrefetchTest_003
     * @tc.name: 有Web组件，有onAppear方法但方法里面没有预下载
     * @tc.desc: 有Web组件，有onAppear方法但方法里面没有预下载
     */
    test('PagePrefetchTest_003', () => {
        const detectFile: string = path.join(realPath, 'ets', 'PagePrefetchReport3.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('15%7%9')));
        expect(detectFileReports.length).toBe(1);
    });

    /**
     * @tc.number: PagePrefetchTest_004
     * @tc.name: 有Web组件，有aboutToAppear方法但方法里面没有预下载
     * @tc.desc: 有Web组件，有aboutToAppear方法但方法里面没有预下载
     */
    test('PagePrefetchTest_004', () => {
        const detectFile: string = path.join(realPath, 'ets', 'PagePrefetchReport4.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('19%7%9')));
        expect(detectFileReports.length).toBe(1);
    });

    /**
     * @tc.number: PagePrefetchTest_005
     * @tc.name: 有Web组件，有在aboutToAppear/onAppear/onPageEnd里面做预下载，不需要上报
     * @tc.desc: 有Web组件，有在aboutToAppear/onAppear/onPageEnd里面做预下载，不需要上报
     */
    test('PagePrefetchTest_005', () => {
        const detectFile: string = path.join(realPath, 'ets', 'PagePrefetchNoReport1.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile)));
        expect(detectFileReports.length).toBe(0);
    });

    /**
     * @tc.number: PagePrefetchTest_006
     * @tc.name: 有Web组件，有在aboutToAppear/onAppear/onPageEnd里面做预下载，不需要上报
     * @tc.desc: 有Web组件，有在aboutToAppear/onAppear/onPageEnd里面做预下载，不需要上报
     */
    test('PagePrefetchTest_006', () => {
        const detectFile: string = path.join(realPath, 'ets', 'PagePrefetchNoReport2.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile)));
        expect(detectFileReports.length).toBe(0);
    });

    /**
     * @tc.number: PagePrefetchTest_007
     * @tc.name: 有Web组件，有在aboutToAppear/onAppear/onPageEnd里面做预下载，不需要上报
     * @tc.desc: 有Web组件，有在aboutToAppear/onAppear/onPageEnd里面做预下载，不需要上报
     */
    test('PagePrefetchTest_007', () => {
        const detectFile: string = path.join(realPath, 'ets', 'PagePrefetchNoReport3.ets');
        let detectFileReports = checkEntry.projectCheck.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile)));
        expect(detectFileReports.length).toBe(0);
    });
})