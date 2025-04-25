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
import { JsCodeCacheByInterceptionCheck } from '../../../src/checker/performance/JsCodeCacheByInterceptionCheck';
import { Rule } from '../../../src/Index';
import { ALERT_LEVEL } from '../../../src/model/Rule';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const testPath = './test/unittest/sample/JsCodeCacheByInterception';
    const rule: Rule = new Rule('@performance/js-code-cache-by-interception-check', ALERT_LEVEL.SUGGESTION);
    checkEntry = await testCaseCheck(testPath, rule, CHECK_MODE.FILE2CHECK, JsCodeCacheByInterceptionCheck, true);
    realPath = checkEntry.scene.getRealProjectDir();
})


describe('JsCodeCacheByInterceptionCheckTest', () => {

    /**
     * @tc.number: JsCodeCacheByInterceptionCheckTest_001
     * @tc.name: 拦截非js资源，非自定义协议，未设置ResponseDataID
     * @tc.desc: 拦截非js资源，非自定义协议，未设置ResponseDataID
     */
    test('JsCodeCacheByInterceptionCheckTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'JsCodeCacheByInterceptionCheckReport0.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('33%10%28')));
        expect(detectFileReports?.length).toBe(1);
    })

    /**
     * @tc.number: JsCodeCacheByInterceptionCheckTest_002
     * @tc.name: 拦截非js资源，自定义协议，开启codecache，未设置ResponseDataID
     * @tc.desc: 拦截非js资源，自定义协议，开启codecache，未设置ResponseDataID
     */
    test('JsCodeCacheByInterceptionCheckTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'JsCodeCacheByInterceptionCheckReport1.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('49%10%28')));
        expect(detectFileReports?.length).toBe(1);
    })

    /**
     * @tc.number: JsCodeCacheByInterceptionCheckTest_003
     * @tc.name: 拦截非js资源，自定义协议，设置ResponseDataID，未开启codecache
     * @tc.desc: 拦截非js资源，自定义协议，设置ResponseDataID，未开启codecache
     */
    test('JsCodeCacheByInterceptionCheckTest_003', () => {
        const detectFile: string = path.join(realPath, 'ets', 'JsCodeCacheByInterceptionCheckReport2.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('22%40%50')));
        expect(detectFileReports?.length).toBe(1);
    })

    /**
     * @tc.number: JsCodeCacheByInterceptionCheckTest_004
     * @tc.name: 拦截非js资源，非自定义协议，未设置ResponseDataID，跨多个scope语句组合场景
     * @tc.desc: 拦截非js资源，非自定义协议，未设置ResponseDataID，跨多个scope语句组合场景
     */
    test('JsCodeCacheByInterceptionCheckTest_004', () => {
        const detectFile: string = path.join(realPath, 'ets', 'JsCodeCacheByInterceptionCheckReport3.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('31%10%28')));
        expect(detectFileReports?.length).toBe(1);
    })

    /**
     * @tc.number: JsCodeCacheByInterceptionCheckTest_005
     * @tc.name: 拦截非js资源，自定义协议，开启codecache, response传参，调用链中未设置ResponseDataID
     * @tc.desc: 拦截非js资源，自定义协议，开启codecache, response传参，调用链中未设置ResponseDataID
     */
    test('JsCodeCacheByInterceptionCheckTest_005', () => {
        const detectFile: string = path.join(realPath, 'ets', 'JsCodeCacheByInterceptionCheckReport4.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('31%10%28')));
        expect(detectFileReports?.length).toBe(1);
    })

    /**
     * @tc.number: JsCodeCacheByInterceptionCheckTest_006
     * @tc.name: 拦截非js资源，自定义协议，开启codecache, request传参，调用链中未设置ResponseDataID
     * @tc.desc: 拦截非js资源，自定义协议，开启codecache, request传参，调用链中未设置ResponseDataID
     */
    test('JsCodeCacheByInterceptionCheckTest_006', () => {
        const detectFile: string = path.join(realPath, 'ets', 'JsCodeCacheByInterceptionCheckReport5.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('31%10%28')));
        expect(detectFileReports?.length).toBe(1);
    })

    /**
     * @tc.number: JsCodeCacheByInterceptionCheckTest_007
     * @tc.name: 拦截非js资源，非自定义协议，设置ResponseDataID
     * @tc.desc: 拦截非js资源，非自定义协议，设置ResponseDataID
     */
    test('JsCodeCacheByInterceptionCheckTest_007', () => {
        const detectFile: string = path.join(realPath, 'ets', 'JsCodeCacheByInterceptionCheckNoReport0.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        expect(file2Check?.issues.length).toBe(0);
    })

    /**
     * @tc.number: JsCodeCacheByInterceptionCheckTest_008
     * @tc.name: 拦截非js资源，自定义协议，开启codecache，设置ResponseDataID
     * @tc.desc: 拦截非js资源，自定义协议，开启codecache，设置ResponseDataID
     */
    test('JsCodeCacheByInterceptionCheckTest_008', () => {
        const detectFile: string = path.join(realPath, 'ets', 'JsCodeCacheByInterceptionCheckNoReport1.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        expect(file2Check?.issues.length).toBe(0);
    })

    /**
     * @tc.number: JsCodeCacheByInterceptionCheckTest_009
     * @tc.name: 拦截非js资源
     * @tc.desc: 拦截非js资源
     */
    test('JsCodeCacheByInterceptionCheckTest_009', () => {
        const detectFile: string = path.join(realPath, 'ets', 'JsCodeCacheByInterceptionCheckNoReport2.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        expect(file2Check?.issues.length).toBe(0);
    })
})