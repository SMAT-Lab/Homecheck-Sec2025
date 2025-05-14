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

import { ArkAssignStmt, ArkInstanceInvokeExpr, ArkMethod, ArkNewExpr, ArkStaticFieldRef, ClassSignature, ClassType, Local, Stmt, Value } from 'arkanalyzer/lib';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { CheckerUtils, Defects, MatcherCallback, MatcherTypes, MethodMatcher, Rule } from '../../Index';
import { NumberConstant } from 'arkanalyzer/lib/core/base/Constant';
import { IssueReport } from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'ImagePixelFormatCheck');
const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: 'docs/image-pixel-format-check.md',
    description: 'Exercise caution when using the RGB_565 format, which can result in unexpected color banding.'
};

export class ImagePixelFormatCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    readonly CREATEPIXELMAP: string = 'createPixelMap';
    readonly INITIALIZATIONOPTIONS: string = 'InitializationOptions';
    readonly DECODINGOPTIONS: string = 'DecodingOptions';
    readonly PIXELFORMAT: string = 'pixelFormat';
    readonly DESIREDPIXELFORMAT: string = 'desiredPixelFormat';
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    private mtdMatcher: MethodMatcher = {
        matcherType: MatcherTypes.METHOD,
    };

    public registerMatchers(): MatcherCallback[] {
        const matchMethodCb: MatcherCallback = {
            matcher: this.mtdMatcher,
            callback: this.check
        };
        return [matchMethodCb];
    }

    public check = (target: ArkMethod): void => {
        const stmts = target.getCfg()?.getStmts() ?? [];
        for (const stmt of stmts) {
            this.stmtProcess(stmt);
        }
    };

    private stmtProcess(stmt: Stmt): void {
        const invoker = CheckerUtils.getInvokeExprFromStmt(stmt);
        const methodSignature = invoker?.getMethodSignature();
        if (!methodSignature) {
            return;
        }
        const methodSubSignature = methodSignature.getMethodSubSignature();
        const interfaceName = methodSubSignature.getMethodName() ?? '';
        if (interfaceName !== this.CREATEPIXELMAP) {
            return;
        }
        const args = invoker?.getArgs();
        if (!args || args.length === 0) {
            return;
        }

        const createPixelMapParameterTypes = methodSubSignature.getParameterTypes();
        for (let index = 0; index < createPixelMapParameterTypes.length; index++) {
            const createPixelMapParameterType = createPixelMapParameterTypes[index];
            if (createPixelMapParameterType instanceof ClassType) {
                const parameterTypeClassName = createPixelMapParameterType.getClassSignature().getClassName();
                const createPixelMapArg = args[index];
                const firstArgStmt = args[0];
                if (parameterTypeClassName === this.INITIALIZATIONOPTIONS || parameterTypeClassName === this.DECODINGOPTIONS) {
                    this.argProcess(createPixelMapArg, firstArgStmt, stmt);
                }
            }
        }
    }

    private argProcess(createPixelMapArg: Value, firstArgStmt: Value, stmt: Stmt): void {
        if (createPixelMapArg instanceof Local) {
            const argStmt = createPixelMapArg.getDeclaringStmt();
            if (argStmt instanceof ArkAssignStmt) {
                const rightOp = argStmt.getRightOp();
                if (rightOp instanceof ArkNewExpr) {
                    const newClassSignature = rightOp.getClassType().getClassSignature();
                    this.newExperProcess(newClassSignature, stmt);
                } else if (rightOp instanceof Local) {
                    this.argProcess(rightOp, firstArgStmt, stmt);
                } else if (rightOp instanceof ArkInstanceInvokeExpr) {
                    this.arkInstanceInvokeExprProcess(rightOp, firstArgStmt, stmt);
                }
            }
        }
    }

    private newExperProcess(newClassSignature: ClassSignature, stmt: Stmt): void {
        const newClass = stmt.getCfg().getDeclaringMethod().getDeclaringArkFile().getScene().getClass(newClassSignature);
        const pixelFormatField = newClass?.getFieldWithName(this.PIXELFORMAT) ?? newClass?.getFieldWithName(this.DESIREDPIXELFORMAT);
        if (pixelFormatField === null || pixelFormatField === undefined) {
            return;
        }
        const initializerStmts = pixelFormatField.getInitializer();
        if (initializerStmts.length === 0) {
            return;
        }
        const initializerStmt = initializerStmts[initializerStmts.length - 1];
        if (!(initializerStmt instanceof ArkAssignStmt)) {
            return;
        }
        const initRightOp = initializerStmt.getRightOp();
        if (initRightOp instanceof NumberConstant && initRightOp.getValue() === '2') {
            this.addIssueReport(stmt);
        } else if (initRightOp instanceof Local) {
            const initDeclaringStmt = initRightOp.getDeclaringStmt();
            if (initDeclaringStmt instanceof ArkAssignStmt) {
                const initAssignRightOp = initDeclaringStmt.getRightOp();
                if (initAssignRightOp instanceof ArkStaticFieldRef && initAssignRightOp.getFieldName() === 'RGB_565') {
                    this.addIssueReport(stmt);
                }
            }
        }
    }

    private arkInstanceInvokeExprProcess(rightOp: ArkInstanceInvokeExpr, firstArgStmt: Value, stmt: Stmt): void {
        const returnType = rightOp.getMethodSignature().getMethodSubSignature().getReturnType();
        if (returnType instanceof ClassType && returnType.getClassSignature().getClassName() === this.DECODINGOPTIONS) {
            const arkMethod = stmt.getCfg().getDeclaringMethod().getDeclaringArkClass().getMethod(rightOp.getMethodSignature());
            const decodingOptionsStmts = arkMethod?.getCfg()?.getStmts() ?? [];
            for (const decodingOptionsStmt of decodingOptionsStmts) {
                if (decodingOptionsStmt instanceof ArkAssignStmt) {
                    this.arkAssignStmtProcess(decodingOptionsStmt, firstArgStmt, stmt);
                }
            }
        }
    }

    private arkAssignStmtProcess(decodingOptionsStmt: ArkAssignStmt, firstArgStmt: Value, stmt: Stmt): void {
        const decodingOptionsLeftOp = decodingOptionsStmt.getLeftOp();
        const decodingOptionsRightOp = decodingOptionsStmt.getRightOp();
        if (decodingOptionsLeftOp instanceof Local && decodingOptionsRightOp instanceof Local) {
            const leftType = decodingOptionsLeftOp.getType();
            const rightType = decodingOptionsRightOp.getType();
            if (leftType instanceof ClassType && rightType instanceof ClassType) {
                const leftClass = leftType.getClassSignature();
                const rightClass = rightType.getClassSignature();
                if (leftClass.getClassName() === this.DECODINGOPTIONS) {
                    this.newExperProcess(rightClass, stmt);
                }
            }
        }
    }

    private addIssueReport(stmt: Stmt): void {
        const severity = this.rule.alert ?? this.metaData.severity;
        const warnInfo = this.getLineAndColumn(stmt);
        if (warnInfo) {
            let defects = new Defects(warnInfo.line, warnInfo.startCol, warnInfo.endCol, this.metaData.description, severity, this.rule.ruleId,
                warnInfo.filePath, this.metaData.ruleDocPath, true, false, false);
            this.issues.push(new IssueReport(defects, undefined));
        }
    }

    private getLineAndColumn(stmt: Stmt): {
        line: number;
        startCol: number;
        endCol: number;
        filePath: string;
    } {
        const arkFile = stmt.getCfg()?.getDeclaringMethod().getDeclaringArkFile();
        const originPosition = stmt.getOriginPositionInfo();
        if (arkFile && originPosition) {
            const line = originPosition?.getLineNo();
            const originalText = stmt.getOriginalText() ?? '';
            const startCol = originPosition.getColNo() + originalText.indexOf(this.CREATEPIXELMAP);
            const endCol = startCol + this.CREATEPIXELMAP.length;
            const originPath = arkFile.getFilePath();
            return { line, startCol, endCol, filePath: originPath };
        } else {
            logger.debug('ArkFile is null.');
        }
        return { line: -1, startCol: -1, endCol: -1, filePath: '' };
    }
}