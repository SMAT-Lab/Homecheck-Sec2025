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
import { RequireArraySortCompareCheck } from "../../../src/checker/ArkTS-eslint/RequireArraySortCompareCheck";
import { CHECK_MODE, testCaseCheck } from "./common/testCommon";
import path from "path";
import { Rule } from "../../../src/model/Rule";
import { CheckEntry } from "../../../src/utils/common/CheckEntry";

let realPath: string = "";
let checkEntry: CheckEntry;

beforeAll(async () => {
  const rule: Rule = new Rule("");
  checkEntry = await testCaseCheck(
    "./test/unittest/sample/RequireArraySortCompare",
    rule,
    CHECK_MODE.FILE2CHECK,
    RequireArraySortCompareCheck
  );
  realPath = checkEntry.scene.getRealProjectDir();
});

describe("RequireArraySortCompareTest", () => {
  /**
   * @tc.number: PreferEnumInitializwersTest_001
   * @tc.name: sort函数使用是否正确，上报
   * @tc.desc: sort函数使用是否正确，上报
   */
  test("RequireArraySortCompareTest_001", () => {
    const detectFile: string = path.join(realPath, "ets", "defaultPass.ets");
    const detectFileReport = checkEntry.fileChecks.find(
      (fileCheck) => fileCheck.arkFile.getFilePath() === detectFile
    );
    assert.isDefined(detectFileReport, "The file path is error.");
    assert.equal(
      detectFileReport?.issues.length,
      detectFileReport?.issues.length,
      "require-array-sort-compare."
    );
    detectFileReport?.issues.forEach((issue, index) => {
      assert.include(issue.defect.fixKey, issue.defect.fixKey, "code:" + index);
    });
  });

  /**
   * @tc.number: PreferEnumInitializwersTest_002
   * @tc.name: sort函数使用是否正确，不上报
   * @tc.desc: sort函数使用是否正确，不上报
   */
  test("RequireArraySortCompareTest_002", () => {
    const detectFile: string = path
    .join(realPath, "ets", "defaultError.ets");
    const expectReportList = ["18%1%"];
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
  /**
   * @tc.number: PreferEnumInitializwersTest_002
   * @tc.name: sort函数使用是否正确-参数：ignoreStringArrays：true，允许string[]
   * @tc.desc: sort函数使用是否正确-参数：ignoreStringArrays：true，允许string[]
   */
  test("RequireArraySortCompareTest_003", () => {
    const detectFile: string = path.join(realPath, "ets", "params.ets");
    const expectReportList = ["20%1%"];
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
