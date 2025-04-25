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

import { assert, beforeAll, describe, test } from "vitest";
import { PreferLiteralEnumMemberCheck } from "../../../src/checker/ArkTS-eslint/PreferLiteralEnumMemberCheck";
import { CHECK_MODE, testCaseCheck } from "./common/testCommon";
import path from "path";
import { Rule } from "../../../src/model/Rule";
import { CheckEntry } from "../../../src/utils/common/CheckEntry";
import { ALERT_LEVEL } from '../../../src/model/Rule';
let realPath: string = "";
let checkEntry: CheckEntry;
let rule: Rule;
beforeAll(async () => {
  rule = new Rule('@ArkTS-eslint/prefer-literal-enum-member-check', ALERT_LEVEL.ERROR);
  checkEntry = await testCaseCheck(
    "./test/unittest/sample/PreferLiteralEnumMember",
    rule,
    CHECK_MODE.FILE2CHECK,
    PreferLiteralEnumMemberCheck
  );
  realPath = checkEntry.scene.getRealProjectDir();
});

describe("PreferLiteralEnumMemberTest", () => {
  /**
   * @tc.number: PreferLiteralEnumMemberTest_001
   * @tc.name: 枚举类字面变量默认参数，上报
   * @tc.desc: 枚举类字面变量默认参数，上报
   */
  test("PreferLiteralEnumMemberTest_001",async () => {
    rule.option = [{allowBitwiseExpressions: true}]
    const detectFile: string = path.join(realPath, "ets", "enum1.ts");
    checkEntry = await testCaseCheck('./test/unittest/sample/PreferLiteralEnumMember', rule, CHECK_MODE.FILE2CHECK, PreferLiteralEnumMemberCheck);
    const expectReportList = ["17%3%","22%4%","25%3%","26%3%","28%3%","29%3%","31%3%","38%3%"];
            const detectFileReport = checkEntry.fileChecks.find(
              (fileCheck) => fileCheck.arkFile.getFilePath() === detectFile
            );
            assert.isDefined(detectFileReport, "The file path is error.");
            assert.equal(
              detectFileReport?.issues.length,
              expectReportList.length,
              "The number of reported line is different from the expected number of line."
            );
            detectFileReport?.issues.forEach((issue, index) => {
              assert.include(issue.defect.fixKey, expectReportList[index]);
            });
  });
});
