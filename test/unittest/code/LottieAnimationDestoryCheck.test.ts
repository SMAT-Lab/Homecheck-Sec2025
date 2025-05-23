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
import { LottieAnimationDestoryCheck } from '../../../src/checker/performance/LottieAnimationDestoryCheck';
import { Rule } from '../../../src/Index';
import { ALERT_LEVEL } from '../../../src/model/Rule';
import { CheckEntry } from '../../../src/utils/common/CheckEntry';

let realPath: string = '';
let checkEntry: CheckEntry;

beforeAll(async () => {
    const testPath = './test/unittest/sample/LottieAnimationDestory';
    const rule: Rule = new Rule('@performance/lottie-animation-destroy-check', ALERT_LEVEL.SUGGESTION);
    checkEntry = await testCaseCheck(testPath, rule, CHECK_MODE.FILE2CHECK, LottieAnimationDestoryCheck);
    realPath = checkEntry.scene.getRealProjectDir();
})

describe('LottieAnimationDestoryCheckTest', () => {

    /**
     * @tc.number: LottieAnimationDestoryCheckTest_001
     * @tc.name: loadAnimation动画后没有销毁，需要上报
     * @tc.desc: loadAnimation动画后没有销毁，需要上报
     */
    test('LottieAnimationDestoryCheckTest_001', () => {
        const detectFile: string = path.join(realPath, 'ets', 'LottieAnimationDestoryReport0.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('38%28%33')));
        expect(detectFileReports?.length).toBe(1);
    });

    /**
     * @tc.number: LottieAnimationDestoryCheckTest_002
     * @tc.name: loadAnimation加载两个动画，但是调用一个animationitem销毁了动画
     * @tc.desc: loadAnimation加载两个动画，但是调用一个animationitem销毁了动画
     */
    test('LottieAnimationDestoryCheckTest_002', () => {
        const detectFile: string = path.join(realPath, 'ets', 'LottieAnimationDestoryReport1.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('70%16%26')));
        expect(detectFileReports?.length).toBe(1);
    });

    /**
     * @tc.number: LottieAnimationDestoryCheckTest_003
     * @tc.name: loadAnimation加载两个动画，只调用lottie销毁一个动画
     * @tc.desc: loadAnimation加载两个动画，只调用lottie销毁一个动画
     */
    test('LottieAnimationDestoryCheckTest_003', () => {
        const detectFile: string = path.join(realPath, 'ets', 'LottieAnimationDestoryReport2.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        let detectFileReports = file2Check?.issues.filter((issue) => (issue.defect.mergeKey.startsWith(detectFile))
            && (issue.defect.fixKey.includes('65%9%14')));
        expect(detectFileReports?.length).toBe(1);
    });

    /**
     * @tc.number: LottieAnimationDestoryCheckTest_004
     * @tc.name: loadAnimation动画后，通过animationItem销毁，不需要上报
     * @tc.desc: loadAnimation动画后，通过animationItem销毁，不需要上报
     */
    test('LottieAnimationDestoryCheckTest_004', () => {
        const detectFile: string = path.join(realPath, 'ets', 'LottieAnimationDestoryNoReport0.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        expect(file2Check?.issues.length).toBe(0);
    });

    /**
     * @tc.number: LottieAnimationDestoryCheckTest_005
     * @tc.name: loadAnimation动画后，通过lottie销毁，不需要上报
     * @tc.desc: loadAnimation动画后，通过lottie销毁，不需要上报
     */
    test('LottieAnimationDestoryCheckTest_005', () => {
        const detectFile: string = path.join(realPath, 'ets', 'LottieAnimationDestoryNoReport1.ets');
        let file2Check = checkEntry.fileChecks.find((f2check) => f2check.arkFile.getFilePath() === detectFile);
        expect(file2Check).toBeDefined();
        expect(file2Check?.issues.length).toBe(0);
    });
})