/*
 * Copyright (c) 2025 Huawei Device Co., Ltd.
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

import {assert, beforeAll, describe, test} from "vitest";
import {NoUnsafeMemberAccessCheck} from "../../../src/checker/ArkTS-eslint/NoUnsafeMemberAccessCheck";
import {CHECK_MODE, testCaseCheck} from "./common/testCommon";
import path from "path";
import {Rule} from "../../../src/model/Rule";
import {CheckEntry} from "../../../src/utils/common/CheckEntry";

let realPath: string = "";
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule("");
    checkEntry = await testCaseCheck(
        "./test/unittest/sample/NoUnsafeMemberAccess",
        rule,
        CHECK_MODE.FILE2CHECK,
        NoUnsafeMemberAccessCheck
    );
    realPath = checkEntry.scene.getRealProjectDir();
});

describe("NoUnsafeMemberAccessTest", () => {
    /**
     * @tc.number: NoUnsafeMemberAccessTest_001
     * @tc.name: 成员访问任何类型为 any 的变量，上报
     * @tc.desc: 成员访问任何类型为 any 的变量，上报
     */
    test("NoUnsafeMemberAccessTest_001", () => {
        const detectFile: string = path.join(realPath, "ts", "NoUnsafeMemberAccessReport.ts");
        const expectReportList = ['19%12%', '20%12%', '21%12%', '22%12%', '24%20%', '25%20%', '28%20%', '32%5%', '33%15%'];
        const detectFileReport = checkEntry.fileChecks.find(
            (fileCheck) => fileCheck.arkFile.getFilePath() === detectFile
        );
        assert.isDefined(detectFileReport, "The file path is error.");
        assert.equal(detectFileReport?.issues.length, expectReportList.length, 'The number of reported line is different from the expected number of line.');
        detectFileReport?.issues.forEach((issue, index) => {
            assert.include(issue.defect.fixKey, expectReportList[index]);
        });
    });

    /**
     * @tc.number: NoUnsafeMemberAccessTest_002
     * @tc.name: 成员访问任何类型为 any 的变量，不上报
     * @tc.desc: 成员访问任何类型为 any 的变量，不上报
     */
    test("NoUnsafeMemberAccessTest_002", () => {
        const detectFile: string = path.join(realPath, "ts", "NoUnsafeMemberAccessNoReport.ts");
        const detectedFileReport = checkEntry.fileChecks.find(
            (fileCheck) => fileCheck.arkFile.getFilePath() === detectFile
        );
        assert.equal(
            detectedFileReport?.issues.length,
            0,
            "Suggestion: NoUselessConstructor."
        );
    });
});
