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
import {NoThrowLiteralCheck} from "../../../src/checker/ArkTS-eslint/NoThrowLiteralCheck";
import {CHECK_MODE, testCaseCheck} from "./common/testCommon";
import path from "path";
import {Rule} from "../../../src/model/Rule";
import {CheckEntry} from "../../../src/utils/common/CheckEntry";

let realPath: string = "";
let checkEntry: CheckEntry;

beforeAll(async () => {
    const rule: Rule = new Rule("");
    checkEntry = await testCaseCheck(
        "./test/unittest/sample/NoThrowLiteral",
        rule,
        CHECK_MODE.FILE2CHECK,
        NoThrowLiteralCheck
    );
    realPath = checkEntry.scene.getRealProjectDir();
});

describe("NoThrowLiteralTest", () => {
    /**
     * @tc.number: NoThrowLiteralTest_001
     * @tc.name: 禁止抛出不可能是 Error 对象，上报
     * @tc.desc: 禁止抛出不可能是 Error 对象，上报
     */
    test("NoThrowLiteralTest_001", () => {
        const detectFile: string = path.join(realPath, "ets", "NoThrowLiteralReport.ets");
        const expectReportList = ['16%7', '18%7', '20%7', '22%7', '25%7', '28%7', '31%7', '36%7', '41%7'];
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
     * @tc.number: NoThrowLiteralTest_002
     * @tc.name: 禁止抛出不可能是 Error 对象，不上报
     * @tc.desc: 禁止抛出不可能是 Error 对象，不上报
     */
    test("NoThrowLiteralTest_002", () => {
        const detectFile: string = path.join(realPath, "ets", "NoThrowLiteralNoReport.ets");
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
