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
import { CHECK_MODE, testCaseCheck } from "./common/testCommon";
import path from "path";
import { Rule } from '../../../src/model/Rule';
import {CheckEntry} from "../../../src/utils/common/CheckEntry";
import { NoUnsafeFinallyCheck } from "../../../src/checker/ArkTS-eslint/NoUnsafeFinallyCheck";

let realPath: string = "";
let checkEntry: CheckEntry;

beforeAll(async () => {
  const rule: Rule = new Rule("");
  checkEntry = await testCaseCheck(
    "./test/unittest/sample/NoUnsafeFinally",
    rule,
    CHECK_MODE.FILE2CHECK,
    NoUnsafeFinallyCheck
  );
  realPath = checkEntry.scene.getRealProjectDir();
});

describe("NoUnsafeFinallyCheckTest", () => {
  test("NoUnsafeFinallyTest_001", () => {
    const detectFile: string = path.join(
      realPath,
      "ets",
      "NoUnsafeFinallyNoReport.ets"
    );
    const detectFileReport = checkEntry.fileChecks.find(
      (fileCheck) => fileCheck.arkFile.getFilePath() === detectFile
    );
    // 这个数组中包含了所有测试用例中的finnally块中break/continue/return/throw所在位置
    const expectReportList: string[] = [
      "22%5",
      "25%94",
      "25%112",
      "27%83",
      "29%83",
      "31%83",
      "33%79",
      "35%88",
      "37%67",
      "45%5",
      "49%62",
      "51%62",
      "53%76",
      "55%92", 
      "57%92",
      "59%106"
    ];
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

  test("NoUnsafeFinallyTest_002", () => {
    const detectFile: string = path.join(
      realPath,
      "ets",
      "NoUnsafeFinallyReport.ets"
    );
    const detectedFileReport = checkEntry.fileChecks.find(
      (fileCheck) => fileCheck.arkFile.getFilePath() === detectFile
    );
    assert.equal(
      detectedFileReport?.issues.length,
      0,
      "The number of reported line should be 0."
    );
  });
});
