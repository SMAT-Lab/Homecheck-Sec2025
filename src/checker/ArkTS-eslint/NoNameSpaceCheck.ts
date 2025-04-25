/*
 * Copyright (c) 2025 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  ArkFile,
  ArkNamespace
} from 'arkanalyzer';
import { Rule } from '../../model/Rule';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Defects, IssueReport } from '../../model/Defects';
import {
  FileMatcher,
  MatcherCallback,
  MatcherTypes,
} from '../../matcher/Matchers';
import { RuleListUtil } from '../../utils/common/DefectsList';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'NoNameSpaceCheck');
export type Options = [
  {
    allowDeclarations?: boolean;
    allowDefinitionFiles?: boolean;
  },
];

type NameSpaceData = {
  line: number,
  col: number,
  isDeclare: boolean,
  text: string,
};

export class NoNameSpaceCheck implements BaseChecker {
  issues: IssueReport[] = [];
  private defaultOptions: Options = [
    {
      allowDeclarations: false,
      allowDefinitionFiles: true,
    },
  ];
  public rule: Rule;
  public defects: Defects[] = [];

  public metaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: 'docs/no-namespace-check.md',
    description: 'ES2015 module syntax is preferred over namespaces.',
  };

  private fileMatcher: FileMatcher = {
    matcherType: MatcherTypes.FILE,
  };

  public registerMatchers(): MatcherCallback[] {
    const matchFileCb: MatcherCallback = {
      matcher: this.fileMatcher,
      callback: this.check
    }
    return [matchFileCb];
  }

  public check = (target: ArkFile) => {
    if (target) {
      const filePath = target.getFilePath();
      let map: Map<string, NameSpaceData> = new Map();
      if (filePath.endsWith(".ts")) {
        const namespaces = target.getAllNamespacesUnderThisFile()
        namespaces.forEach(namespace => {
          this.executeCheck(namespace, target, false, map);
        })

        this.excuteReport(map, target);
      }
    }
  };

  private excuteReport(map: Map<string, NameSpaceData>, target: ArkFile) : void {
    map.forEach(v => {
      if (!v.isDeclare || !this.getOption()[0].allowDeclarations) {
        const col = v.text.startsWith('export ') ? v.col + 7 : v.col;
        this.addIssueReport(target, v.line, col);
      }
    });
  }

  private executeCheck(namespaces: ArkNamespace, target: ArkFile, parentIsDeclare: boolean, map: Map<string, NameSpaceData>) : void {

    const codes = namespaces.getCodes();
    const lineCols = namespaces.getLineColPairs();
    const innerNamespaces = namespaces.getNamespaces();
    for (let j = 0; j < codes.length; j++) {
      const line = lineCols[j][0];
      const col = lineCols[j][1];
      const key: string = `${line}:${col}`;
      const value: NameSpaceData = {
        line: line, col: col, isDeclare: false, text: codes[j]
      };

      let str = codes[j].trim();
      const index = str.indexOf('{');
      let name = '';
      if (index < 0) {
        if (str.endsWith(';')) {
          name = str.substring(0, str.length - 1).trim();
        } else {
          name = str;
        }
      } else {
        name = str.substring(0, str.indexOf('{')).trim();
      }
      if (!name.endsWith(`'`) && !name.endsWith('global')) {
        value.isDeclare = this.isDeclare(str) || parentIsDeclare;
        if (!map.has(key) || !map.get(key)?.isDeclare) {
          map.set(key, value);
        }
      }
      this.checkChild(innerNamespaces, line, codes, j, lineCols, target, str, parentIsDeclare, map);
    }
  }

  private checkChild(
    innerNamespaces: ArkNamespace[], 
    line: number, 
    codes: string[], 
    j: number, 
    lineCols: [number, number][], 
    target: ArkFile, 
    str: string, 
    parentIsDeclare: 
    boolean, 
    map: Map<string, NameSpaceData>
  ) : void {
    innerNamespaces.forEach((innerNamespace, index) => {
      const lcs = innerNamespace.getLineColPairs();
      const l = lcs[0][0];
      if (l >= line) {
        this.checkLine(codes, j, lineCols, index, l, innerNamespace, target, str, parentIsDeclare, map);
      }
    });
  }

  private checkLine(
    codes: string[], 
    j: number, 
    lineCols: [number, number][], 
    index: number, 
    l: number, 
    innerNamespace: ArkNamespace, 
    target: ArkFile, 
    str: string, 
    parentIsDeclare: boolean, 
    map: Map<string, NameSpaceData>
  ) : void {
    const isNotLast = codes.length - 1 > j;
    if (isNotLast) {
      const lastl = lineCols[index + 1][0];
      if (l < lastl) {
        this.executeCheck(innerNamespace, target, this.isDeclare(str) || parentIsDeclare, map);
      }
    } else {
      this.executeCheck(innerNamespace, target, this.isDeclare(str) || parentIsDeclare, map);
    }
  }

  private isDeclare(str: string) : boolean {
    return str.startsWith('declare') || str.startsWith('export declare');
  }

  private addIssueReport(target: ArkFile, line: number, col: number,) {
    const severity = this.rule.alert ?? this.metaData.severity;
    const defect = new Defects(
      line,
      col,
      col,
      this.metaData.description,
      severity,
      this.rule.ruleId,
      target.getFilePath(),
      this.metaData.ruleDocPath,
      true,
      false,
      false
    );
    this.issues.push(new IssueReport(defect, undefined));
    RuleListUtil.push(defect);
  }

  private getOption(): Options {
    let option: Options;
    if (this.rule && this.rule.option) {
      option = this.rule.option as Options;
      if (option[0]) {
        if (!option[0]?.allowDeclarations) {
          option[0].allowDeclarations = false;
        }
        if (!option[0]?.allowDefinitionFiles) {
          option[0].allowDefinitionFiles = true;
        }
        return option;
      }
    }
    return this.defaultOptions;
  }
}