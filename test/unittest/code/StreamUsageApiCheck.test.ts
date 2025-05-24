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
import { StreamUsageApiCheck } from '../../../src/checker/performance/StreamUsageApiCheck';
import { Rule } from '../../../src/Index';
import { ALERT_LEVEL } from '../../../src/model/Rule';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const testPath = './test/unittest/sample/StreamUsageApi';
    const rule: Rule = new Rule('@performance/stream-usage-api-check', ALERT_LEVEL.SUGGESTION);
    checkEntry = await testCaseCheck(testPath, rule, CHECK_MODE.FILE2CHECK, StreamUsageApiCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('StreamUsageApiTest', () => {

    /**
     * @tc.number: StreamUsageApiTest_001
     * @tc.name: usage所在变量为局部变量，usage类型为STREAM_USAGE_UNKNOWN，需要上报
     * @tc.desc: usage所在变量为局部变量，usage类型为STREAM_USAGE_UNKNOWN，需要上报
     */
    test('StreamUsageApiTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'StreamUsageApiReport.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('26%5%9')));
        expect(detectFileReports?.length).toBe(1);
    });

    /**
     * @tc.number: StreamUsageApiTest_002
     * @tc.name: usage所在变量为成员变量，usage类型为STREAM_USAGE_UNKNOWN，需要上报
     * @tc.desc: usage所在变量为成员变量，usage类型为STREAM_USAGE_UNKNOWN，需要上报
     */
    test('StreamUsageApiTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'StreamUsageApiReport2.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('26%5%9')));
        expect(detectFileReports?.length).toBe(1);
    });

    /**
     * @tc.number: StreamUsageApiTest_003
     * @tc.name: usage所在变量为全局变量，usage类型为STREAM_USAGE_UNKNOWN，需要上报
     * @tc.desc: usage所在变量为全局变量，usage类型为STREAM_USAGE_UNKNOWN，需要上报
     */
    test('StreamUsageApiTest_003', () => {
        const detectFile: string = path.join(realPath, 'ets', 'StreamUsageApiReport3.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('25%3%7')));
        expect(detectFileReports?.length).toBe(1);
    });

    /**
     * @tc.number: StreamUsageApiTest_004
     * @tc.name: usage所在变量为局部变量，usage类型为STREAM_USAGE_MUSIC，不需要上报
     * @tc.desc: usage所在变量为局部变量，usage类型为STREAM_USAGE_MUSIC，不需要上报
     */
    test('StreamUsageApiTest_004', () => {
        const detectFile: string = path.join(realPath, 'ets', 'StreamUsageApiNoReport.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        expect(file2Check?.issues.length).toBe(0);
    });

    /**
     * @tc.number: StreamUsageApiTest_005
     * @tc.name: usage所在变量为成员变量，usage类型为STREAM_USAGE_NAVIGATION，不需要上报
     * @tc.desc: usage所在变量为成员变量，usage类型为STREAM_USAGE_NAVIGATION，不需要上报
     */
    test('StreamUsageApiTest_005', () => {
        const detectFile: string = path.join(realPath, 'ets', 'StreamUsageApiNoReport2.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        expect(file2Check?.issues.length).toBe(0);
    });

    /**
     * @tc.number: StreamUsageApiTest_006
     * @tc.name: usage所在变量为全局变量，usage类型为STREAM_USAGE_NAVIGATION，不需要上报
     * @tc.desc: usage所在变量为全局变量，usage类型为STREAM_USAGE_NAVIGATION，不需要上报
     */
    test('StreamUsageApiTest_006', () => {
        const detectFile: string = path.join(realPath, 'ets', 'StreamUsageApiNoReport3.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        expect(file2Check?.issues.length).toBe(0);
    });
})