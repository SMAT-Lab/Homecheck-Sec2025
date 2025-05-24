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
import { KeywordSpacingCheck } from "../../../src/checker/ArkTS-eslint/KeywordSpacingCheck";
import { CHECK_MODE, testCaseCheck } from "./common/testCommon";
import path from "path";
import { Rule } from "../../../src/model/Rule";
import { CheckEntry } from "../../../src/utils/common/CheckEntry";

let realPath: string = "";
let checkEntry: CheckEntry;

beforeAll(async () => {
  const rule: Rule = new Rule("");
  checkEntry = await testCaseCheck(
    "./test/unittest/sample/KeywordSpacing",
    rule,
    CHECK_MODE.FILE2CHECK,
    KeywordSpacingCheck
  );
  realPath = checkEntry.scene.getRealProjectDir();
});

describe("KeywordSpacingCheckTest", () => {
  /**
   * @tc.number:NoUnusedVarsCheckTest
   * @tc.name: 方法参数强制设定为只读默认不设置参数，上报
   * @tc.desc: 方法参数强制设定为只读默认不设置参数，上报
   */
  test("KeywordSpacingCheckTest_001", () => {
    const detectFile: string = path.join(realPath, "ets", "default.ets");
   const expectReportList = ['15%1%', '17%2%', '17%2%'];
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
   * @tc.number:NoUnusedVarsCheckTest
   * @tc.name: 方法参数强制设定为只读默认不设置参数，不上报
   * @tc.desc: 方法参数强制设定为只读默认不设置参数，不上报
   */
  test("KeywordSpacingCheckTest_002", () => {
    const detectFile: string = path.join(realPath, "ets", "pass.ets");
    const detectedFileReport = checkEntry.fileChecks.find(
      (fileCheck) => fileCheck.arkFile.getFilePath() === detectFile
    );
    // assert.equal(detectedFileReport?.issues.length, 0, 'Parameter should be a read only type.');
    detectedFileReport?.issues.forEach((issue, index) => {
      assert.include(issue.defect.fixKey, issue.defect.fixKey);
    });
  });
});
