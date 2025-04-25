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
import Logger, { LOG_MODULE_TYPE } from "arkanalyzer/lib/utils/logger";
import { MatcherTypes } from "../matcher/Matchers";
import { matchFiles } from "../matcher/matcherAdapter/matchFiles";
import { matchNameSpaces } from "../matcher/matcherAdapter/matchNameSpaces";
import { matchClass } from "../matcher/matcherAdapter/matchClass";
import { matchMethods } from "../matcher/matcherAdapter/matchMethods";
import { matchFields } from "../matcher/matcherAdapter/matchFields";
import { FileUtils } from "../utils/common/FileUtils";
import { filterDisableIssue } from "../utils/common/Disable";
import { IssueReport } from "./Defects";
import { Rule } from "./Rule";

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'Project2Check');

export class Project2Check {
    public arkFiles: ArkFile[];
    public enabledRuleCheckerMap: Map<string, BaseChecker> = new Map();  // TODO: key改为枚举
    public issues: IssueReport[] = [];
    public ruleMap: Map<string, Rule[]> = new Map();

    private sceneCallBacks: Function[] = [];
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
                if (!matcher) {
                    this.sceneCallBacks.push(callback);
                    return;
                }
                switch (matcher.matcherType) {
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
                    default:
                        break;
                }
            })
        });
    }

    public async emitCheck() {
        await Promise.all(Array.from(this.enabledRuleCheckerMap.values()).map(checker => {
            try {
                this.processSceneCallbacks();
                this.flMatcherMap.forEach((callback, matcher) => {
                    matchFiles(this.arkFiles, matcher, callback)
                });
                this.nsMatcherMap.forEach((callback, matcher) => {
                    matchNameSpaces(this.arkFiles, matcher, callback)
                });
                this.clsMatcherMap.forEach((callback, matcher) => {
                    matchClass(this.arkFiles, matcher, callback)
                });
                this.mtdMatcherMap.forEach((callback, matcher) => {
                    matchMethods(this.arkFiles, matcher, callback)
                });
                this.fieldMatcherMap.forEach((callback, matcher) => {
                    matchFields(this.arkFiles, matcher, callback)
                });
            } catch (error) {
                logger.error(`Checker ${checker.rule.ruleId} error: `, error);
            }
        }));
    }

    private processSceneCallbacks(): void {
        try {
            this.sceneCallBacks.forEach((callback) => {
                if (this.arkFiles.length !== 0) {
                    callback(this.arkFiles[0].getScene());
                }
            });
        } catch (error) {
            logger.error(`Error in scene callbacks: `, error);
        }
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
        const issueMap: Map<string, IssueReport> = new Map();
        this.issues.forEach(issue => {
            issueMap.set(issue.defect.mergeKey, issue);
        });
        const issueCopyMap = new Map(issueMap);
        for (const [key, value] of issueCopyMap.entries()) {
            const index = value.defect.mergeKey.indexOf('%' + value.defect.fixKey);
            let filePath = '';
            if (index !== -1) {
                filePath = value.defect.mergeKey.slice(0, index);
            }
            if (!this.ruleMap.has(filePath)) {
                continue;
            }
            let rules = this.ruleMap.get(filePath);
            if (!rules) {
                continue;
            }
            let result = rules.find(rule => rule.ruleId === value.defect.ruleId);
            if (!result) {
                issueMap.delete(value.defect.mergeKey);
            } else {
                value.defect.severity = result.alert;
            }
        }
        this.issues = Array.from(issueMap.values());
    }

    public async checkDisable() {
        let filtedIssues: IssueReport[] = [];
        for (const issue of this.issues) {
            const filePath = issue.defect.mergeKey.split('%')[0];
            const fileLineList = await FileUtils.readLinesFromFile(filePath);
            const filtedResult = filterDisableIssue(fileLineList, [issue]);
            if (filtedResult.length > 0) {
                filtedIssues = filtedIssues.concat(filtedResult[0]);
            }
        }
        this.issues = filtedIssues;
    }

    public async run() {
        this.collectMatcherCallbacks();
        await this.emitCheck();
        this.collectIssues();
        await this.checkDisable();
    }
}