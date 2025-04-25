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
import { BasicBlock } from "arkanalyzer";
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { Variable } from "./Variable";

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'Scope');

export enum TempLocation {
    NOFOUND = 0,
    LEFT,
    RIGHT
}

export enum ScopeType {
    IF_TYPE = 0,
    ELSE_TYPE,
    FOR_CONDITION_TYPE,
    FOR_IN_TYPE,
    WHILE_TYPE,
    CASE_TYPE,
    UNKNOWN_TYPE = 10
}

export class Scope {
    parentScope: Scope | null;
    childScopeList: Array<Scope>;
    defList: Array<Variable>;
    blocks: Set<BasicBlock>;
    scopeLevel: number;
    scopeType: ScopeType;

    constructor(parent: Scope | null, defList: Array<Variable>, level: number, type: ScopeType = ScopeType.UNKNOWN_TYPE) {
        this.parentScope = parent;
        this.childScopeList = new Array<Scope>();
        this.defList = defList;
        this.blocks = new Set<BasicBlock>();
        this.scopeLevel = level;
        this.scopeType = type;
    }

    public setChildScope(child: Scope): void {
        this.childScopeList.push(child);
    }

    public addVariable(variable: Variable): void {
        this.defList.push(variable);
    }
}