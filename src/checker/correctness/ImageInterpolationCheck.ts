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

import { ArkAssignStmt, ArkClass, ArkFile, ArkInstanceFieldRef, ArkStaticFieldRef, ClassSignature, FieldSignature, Local, Stmt } from 'arkanalyzer/lib';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { CheckerUtils, Defects, FileMatcher, MatcherCallback, MatcherTypes, Rule } from '../../Index';
import { IssueReport } from '../../model/Defects';

const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'ImageInterpolationCheck');
const gMetaData: BaseMetaData = {
    severity: 1,
    ruleDocPath: 'docs/image-interpolation-check.md',
    description: 'Exercise caution when applying ImageInterpolation.None, which may cause significant aliasing.'
};

export class ImageInterpolationCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gMetaData;
    readonly NONE: string = 'None';
    readonly IMAGE: string = 'ImageAttribute';
    readonly INTERPOLATION: string = 'interpolation';
    readonly ABOUTTOAPPEAR: string = 'aboutToAppear';
    readonly IMAGEINTERPOLATION: string = 'ImageInterpolation';
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];

    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE
    };

    public registerMatchers(): MatcherCallback[] {
        const matchFileCb: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check
        };
        return [matchFileCb];
    }


    public check = (arkFile: ArkFile): void => {
        if (arkFile.getFilePath().endsWith('.ets')) {
            for (let clazz of arkFile.getClasses()) {
                this.classProcess(clazz);
            }
            for (let namespace of arkFile.getAllNamespacesUnderThisFile()) {
                for (let clazz of namespace.getClasses()) {
                    this.classProcess(clazz);
                }
            }
        }
    };

    private classProcess(clazz: ArkClass): void {
        for (let method of clazz.getMethods()) {
            const stmts = method.getCfg()?.getStmts() ?? [];
            for (const stmt of stmts) {
                this.stmtProcess(stmt);
            }
        }
    }

    private stmtProcess(stmt: Stmt): void {
        const invoker = CheckerUtils.getInvokeExprFromStmt(stmt);
        const declaringClassName = invoker?.getMethodSignature().getDeclaringClassSignature().getClassName() ?? '';
        const interfaceName = invoker?.getMethodSignature().getMethodSubSignature().getMethodName() ?? '';
        if (interfaceName !== this.INTERPOLATION || declaringClassName !== this.IMAGE) {
            return;
        }
        const args = invoker?.getArgs();
        if (!args || args.length === 0) {
            return;
        }
        const interProlationArg = args[0];
        if (interProlationArg instanceof Local) {
            const argStmt = interProlationArg.getDeclaringStmt();
            if (argStmt instanceof ArkAssignStmt) {
                const rightOp = argStmt.getRightOp();
                if (rightOp instanceof ArkStaticFieldRef) {
                    this.staticFieldRefProcess(rightOp, stmt);
                } else if (rightOp instanceof ArkInstanceFieldRef) {
                    this.instanceFieldRefProcess(rightOp, stmt);
                }
            }
        }
    }

    private staticFieldRefProcess(rightOp: ArkStaticFieldRef, stmt: Stmt): void {
        const fieldName = rightOp.getFieldName();
        const className = rightOp.getFieldSignature().getBaseName();
        if (fieldName === this.NONE && className === this.IMAGEINTERPOLATION) {
            this.addIssueReport(stmt);
        }
    }

    private instanceFieldRefProcess(rightOp: ArkInstanceFieldRef, stmt: Stmt): void {
        const fieldSignature = rightOp.getFieldSignature();
        let hasImageInterpolationAssignment = false;
        const base = rightOp.getBase();
        const usedStmts = base.getUsedStmts();
        for (const usedStmt of usedStmts) {
            if (usedStmt instanceof ArkAssignStmt) {
                hasImageInterpolationAssignment = this.usedStmtProcess(usedStmt, fieldSignature, stmt);
                if (hasImageInterpolationAssignment) {
                    break;
                }
            }
        }
        if (!hasImageInterpolationAssignment) {
            const aboutToAppear = stmt.getCfg().getDeclaringMethod().getDeclaringArkClass().getMethodWithName(this.ABOUTTOAPPEAR);
            const stmts = aboutToAppear?.getBody()?.getCfg().getStmts() ?? [];
            for (const aboutToAppearStmt of stmts) {
                hasImageInterpolationAssignment = this.aboutToAppearStmtProcess(fieldSignature, aboutToAppearStmt, stmt);
                if (hasImageInterpolationAssignment) {
                    break;
                }
            }
            if (!hasImageInterpolationAssignment) {
                const initField = aboutToAppear?.getDeclaringArkClass().getFieldWithName(fieldSignature.getFieldName());
                if (initField === null || initField === undefined) {
                    return;
                }
                for (const initStmt of initField.getInitializer()) {
                    this.initStmtProcess(initStmt, stmt, fieldSignature);
                }
            }
        }
    }

    private usedStmtProcess(usedStmt: ArkAssignStmt, fieldSignature: FieldSignature, stmt: Stmt): boolean {
        const usedLeftOp = usedStmt.getLeftOp();
        const usedRightOp = usedStmt.getRightOp();
        if (usedRightOp instanceof Local && usedLeftOp instanceof ArkInstanceFieldRef && fieldSignature === usedLeftOp.getFieldSignature()) {
            const arkArkAssignStmt = usedRightOp.getDeclaringStmt();
            if (arkArkAssignStmt instanceof ArkAssignStmt) {
                return this.arkAssignStmtProcess(arkArkAssignStmt, stmt);
            }
        } else if (usedRightOp instanceof ArkInstanceFieldRef && usedLeftOp instanceof Local && fieldSignature === usedRightOp.getFieldSignature()) {
            const arkArkAssignStmt = usedLeftOp.getDeclaringStmt();
            if (arkArkAssignStmt instanceof ArkAssignStmt) {
                return this.arkAssignStmtProcess(arkArkAssignStmt, stmt);
            }
        }
        return false;
    }

    private aboutToAppearStmtProcess(fieldSignature: FieldSignature, aboutToAppearStmt: Stmt, stmt: Stmt): boolean {
        if (!(aboutToAppearStmt instanceof ArkAssignStmt)) {
            return false;
        }
        const aboutToAppearLeftOp = aboutToAppearStmt.getLeftOp();
        if (aboutToAppearLeftOp instanceof ArkInstanceFieldRef && aboutToAppearLeftOp.getFieldSignature() === fieldSignature) {
            const aboutToAppearRightOp = aboutToAppearStmt.getRightOp();
            if (aboutToAppearRightOp instanceof Local) {
                const rightOpDeclaringStmt = aboutToAppearRightOp.getDeclaringStmt();
                if (rightOpDeclaringStmt && rightOpDeclaringStmt instanceof ArkAssignStmt) {
                    this.arkAssignStmtProcess(rightOpDeclaringStmt, stmt);
                }
            }
            return true;
        }
        return false;
    }

    private initStmtProcess(initStmt: Stmt, stmt: Stmt, fieldSignature: FieldSignature): boolean {
        if (initStmt instanceof ArkAssignStmt) {
            const initLeftOp = initStmt.getLeftOp();
            const initRightOp = initStmt.getRightOp();
            if (initRightOp instanceof Local && initLeftOp instanceof ArkInstanceFieldRef && initLeftOp.getFieldSignature() === fieldSignature) {
                const initDeclaringStmt = initRightOp.getDeclaringStmt();
                if (initDeclaringStmt instanceof ArkAssignStmt) {
                    this.arkAssignStmtProcess(initDeclaringStmt, stmt);
                }
                return true;
            }
        }
        return false;
    }

    private arkAssignStmtProcess(rightOpDeclaringStmt: ArkAssignStmt, stmt: Stmt): boolean {
        const aboutToAppearDeclaringStmtRight = rightOpDeclaringStmt.getRightOp();
        if (!(aboutToAppearDeclaringStmtRight instanceof ArkStaticFieldRef)) {
            return false;
        }
        const aboutToAppearDeclaringStmtRightField = aboutToAppearDeclaringStmtRight.getFieldSignature();
        const classDeclaringSignature1 = aboutToAppearDeclaringStmtRightField.getDeclaringSignature();
        if (classDeclaringSignature1 instanceof ClassSignature) {
            const imageInterpolationClassName1 = classDeclaringSignature1.getClassName();
            if (imageInterpolationClassName1 === this.IMAGEINTERPOLATION) {
                if (aboutToAppearDeclaringStmtRightField.getFieldName() === this.NONE) {
                    this.addIssueReport(stmt);
                }
                return true;
            }
        }
        return false;
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
        const originPosition = stmt.getOperandOriginalPosition(stmt.getDefAndUses().length - 1);
        if (arkFile && originPosition) {
            let line = originPosition?.getFirstLine();
            let endCol = originPosition?.getFirstCol() - 1;
            let startCol = endCol - this.INTERPOLATION.length;
            const originPath = arkFile.getFilePath();
            return { line, startCol, endCol, filePath: originPath };

        } else {
            logger.debug('ArkFile is null.');
        }
        return { line: -1, startCol: -1, endCol: -1, filePath: '' };
    }
}