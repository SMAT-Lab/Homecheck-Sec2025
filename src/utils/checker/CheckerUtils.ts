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
import { ArkAssignStmt, ArkInvokeStmt, Stmt } from 'arkanalyzer/lib/core/base/Stmt';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { AbstractInvokeExpr, ArkAwaitExpr } from 'arkanalyzer/lib/core/base/Expr';
import { Local } from 'arkanalyzer/lib/core/base/Local';
import path from 'path';
import { ArkClass, ArkFile, ArkInstanceFieldRef, FileSignature, Scene, Value } from 'arkanalyzer';
import { ScopeType, TempLocation } from '../../model/Scope';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'CheckUtils');

export class CheckerUtils {
    /**
     * 从给定的语句中获取调用表达式
     * @param stmt - 要处理的语句
     * @returns 如果找到调用表达式，则返回 AbstractInvokeExpr，否则返回 null
     */
    public static getInvokeExprFromStmt(stmt: Stmt): AbstractInvokeExpr | null {
        if (stmt instanceof ArkInvokeStmt) {
            return stmt.getInvokeExpr();
        } else if (stmt instanceof ArkAssignStmt) {
            const rightOp = stmt.getRightOp();
            if (rightOp instanceof AbstractInvokeExpr) {
                return rightOp;
            }
        }
        return null;
    }

    /**
     * 从给定的语句中获取调用表达式（Await）
     * @param stmt - 要处理的语句
     * @returns 如果找到调用表达式，则返回 AbstractInvokeExpr，否则返回 null
     */
    public static getInvokeExprFromAwaitStmt(stmt: Stmt): AbstractInvokeExpr | null {
        if (stmt instanceof ArkInvokeStmt) {
            return stmt.getInvokeExpr();
        } else if (stmt instanceof ArkAssignStmt) {
            let rightOp = stmt.getRightOp();
            if (rightOp instanceof AbstractInvokeExpr) {
                return rightOp;
            } else if (rightOp instanceof ArkAwaitExpr) {
                let promise = rightOp.getPromise();
                if (!(promise instanceof Local)) {
                    return null;
                }
                let declaringStmt = promise.getDeclaringStmt();
                if (!(declaringStmt instanceof ArkAssignStmt)) {
                    return null;
                }
                rightOp = declaringStmt.getRightOp();
                if (rightOp instanceof AbstractInvokeExpr) {
                    return rightOp;
                }
            }
        }
        return null;
    }

    /**
     * 获取语句的Scope类型
     * @param stmt 语句对象
     * @returns Scope类型
     */
    public static getScopeType(stmt: Stmt): ScopeType {
        const text = stmt.getOriginalText() ?? '';
        if (!text) {
            return ScopeType.UNKNOWN_TYPE;
        }
        if (text.startsWith('for (') || text.startsWith('for(')) {
            return ScopeType.FOR_CONDITION_TYPE;
        } else if (text.startsWith('while (') || text.startsWith('while(')) {
            return ScopeType.WHILE_TYPE;
        } else if (text.startsWith('if (') || text.startsWith('if(')) {
            return ScopeType.IF_TYPE;
        }
        return ScopeType.UNKNOWN_TYPE;
    }

    /**
     * 判断给定的语句是否是声明语句
     * @param defName - 要检查的变量名
     * @param stmt - 要检查的语句
     * @returns 如果语句是声明语句，则返回true，否则返回false
     */
    public static isDeclaringStmt(defName: string, stmt: Stmt): boolean {
        const text = stmt.getOriginalText() ?? '';
        if (text) {
            if (text.includes('let ' + defName) || text.includes('const ' + defName) ||
                text.includes('var ' + defName)) {
                const c = text[text.indexOf(' ' + defName) + defName.length + 1];
                if (c === ' ' || c === ':' || c === '=') {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * 获取语句中临时变量的位置
     * @param stmt 语句
     * @returns 临时变量的位置
     */
    public static wherIsTemp(stmt: Stmt): TempLocation {
        let def = stmt.getDef();
        if (def instanceof Local) {
            if (def.getName().includes('%')) {
                return TempLocation.LEFT;
            }
        }
        if (stmt instanceof ArkAssignStmt) {
            let right = stmt.getRightOp();
            if (right instanceof Local) {
                if (right.getName().includes('%')) {
                    return TempLocation.RIGHT;
                }
            }
        }
        return TempLocation.NOFOUND;
    }

    /**
     * 根据文件路径获取ArkFile对象
     * @param scene Scene
     * @param absolutePath 文件的绝对路径
     * @returns 返回对应的ArkFile对象，如果未找到则返回null
     */
    public static getArkFileByFilePath(scene: Scene, absolutePath: string): ArkFile | null {
        const relativePath = path.relative(scene.getRealProjectDir(), absolutePath);
        const fileSign = new FileSignature(scene.getProjectName(), relativePath);
        return scene.getFile(fileSign);
    }

    /**
     * 获取参数的右值
     * @param arg - 参数
     * @param arkClass - ArkClass对象
     * @returns Value | null - 返回参数的右值，如果不存在则返回null
     */
    public static getArgRight(arg: Value, arkClass: ArkClass): Value | null {
        if (!(arg instanceof Local)) {
            return arg;
        }
        let decStmt = arg.getDeclaringStmt();
        if (!(decStmt instanceof ArkAssignStmt)) {
            return null;
        }
        let rightOp = decStmt.getRightOp();
        if (!(rightOp instanceof ArkInstanceFieldRef)) {
            return rightOp;
        }
        let field = arkClass.getField(rightOp.getFieldSignature());
        if (!field) {
            return null;
        }
        for (let initializer of field.getInitializer()) {
            if (!(initializer instanceof ArkAssignStmt)) {
                continue;
            }
            return initializer.getRightOp();
        }
        return null;
    }
}