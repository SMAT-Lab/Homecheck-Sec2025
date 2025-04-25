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
import { ArkFile } from "arkanalyzer";
import { BaseChecker } from "../checker/BaseChecker";
import { MatcherTypes } from "../matcher/Matchers";
import { matchFiles } from "../matcher/matcherAdapter/matchFiles";
import { matchNameSpaces } from "../matcher/matcherAdapter/matchNameSpaces";
import { matchClass } from "../matcher/matcherAdapter/matchClass";
import { matchMethods } from "../matcher/matcherAdapter/matchMethods";
import { matchFields } from "../matcher/matcherAdapter/matchFields";
import { FileUtils } from "../utils/common/FileUtils";
import { filterDisableIssue } from "../utils/common/Disable";
import Logger, { LOG_MODULE_TYPE } from "arkanalyzer/lib/utils/logger";
import { IssueReport } from "./Defects";

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'File2Check');

export class File2Check {
    public arkFile: ArkFile;
    public enabledRuleCheckerMap: Map<string, BaseChecker> = new Map();  // TODO: key改为枚举
    public issues: IssueReport[] = [];

    private flMatcherMap = new Map();
    private nsMatcherMap = new Map();
    private clsMatcherMap = new Map();
    private mtdMatcherMap = new Map();
    private fieldMatcherMap = new Map();

    constructor() {
    }

    public addChecker(ruleId: string, checker: BaseChecker) {
        this.enabledRuleCheckerMap.set(ruleId, checker);
    }

    public collectMatcherCallbacks() {
        this.enabledRuleCheckerMap.forEach(checker => {
            const matcherCallbacks = checker.registerMatchers();
            matcherCallbacks.forEach(obj => {
                const matcher = obj.matcher;
                const callback = obj.callback;
                switch (matcher?.matcherType) {
                    case MatcherTypes.FILE:
                        this.flMatcherMap.set(matcher, callback);
                        break;
                    case MatcherTypes.NAMESPACE:
                        this.nsMatcherMap.set(matcher, callback);
                        break;
                    case MatcherTypes.CLASS:
                        this.clsMatcherMap.set(matcher, callback);
                        break;
                    case MatcherTypes.METHOD:
                        this.mtdMatcherMap.set(matcher, callback);
                        break;
                    case MatcherTypes.FIELD:
                        this.fieldMatcherMap.set(matcher, callback);
                        break;
                }
            })
        });
    }

    public async emitCheck() {
        this.flMatcherMap.forEach((callback, matcher) => {
            matchFiles([this.arkFile], matcher, callback)
        });
        this.nsMatcherMap.forEach((callback, matcher) => {
            matchNameSpaces([this.arkFile], matcher, callback)
        });
        this.clsMatcherMap.forEach((callback, matcher) => {
            matchClass([this.arkFile], matcher, callback)
        });
        this.mtdMatcherMap.forEach((callback, matcher) => {
            matchMethods([this.arkFile], matcher, callback)
        });
        this.fieldMatcherMap.forEach((callback, matcher) => {
            matchFields([this.arkFile], matcher, callback)
        });
    }

    public collectIssues() {
        this.enabledRuleCheckerMap.forEach((v, k) => {
            this.issues.push(...(v.issues?.reduce((acc, cur) => {
                if (acc.some((item) => item.defect.mergeKey === cur.defect.mergeKey)) {
                    logger.debug('Skip the repeated issue, please check. issue.mergeKey = ' + cur.defect.mergeKey);
                } else {
                    acc.push(cur);
                }
                return acc;
            }, [] as IssueReport[])));
        });
    }

    public async checkDisable() {
        const fileLineList = await FileUtils.readLinesFromFile(this.arkFile.getFilePath());
        this.issues = filterDisableIssue(fileLineList, this.issues);
    }

    public async run() {
        this.collectMatcherCallbacks();
        await this.emitCheck();
        this.collectIssues();
        await this.checkDisable();
    }
}