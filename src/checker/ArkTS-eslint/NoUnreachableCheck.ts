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

import {
    ArkFile,
    AstTreeUtils,
    ts,
} from 'arkanalyzer';
import { Rule } from '../../Index';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Defects } from '../../Index';
import {
    FileMatcher,
    MatcherCallback,
    MatcherTypes,
} from '../../Index';
import { RuleListUtil } from "../../utils/common/DefectsList";
import { IssueReport } from "../../model/Defects";

interface MessageInfo {
    line: number;
    character: number;
    endCol: number;
    message: string;
}

export class NoUnreachableCheck implements BaseChecker {
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    public metaData: BaseMetaData = {
        severity: 2,
        ruleDocPath: 'docs/no-unreachable.md',
        description: 'Disallow unreachable code after `return`, `throw`, `continue`, and `break` statements',
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

    // 处理控制流语句
    private checkControlFlowStatement(node: ts.Node, sourceFile: ts.SourceFile, errors: MessageInfo[]): void {
        const nextStatement = this.findNextStatement(node);
        if (nextStatement && !ts.isFunctionDeclaration(nextStatement)) {
            this.checkNextStatementAfterControlFlow(nextStatement, node, sourceFile, errors);
        }
    }

    // 检查控制流语句后的下一个语句
    private checkNextStatementAfterControlFlow(nextStatement: ts.Statement,
        node: ts.Node,
        sourceFile: ts.SourceFile,
        errors: MessageInfo[]): void {
        if (!this.isVarDeclarationStmt(nextStatement)) {
            this.addControlFlowError(nextStatement, node, sourceFile, errors);
        }
    }

    // 添加控制流相关的错误
    private addControlFlowError(statement: ts.Statement,
        node: ts.Node,
        sourceFile: ts.SourceFile,
        errors: MessageInfo[]): void {
        this.addUnreachableError(statement, sourceFile, errors);
    }

    private checkUnreachableCode(targetField: ArkFile): MessageInfo[] {
        const sourceFile = AstTreeUtils.getSourceFileFromArkFile(targetField);
        const errors: MessageInfo[] = [];
        this.visitAST(sourceFile, sourceFile, errors);
        return errors;
    }

    // 预处理箭头函数，查找其中的不可达代码
    private preprocessArrowFunctions(node: ts.Node, sourceFile: ts.SourceFile, errors: MessageInfo[]): void {
        // 非箭头函数直接遍历子节点
        if (!ts.isArrowFunction(node)) {
            ts.forEachChild(node, child => this.preprocessArrowFunctions(child, sourceFile, errors));
            return;
        }

        // 处理箭头函数的主体
        this.processArrowFunctionBody(node, sourceFile, errors);

        // 继续遍历子节点
        ts.forEachChild(node, child => this.preprocessArrowFunctions(child, sourceFile, errors));
    }

    // 处理箭头函数的主体
    private processArrowFunctionBody(node: ts.ArrowFunction, sourceFile: ts.SourceFile, errors: MessageInfo[]): void {
        // 处理块语句形式的箭头函数体
        if (ts.isBlock(node.body)) {
            this.processArrowFunctionBlockBody(node.body, sourceFile, errors);
            return;
        }

        // 处理简写形式的箭头函数体
        if (ts.isConditionalExpression(node.body)) {
            this.preprocessConditionalExpression(node.body, sourceFile, errors);
        }
    }

    // 处理块语句形式的箭头函数体
    private processArrowFunctionBlockBody(body: ts.Block, sourceFile: ts.SourceFile, errors: MessageInfo[]): void {
        const statements = body.statements;

        for (let i = 0; i < statements.length; i++) {
            const currentStatement = statements[i];

            // 处理 switch 语句
            if (ts.isSwitchStatement(currentStatement)) {
                this.checkSwitchStatementInArrowFunction(currentStatement, i, statements, sourceFile, errors);
            }

            // 检查其他控制流终止语句
            this.checkControlFlowTerminationInArrowFunction(currentStatement, i, statements, sourceFile, errors);
        }
    }

    // 检查箭头函数中的 switch 语句
    private checkSwitchStatementInArrowFunction(
        switchStmt: ts.Statement,
        index: number,
        statements: ts.NodeArray<ts.Statement>,
        sourceFile: ts.SourceFile,
        errors: MessageInfo[]
    ): void {
        if (!ts.isSwitchStatement(switchStmt)) {
            return;
        }

        // 检查 switch 语句是否有终止控制流的 default 分支
        const hasTerminatingDefault = this.hasSwitchTerminatingDefault(switchStmt as ts.SwitchStatement);

        // 如果没有终止控制流或没有后续语句，直接返回
        if (!hasTerminatingDefault || index + 1 >= statements.length) {
            return;
        }

        // 检查后续语句
        const nextStmt = statements[index + 1];
        this.checkUnreachableStatementAfterSwitch(nextStmt, sourceFile, errors);
    }

    // 检查 switch 语句是否有终止控制流的 default 分支
    private hasSwitchTerminatingDefault(switchStmt: ts.SwitchStatement): boolean {
        return switchStmt.caseBlock.clauses.some(clause => {
            return clause.kind === ts.SyntaxKind.DefaultClause &&
                clause.statements.some(stmt =>
                    ts.isThrowStatement(stmt) || ts.isReturnStatement(stmt)
                );
        });
    }

    // 检查 switch 语句后的不可达语句
    private checkUnreachableStatementAfterSwitch(
        nextStmt: ts.Statement,
        sourceFile: ts.SourceFile,
        errors: MessageInfo[]
    ): void {
        // 检查后续语句是否是空语句（分号）或简单的表达式语句
        if (!this.isUnreachableStatementCandidate(nextStmt)) {
            return;
        }

        // 添加不可达代码的错误
        this.addUnreachableErrorForStatement(nextStmt, sourceFile, errors);
    }

    // 判断语句是否是潜在的不可达语句
    private isUnreachableStatementCandidate(stmt: ts.Statement): boolean {
        return ts.isEmptyStatement(stmt) ||
            (ts.isExpressionStatement(stmt) &&
                (stmt.expression.kind === ts.SyntaxKind.SemicolonToken ||
                    ts.isIdentifier(stmt.expression)));
    }

    // 检查控制流终止语句
    private checkControlFlowTerminationInArrowFunction(
        currentStatement: ts.Statement,
        index: number,
        statements: ts.NodeArray<ts.Statement>,
        sourceFile: ts.SourceFile,
        errors: MessageInfo[]
    ): void {
        // 如果不是控制流终止语句或没有后续语句，直接返回
        if (!this.isControlFlowTerminated(currentStatement) || index + 1 >= statements.length) {
            return;
        }

        // 获取下一个语句
        const nextStmt = statements[index + 1];

        // 如果是允许出现在控制流终止后的语句，直接返回
        if (this.isVarDeclarationStmt(nextStmt) || ts.isFunctionDeclaration(nextStmt)) {
            return;
        }

        // 添加不可达代码的错误
        this.addUnreachableErrorForStatement(nextStmt, sourceFile, errors);
    }

    // 为语句添加不可达错误
    private addUnreachableErrorForStatement(stmt: ts.Statement, sourceFile: ts.SourceFile, errors: MessageInfo[]): void {
        this.addUnreachableError(stmt, sourceFile, errors);
    }

    private visitAST(node: ts.Node, sourceFile: ts.SourceFile, errors: MessageInfo[]): void {
        if (!node) {
            return;
        }
        this.processNodeByType(node, sourceFile, errors);
        ts.forEachChild(node, child => this.visitAST(child, sourceFile, errors));
    }

    private processNodeByType(node: ts.Node, sourceFile: ts.SourceFile, errors: MessageInfo[]): void {
        // 新增条件表达式检查
        if (ts.isIfStatement(node)) {
            this.checkConditionalExpression(node.expression, sourceFile, errors, node);
        }
        if (this.isControlFlowEndingStatement(node)) {
            this.checkControlFlowStatement(node, sourceFile, errors);
        }
        this.checkOtherNodeTypes(node, sourceFile, errors);
    }

    private isControlFlowEndingStatement(node: ts.Node): boolean {
        return ts.isReturnStatement(node) ||
            ts.isThrowStatement(node) ||
            ts.isBreakStatement(node) ||
            ts.isContinueStatement(node);
    }

    private checkOtherNodeTypes(node: ts.Node, sourceFile: ts.SourceFile, errors: MessageInfo[]): void {
        if (ts.isForStatement(node) && !node.condition) {
            this.checkInfiniteForLoop(node, sourceFile, errors);
        }
        else if (ts.isSwitchStatement(node)) {
            this.checkSwitchStatement(node, sourceFile, errors);
        }
        else if (ts.isIfStatement(node)) {
            this.checkIfStatement(node, sourceFile, errors);
        }
        else if (this.isFunctionNode(node)) {
            this.checkFunctionBody(node, sourceFile, errors);
        }
        else if (ts.isClassDeclaration(node)) {
            this.checkClassDeclaration(node, sourceFile, errors);
        }
        else if (ts.isSourceFile(node) && !ts.isClassDeclaration(node)) {
            this.checkSourceFileStatements(node, sourceFile, errors);
        }
        else if (this.isLoopNode(node)) {
            this.checkLoopStatement(node, sourceFile, errors);
        }
        else if (ts.isTryStatement(node)) {
            this.checkTryStatement(node, sourceFile, errors);
        }
    }

    private isFunctionNode(node: ts.Node): node is ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction {
        return ts.isFunctionDeclaration(node) ||
            ts.isFunctionExpression(node) ||
            ts.isArrowFunction(node);
    }

    private isLoopNode(node: ts.Node): node is ts.WhileStatement | ts.ForStatement | ts.DoStatement {
        return ts.isWhileStatement(node) ||
            ts.isForStatement(node) ||
            ts.isDoStatement(node);
    }

    private checkInfiniteForLoop(node: ts.ForStatement, sourceFile: ts.SourceFile, errors: MessageInfo[]): void {
        const nextStatement = this.findNextStatement(node);
        if (nextStatement &&
            !ts.isFunctionDeclaration(nextStatement) &&
            this.isControlFlowTerminated(nextStatement)) {
            this.addUnreachableCodeError(nextStatement, node, sourceFile, errors);
        }
    }

    // 修改 isFunctionBodyTerminated 方法，直接检测 return 语句的存在
    private isFunctionBodyTerminated(body: ts.Node): boolean {
        if (ts.isBlock(body)) {
            return body.statements.some(stmt => ts.isReturnStatement(stmt));
        }
        // 处理箭头函数简写形式中的 return 语句
        return ts.isReturnStatement(body);
    }

    // 增强条件表达式检查逻辑
    private checkConditionalExpression(
        expr: ts.Expression,
        sourceFile: ts.SourceFile,
        errors: MessageInfo[],
        ifStmt: ts.IfStatement
    ): void {
        // 处理 IIFE 场景（立即执行函数）
        if (ts.isCallExpression(expr)) {
            const func = this.unwrapParentheses(expr.expression);
            if ((ts.isFunctionExpression(func) || ts.isArrowFunction(func)) &&
                this.isFunctionBodyTerminated(func.body)
            ) {
                this.markIfBlockUnreachable(ifStmt.thenStatement, sourceFile, errors);
            }
        }
        // 处理函数声明作为条件的场景
        else if (ts.isFunctionExpression(expr) || ts.isArrowFunction(expr)) {
            if (this.isFunctionBodyTerminated(expr.body)) {
                this.markIfBlockUnreachable(ifStmt.thenStatement, sourceFile, errors);
            }
        }
    }

    // 辅助方法：解开括号包裹的表达式
    private unwrapParentheses(node: ts.Node): ts.Node {
        while (ts.isParenthesizedExpression(node)) {
            node = node.expression;
        }
        return node;
    }

    // 精确标记代码块起始位置
    private markIfBlockUnreachable(
        thenStmt: ts.Statement,
        sourceFile: ts.SourceFile,
        errors: MessageInfo[]
    ): void {
        if (!ts.isBlock(thenStmt)) {
            return;
        }

        // 获取代码块起始大括号的位置
        const openBrace = thenStmt.getFirstToken();
        if (openBrace?.kind === ts.SyntaxKind.OpenBraceToken) {
            const { line, character } = sourceFile.getLineAndCharacterOfPosition(openBrace.getStart());
            errors.push({
                line: line + 1,
                character: character + 1,
                endCol: character + 1 + 1, // 精确到 '{' 的位置
                message: 'Unreachable code'
            });
        }
    }

    private addUnreachableCodeError(
        statement: ts.Statement,
        node: ts.Node,
        sourceFile: ts.SourceFile,
        errors: MessageInfo[]
    ): void {
        this.addUnreachableError(statement, sourceFile, errors);
    }

    // 处理 if 语句
    private checkIfStatement(node: ts.IfStatement, sourceFile: ts.SourceFile, errors: MessageInfo[]): void {
        const thenTerminated = this.isControlFlowTerminated(node.thenStatement);
        const elseTerminated = node.elseStatement ? this.isControlFlowTerminated(node.elseStatement) : false;

        // 如果 if 和 else 都终止了控制流，则检查后续代码
        if (thenTerminated && elseTerminated) {
            this.checkNextStatementAfterIf(node, sourceFile, errors);
        }
    }

    // 检查 if 语句之后的代码
    private checkNextStatementAfterIf(node: ts.IfStatement, sourceFile: ts.SourceFile, errors: MessageInfo[]): void {
        const nextStatement = this.findNextStatement(node);
        if (nextStatement && !ts.isFunctionDeclaration(nextStatement)) {
            this.addUnreachableError(nextStatement, sourceFile, errors);
        }
    }

    // 添加不可达错误
    private addUnreachableError(node: ts.Node, sourceFile: ts.SourceFile, errors: MessageInfo[]): void {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        errors.push({
            line: line + 1,
            character: character + 1,
            endCol: character + 1 + node.getText().length,
            message: 'Unreachable code'
        });
    }

    // 检查源文件中的语句
    private checkSourceFileStatements(node: ts.SourceFile, sourceFile: ts.SourceFile, errors: MessageInfo[]): void {
        // 快速退出条件：如果全部是switch语句或特定表达式语句，则直接返回
        if (this.isOnlySwitchOrSimpleExpressions(node) && node.statements.length > 0) {
            return;
        }
        let isUnreachable = false;
        let reportedFirstInSequence = false;
        let afterClassDeclaration = false;
        // 遍历源文件中的所有语句
        for (let i = 0; i < node.statements.length; i++) {
            const currentStatement = node.statements[i];
            // 跳过导出语句
            if (this.isExportStatement(currentStatement)) {
                continue;
            }
            // 处理已标记为不可达的代码
            if (isUnreachable) {
                const result = this.processUnreachableStatement(
                    currentStatement,
                    reportedFirstInSequence,
                    afterClassDeclaration,
                    sourceFile,
                    errors
                );
                reportedFirstInSequence = result.reportedFirstInSequence;
                afterClassDeclaration = result.afterClassDeclaration;
                continue;
            }
            // 忽略 switch 语句和紧随 switch 语句之后的语句
            if (this.shouldSkipStatement(currentStatement, i, node)) {
                continue;
            }
            // 检查是否为流程终止语句，并更新不可达标记
            if (this.isFlowTerminatingStatement(currentStatement)) {
                isUnreachable = true;
                reportedFirstInSequence = false;
                afterClassDeclaration = false;
            }
        }
    }

    // 检查是否全部是switch语句或简单表达式
    private isOnlySwitchOrSimpleExpressions(node: ts.SourceFile): boolean {
        return node.statements.every(stmt =>
            ts.isSwitchStatement(stmt) ||
            (ts.isExpressionStatement(stmt) && ts.isIdentifier(stmt.expression)) ||
            ts.isEmptyStatement(stmt)
        );
    }

    // 检查是否应该跳过当前语句
    private shouldSkipStatement(statement: ts.Statement, index: number, node: ts.SourceFile): boolean {
        return ts.isSwitchStatement(statement) ||
            (index > 0 && ts.isSwitchStatement(node.statements[index - 1]));
    }

    // 检查是否为终止流程的语句
    private isFlowTerminatingStatement(statement: ts.Statement): boolean {
        return this.isControlFlowTerminated(statement) && !ts.isSwitchStatement(statement);
    }

    // 处理已标记为不可达的语句
    private processUnreachableStatement(
        statement: ts.Statement,
        reportedFirstInSequence: boolean,
        afterClassDeclaration: boolean,
        sourceFile: ts.SourceFile,
        errors: MessageInfo[]
    ): { reportedFirstInSequence: boolean, afterClassDeclaration: boolean } {
        // 函数声明在任何位置都是可达的
        if (ts.isFunctionDeclaration(statement)) {
            return {
                reportedFirstInSequence: false,
                afterClassDeclaration: false
            };
        }
        // 已经报告过错误或空语句，无需再次报告
        if (reportedFirstInSequence || ts.isEmptyStatement(statement)) {
            return {
                reportedFirstInSequence,
                afterClassDeclaration
            };
        }
        // 类声明后的变量声明/表达式语句被认为是可达的
        if (afterClassDeclaration && this.isStatementAfterClass(statement)) {
            return {
                reportedFirstInSequence,
                afterClassDeclaration: false
            };
        }
        // 报告不可达代码错误
        this.reportUnreachableStatement(statement, sourceFile, errors);
        return {
            reportedFirstInSequence: true,
            afterClassDeclaration: false
        };
    }

    // 检查是否为类声明后的特殊语句
    private isStatementAfterClass(statement: ts.Statement): boolean {
        return ts.isVariableStatement(statement) || ts.isExpressionStatement(statement);
    }

    // 报告不可达语句错误
    private reportUnreachableStatement(statement: ts.Statement, sourceFile: ts.SourceFile, errors: MessageInfo[]): void {
        this.addUnreachableError(statement, sourceFile, errors);
    }

    // 检查函数体
    private checkFunctionBody(node: ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction,
        sourceFile: ts.SourceFile,
        errors: MessageInfo[]): void {
        const body = node.body;

        // 处理 body 为 undefined 的情况（例如函数声明没有函数体）
        if (!body) {
            return;
        }

        // 处理箭头函数的简写形式（例如 `() => expr`）
        if (!ts.isBlock(body)) {
            // 如果函数体是表达式，则不需要检查不可达代码
            return;
        }

        this.checkFunctionStatements(body, sourceFile, errors);
    }

    // 检查函数体中的语句
    private checkFunctionStatements(body: ts.Block,
        sourceFile: ts.SourceFile,
        errors: MessageInfo[]): void {
        for (let i = 0; i < body.statements.length; i++) {
            const currentStatement = body.statements[i];

            // 检查无限for循环中是否包含break语句
            if (ts.isForStatement(currentStatement) && !currentStatement.condition) {
                if (this.infiniteForLoopHasBreak(currentStatement)) {
                    continue; // 跳过含有break的无限循环
                }
            }

            if (currentStatement && this.isControlFlowTerminated(currentStatement)) {
                // 如果当前语句终止了控制流，检查下一条语句是否不可达
                this.checkNextFunctionStatement(currentStatement, sourceFile, errors);
            }
        }
    }

    // 检查无限循环是否包含break语句
    private infiniteForLoopHasBreak(node: ts.ForStatement): boolean {
        if (!ts.isBlock(node.statement)) {
            return ts.isBreakStatement(node.statement);
        }

        let hasBreak = false;
        function visit(node: ts.Node): void {
            if (ts.isBreakStatement(node)) {
                hasBreak = true;
                return;
            }
            if (!hasBreak) {
                ts.forEachChild(node, visit);
            }
        }

        ts.forEachChild(node.statement, visit);
        return hasBreak;
    }

    // 检查函数中的下一条语句
    private checkNextFunctionStatement(currentStatement: ts.Statement,
        sourceFile: ts.SourceFile,
        errors: MessageInfo[]): void {
        const nextStatement = this.findNextStatement(currentStatement);
        if (nextStatement &&
            !ts.isEmptyStatement(nextStatement) &&
            !ts.isFunctionDeclaration(nextStatement) &&
            !this.isVarDeclarationStmt(nextStatement)) {
            this.addUnreachableError(nextStatement, sourceFile, errors);
        }
    }

    // 处理循环语句
    private checkLoopStatement(node: ts.WhileStatement | ts.ForStatement | ts.DoStatement,
        sourceFile: ts.SourceFile,
        errors: MessageInfo[]): void {
        const body = ts.isForStatement(node) ? node.statement : node.statement;
        if (ts.isBlock(body)) {
            this.checkLoopBody(body, node, sourceFile, errors);
        }
    }

    // 检查循环体
    private checkLoopBody(body: ts.Block,
        node: ts.WhileStatement | ts.ForStatement | ts.DoStatement,
        sourceFile: ts.SourceFile,
        errors: MessageInfo[]): void {
        let isUnreachable = false;
        for (const statement of body.statements) {
            // 标记不可达代码
            if (isUnreachable) {
                this.checkUnreachableLoopStatement(statement, sourceFile, errors, node);
            }
            // 判断是否中断循环控制流
            if (this.isBreakOrContinue(statement) || this.isControlFlowTerminated(statement)) {
                isUnreachable = true;
            }
        }
    }

    // 检查循环中不可达的语句
    private checkUnreachableLoopStatement(statement: ts.Statement,
        sourceFile: ts.SourceFile,
        errors: MessageInfo[],
        node: ts.Node): void {
        if (!this.isVarDeclarationStmt(statement)) {
            this.addUnreachableError(statement, sourceFile, errors);
        }
    }

    // 处理类声明
    private checkClassDeclaration(node: ts.ClassDeclaration, sourceFile: ts.SourceFile, errors: MessageInfo[]): void {
        const classMembers = node.members;
        // 检查是否有继承关系
        const hasExtends = this.checkClassExtends(node);

        // 只有在有继承关系的情况下才检查构造函数中的 super() 调用
        if (hasExtends) {
            this.checkClassConstructor(classMembers, node, sourceFile, errors);
        }
    }

    // 检查类是否有继承关系
    private checkClassExtends(node: ts.ClassDeclaration): boolean {
        return node.heritageClauses?.some(clause =>
            clause.token === ts.SyntaxKind.ExtendsKeyword
        ) ?? false;
    }

    // 检查类的构造函数
    private checkClassConstructor(classMembers: ts.NodeArray<ts.ClassElement>,
        node: ts.ClassDeclaration,
        sourceFile: ts.SourceFile,
        errors: MessageInfo[]): void {
        const constructorE = classMembers.find(member => ts.isConstructorDeclaration(member));
        if (constructorE) {
            // 检查构造函数是否调用了 super()
            const hasSuperCall = this.hasSuperCallInConstructor(constructorE);
            if (!hasSuperCall) {
                this.checkUnreachableInstanceFields(classMembers, node, sourceFile, errors);
            }
        }
    }

    // 检查不可达的实例字段
    private findConstructorIndex(classMembers: ts.NodeArray<ts.ClassElement>): number {
        for (let i = 0; i < classMembers.length; i++) {
            if (ts.isConstructorDeclaration(classMembers[i])) {
                return i;
            }
        }
        return -1;
    }

    private isStaticProperty(member: ts.ClassElement): boolean {
        return ts.isPropertyDeclaration(member) &&
            !!member.modifiers?.some(mod => mod.kind === ts.SyntaxKind.StaticKeyword);
    }

    private isInstanceProperty(member: ts.ClassElement): boolean {
        return ts.isPropertyDeclaration(member) &&
            !member.modifiers?.some(mod => mod.kind === ts.SyntaxKind.StaticKeyword);
    }

    private reportUnreachableField(member: ts.PropertyDeclaration, sourceFile: ts.SourceFile, errors: MessageInfo[]): void {
        this.addUnreachableError(member, sourceFile, errors);
    }

    private checkFieldsInRange(
        classMembers: ts.NodeArray<ts.ClassElement>,
        startIndex: number,
        endIndex: number,
        sourceFile: ts.SourceFile,
        errors: MessageInfo[]
    ): void {
        let currentGroup = 0;
        let lastReportedGroup = -1;

        for (let i = startIndex; i < endIndex; i++) {
            const member = classMembers[i];
            if (this.isStaticProperty(member)) {
                currentGroup++;
                continue;
            }
            if (this.isInstanceProperty(member) && lastReportedGroup !== currentGroup) {
                this.reportUnreachableField(member as ts.PropertyDeclaration, sourceFile, errors);
                lastReportedGroup = currentGroup;
            }
        }
    }

    private checkUnreachableInstanceFields(
        classMembers: ts.NodeArray<ts.ClassElement>,
        node: ts.ClassDeclaration,
        sourceFile: ts.SourceFile,
        errors: MessageInfo[]
    ): void {
        const constructorIndex = this.findConstructorIndex(classMembers);
        this.checkFieldsInRange(classMembers, 0, constructorIndex === -1 ? classMembers.length : constructorIndex, sourceFile, errors);
        if (constructorIndex !== -1) {
            this.checkFieldsInRange(classMembers, constructorIndex + 1, classMembers.length, sourceFile, errors);
        }
    }

    private checkTryStatement(node: ts.TryStatement, sourceFile: ts.SourceFile, errors: MessageInfo[]): void {
        const tryBlock = node.tryBlock;
        const catchClause = node.catchClause;
        const finallyBlock = node.finallyBlock;

        // 检查 try 块中的控制流终止
        if (tryBlock && this.isControlFlowTerminated(tryBlock)) {
            // 如果 try 块中只包含 throw 语句，catch 块是可达的
            if (!this.hasOnlyThrowStatement(tryBlock)) {
                // 检查是否在异步函数中
                if (this.isInAsyncFunction(node)) {
                    // 在异步函数中，catch块始终是可达的，跳过报告错误
                } else {
                    this.checkCatchBlockReachability(catchClause, node, sourceFile, errors);
                }
            }
            this.checkNextStatementAfterTry(node, sourceFile, errors);
        }
        // 如果 finally 块存在，检查其中的代码
        if (finallyBlock) {
            this.checkFinallyBlock(finallyBlock, node, sourceFile, errors);
        }
    }

    // 检查节点是否在异步函数中
    private isInAsyncFunction(node: ts.Node): boolean {
        let current: ts.Node | undefined = node;
        while (current) {
            if ((ts.isFunctionDeclaration(current) ||
                ts.isFunctionExpression(current) ||
                ts.isArrowFunction(current) ||
                ts.isMethodDeclaration(current)) &&
                current.modifiers?.some(mod => mod.kind === ts.SyntaxKind.AsyncKeyword)) {
                return true;
            }
            current = current.parent;
        }
        return false;
    }

    // 检查是否只包含 throw 语句
    private hasOnlyThrowStatement(block: ts.Block): boolean {
        let hasThrow = false;
        let hasOtherTerminator = false;
        const checkStatement = (statement: ts.Statement): void => {
            if (ts.isThrowStatement(statement)) {
                hasThrow = true;
            } else if (this.isControlFlowTerminated(statement) && !ts.isThrowStatement(statement)) {
                hasOtherTerminator = true;
            }
        };

        // 检查块中的每个语句
        for (const statement of block.statements) {
            if (ts.isBlock(statement)) {
                // 如果是嵌套块，递归检查
                for (const nestedStatement of statement.statements) {
                    checkStatement(nestedStatement);
                }
            } else {
                checkStatement(statement);
            }
        }

        // 只有当存在 throw 语句且没有其他终止语句时返回 true
        return hasThrow && !hasOtherTerminator;
    }

    // 检查 catch 块的可达性
    private checkCatchBlockReachability(catchClause: ts.CatchClause | undefined, node: ts.TryStatement,
        sourceFile: ts.SourceFile, errors: MessageInfo[]): void {
        if (catchClause && catchClause.block) {
            this.addUnreachableError(catchClause.block, sourceFile, errors);
        }
    }

    // 检查 try 语句之后的代码
    private checkNextStatementAfterTry(node: ts.TryStatement, sourceFile: ts.SourceFile, errors: MessageInfo[]): void {
        const nextStatement = this.findNextStatement(node);
        if (nextStatement && !ts.isFunctionDeclaration(nextStatement)) {
            this.addUnreachableError(nextStatement, sourceFile, errors);
        }
    }

    // 检查 finally 块
    private checkFinallyBlock(finallyBlock: ts.Block, node: ts.TryStatement,
        sourceFile: ts.SourceFile, errors: MessageInfo[]): void {
        // 检查 finally 块中的代码是否会导致之后的代码不可达
        if (this.isControlFlowTerminated(finallyBlock)) {
            const nextStatement = this.findNextStatement(node);
            if (nextStatement && !ts.isFunctionDeclaration(nextStatement)) {
                this.addUnreachableError(nextStatement, sourceFile, errors);
            }
        }
    }

    private checkSwitchStatement(node: ts.SwitchStatement, sourceFile: ts.SourceFile, errors: MessageInfo[]): void {
        // 检查 case 内部的代码是否存在不可达代码
        for (const caseClause of node.caseBlock.clauses) {
            let isCaseUnreachable = false;
            for (let i = 0; i < caseClause.statements.length; i++) {
                const currentStatement = caseClause.statements[i];
                // 如果已经遇到控制流终止语句，则其后的代码都是不可达的
                if (isCaseUnreachable && !this.isVarDeclarationStmt(currentStatement)) {
                    this.addUnreachableError(currentStatement, sourceFile, errors);
                }

                // 检查当前语句是否终止了控制流
                if (currentStatement && this.isControlFlowTerminated(currentStatement)) {
                    // 如果是 case 内部的控制流终止语句，后续代码不可达
                    isCaseUnreachable = true;
                }
            }
        }
        // 正常的 switch 结构（无论是否有 default）不应将 switch 之后的代码标记为不可达
        // 除非 switch 内部的每个分支都有明确的控制流终止（如 return/throw），而不只是 break
        let allCasesTerminateFlow = node.caseBlock.clauses.length > 0;
        for (const caseClause of node.caseBlock.clauses) {
            // 确认此 case 是否有明确终止程序流程的语句（不仅仅是 break）
            let hasTerminator = false;
            for (const statement of caseClause.statements) {
                if (this.isControlFlowTerminated(statement) && !ts.isBreakStatement(statement)) {
                    hasTerminator = true;
                    break;
                }
            }
            if (!hasTerminator) {
                allCasesTerminateFlow = false;
                break;
            }
        }
        // 只有当所有 case 都有显式终止流程的语句（如 return 或 throw）时，才检查 switch 后的代码
        if (allCasesTerminateFlow) {
            const nextStatement = this.findNextStatement(node);
            if (nextStatement && !ts.isEmptyStatement(nextStatement) && !ts.isFunctionDeclaration(nextStatement)) {
                this.addUnreachableError(nextStatement, sourceFile, errors);
            }
        }
    }

    // 判断是否为 var 声明
    private isVarDeclarationStmt(node: ts.Node): boolean {
        if (ts.isVariableStatement(node)) {
            const declarations = node.declarationList.declarations;
            // 检查是否有任何声明包含初始化器（赋值）
            const hasInitializer = declarations.some(decl => decl.initializer !== undefined);
            let flag = (node.declarationList.flags & ts.NodeFlags.Let) === 0 &&
                (node.declarationList.flags & ts.NodeFlags.Const) === 0 &&
                !hasInitializer; // 只有当没有初始化器时才返回 true
            return flag;
        }
        return false;
    }

    // 查找当前语句之后的下一条语句
    private findNextStatement(node: ts.Node): ts.Statement | undefined {
        const parent = node.parent;
        if (ts.isBlock(parent)) {
            const index = parent.statements.indexOf(node as ts.Statement);
            if (index < parent.statements.length - 1) {
                const nextStmt = parent.statements[index + 1];
                // 如果下一个语句是空语句（分号），则继续查找下一个语句
                if (ts.isEmptyStatement(nextStmt) && index + 2 < parent.statements.length) {
                    return parent.statements[index + 2];
                }
                return nextStmt;
            }
        }
        return undefined;
    }

    // 判断一个语句是否会导致控制流中断
    private isControlFlowTerminated(node: ts.Node | undefined): boolean {
        if (!node) {
            return false;
        }
        // 处理基本控制流语句和块语句
        if (this.isBasicControlFlowTerminator(node)) {
            return true;
        }
        // 处理复杂控制流语句
        return this.isComplexControlFlowTerminator(node);
    }

    // 检查基本的控制流终止语句
    private isBasicControlFlowTerminator(node: ts.Node): boolean {
        // 处理 return、throw、break、continue 语句
        if (ts.isReturnStatement(node) ||
            ts.isThrowStatement(node) ||
            ts.isBreakStatement(node) ||
            ts.isContinueStatement(node)) {
            return true;
        }
        // 处理块语句
        if (ts.isBlock(node)) {
            for (const statement of node.statements) {
                if (this.isControlFlowTerminated(statement)) {
                    return true;
                }
            }
            return false;
        }
        return false;
    }

    // 检查复杂的控制流终止语句
    private isComplexControlFlowTerminator(node: ts.Node): boolean {
        // 处理 ForStatement
        if (ts.isForStatement(node)) {
            if (!node.condition) {
                const bodyTerminated = this.isControlFlowTerminated(node.statement);
                return !bodyTerminated;
            }
            return false;
        }
        // 处理 if 语句
        if (ts.isIfStatement(node)) {
            const thenTerminated = this.isControlFlowTerminated(node.thenStatement);
            const elseTerminated = node.elseStatement ? this.isControlFlowTerminated(node.elseStatement) : false;
            return thenTerminated && elseTerminated;
        }
        // 处理 try-finally 语句
        if (ts.isTryStatement(node)) {
            const tryTerminated = this.isControlFlowTerminated(node.tryBlock);
            const finallyTerminated = node.finallyBlock ? this.isControlFlowTerminated(node.finallyBlock) : false;
            return tryTerminated || finallyTerminated;
        }
        // 处理 do-while 语句
        if (ts.isDoStatement(node)) {
            return this.isControlFlowTerminated(node.statement);
        }
        // 处理 while 语句
        if (ts.isWhileStatement(node)) {
            if (node.expression.kind === ts.SyntaxKind.TrueKeyword) {
                return this.checkInfiniteWhileLoop(node);
            }
            return false;
        }
        // 处理 switch 语句
        if (ts.isSwitchStatement(node)) {
            return this.checkSwitchTermination(node);
        }
        return false;
    }

    // 检查 switch 语句的终止情况
    private checkSwitchTermination(node: ts.SwitchStatement): boolean {
        for (const caseClause of node.caseBlock.clauses) {
            if (this.checkCaseClauseTermination(caseClause)) {
                return true;
            }
        }
        return false;
    }

    // 检查 case 子句的终止情况
    private checkCaseClauseTermination(caseClause: ts.CaseOrDefaultClause): boolean {
        for (const statement of caseClause.statements) {
            if (this.isControlFlowTerminated(statement)) {
                return true;
            }
        }
        return false;
    }

    // 检查无限 while 循环
    private checkInfiniteWhileLoop(node: ts.WhileStatement): boolean {
        if (ts.isBlock(node.statement)) {
            return this.checkInfiniteWhileLoopBlock(node.statement);
        }
        return false;
    }

    // 检查无限 while 循环的代码块
    private checkInfiniteWhileLoopBlock(block: ts.Block): boolean {
        for (const statement of block.statements) {
            if (this.isControlFlowTerminated(statement)) {
                return false;
            }
        }
        return true;
    }

    // 检查构造函数中是否调用了 super(),.../
    private hasSuperCallInConstructor(constructorEle: ts.ClassElement): boolean {
        let hasSuperCall = false;
        function visit(node: ts.Node): void {
            if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.SuperKeyword) {
                hasSuperCall = true;
            }
            ts.forEachChild(node, visit);
        }
        if (constructorEle) {
            ts.forEachChild(constructorEle, visit);
        }
        return hasSuperCall;
    }

    // 添加辅助判断函数
    private isBreakOrContinue(node: ts.Node): boolean {
        return ts.isBreakStatement(node) || ts.isContinueStatement(node);
    }

    // 专门检查不可达的分号，特别是针对箭头函数中的 switch 语句后的分号
    private checkUnreachableSemicolons(node: ts.Node, sourceFile: ts.SourceFile, errors: MessageInfo[]): void {
        // 非箭头函数直接遍历子节点
        if (!ts.isArrowFunction(node)) {
            ts.forEachChild(node, child => this.checkUnreachableSemicolons(child, sourceFile, errors));
            return;
        }
        // 非块语句形式的箭头函数体直接遍历子节点
        if (!ts.isBlock(node.body)) {
            ts.forEachChild(node, child => this.checkUnreachableSemicolons(child, sourceFile, errors));
            return;
        }
        // 处理箭头函数中的不可达分号
        this.checkUnreachableSemicolonsInArrowFunction(node.body, sourceFile, errors);
        // 继续遍历子节点
        ts.forEachChild(node, child => this.checkUnreachableSemicolons(child, sourceFile, errors));
    }

    // 处理箭头函数体内的不可达分号
    private checkUnreachableSemicolonsInArrowFunction(body: ts.Block, sourceFile: ts.SourceFile, errors: MessageInfo[]): void {
        const statements = body.statements;
        // 遍历所有语句，检查是否有 switch 语句后面紧跟着分号的情况
        for (let i = 0; i < statements.length - 1; i++) {
            const currentStmt = statements[i];
            const nextStmt = statements[i + 1];
            // 跳过非 switch 语句或后续非空语句的情况
            if (!ts.isSwitchStatement(currentStmt) || !ts.isEmptyStatement(nextStmt)) {
                continue;
            }
            this.checkSwitchWithTerminatingDefault(currentStmt as ts.SwitchStatement, nextStmt, sourceFile, errors);
        }
    }

    // 检查 switch 语句是否有终止控制流的 default 分支，如果有则标记后续分号为不可达
    private checkSwitchWithTerminatingDefault(switchStmt: ts.SwitchStatement, nextStmt: ts.Statement, sourceFile: ts.SourceFile, errors: MessageInfo[]): void {
        // 查找 default 分支
        const defaultClause = this.findDefaultClause(switchStmt);
        if (!defaultClause) {
            return;
        }
        // 检查 default 分支是否含有终止控制流的语句
        if (!this.hasTerminatingStatement(defaultClause)) {
            return;
        }
        // 标记分号为不可达代码
        this.markStatementAsUnreachable(nextStmt, sourceFile, errors);
    }

    // 查找 switch 语句中的 default 分支
    private findDefaultClause(switchStmt: ts.SwitchStatement): ts.CaseOrDefaultClause | undefined {
        return switchStmt.caseBlock.clauses.find(
            clause => clause.kind === ts.SyntaxKind.DefaultClause
        );
    }

    // 检查 case/default 分支是否含有终止控制流的语句
    private hasTerminatingStatement(clause: ts.CaseOrDefaultClause): boolean {
        return clause.statements.some(stmt =>
            ts.isThrowStatement(stmt) || ts.isReturnStatement(stmt)
        );
    }

    // 标记语句为不可达代码
    private markStatementAsUnreachable(stmt: ts.Statement, sourceFile: ts.SourceFile, errors: MessageInfo[]): void {
        this.addUnreachableError(stmt, sourceFile, errors);
    }

    // 处理三元表达式中的不可达代码
    private preprocessConditionalExpression(node: ts.ConditionalExpression, sourceFile: ts.SourceFile, errors: MessageInfo[]): void {
        // 检查冒号后面的表达式是否终止控制流
        if (!ts.isCallExpression(node.whenFalse)) {
            return;
        }
        const callExpr = node.whenFalse;
        // 检查是否调用了会抛出异常的函数
        if (!ts.isIdentifier(callExpr.expression) ||
            !(callExpr.expression.text === 'throw' ||
                callExpr.expression.text.includes('Error'))) {
            return;
        }
        // 检查父节点后面是否有分号或其他语句
        const parent = node.parent;
        if (!ts.isExpressionStatement(parent) || !parent.parent || !ts.isBlock(parent.parent)) {
            return;
        }
        const block = parent.parent as ts.Block;
        const index = block.statements.indexOf(parent as ts.Statement);
        if (index < 0 || index >= block.statements.length - 1) {
            return;
        }
        const nextStmt = block.statements[index + 1];
        if (!ts.isEmptyStatement(nextStmt)) {
            return;
        }
        // 添加不可达代码的错误
        this.addUnreachableErrorForStatement(nextStmt, sourceFile, errors);
    }

    public check = (targetField: ArkFile) => {
        const severity = this.rule.alert ?? this.metaData.severity;
        const filePath = targetField.getFilePath();
        const myInvalidPositions = this.checkUnreachableCode(targetField);
        let myInvalidPositionsNew = this.sortMyInvalidPositions(myInvalidPositions);
        myInvalidPositionsNew.forEach(pos => {
            this.addIssueReport(filePath, pos, severity)
        });
    }

    // 对错误位置进行排序并去重
    private sortMyInvalidPositions(myInvalidPositions: Array<MessageInfo>): MessageInfo[] {
        // 1. 先进行排序
        myInvalidPositions.sort((a, b) => a.line - b.line || a.character - b.character);
        // 2. 使用 reduce 进行去重
        const uniqueArrays = myInvalidPositions.reduce((acc, current) => {
            const lastItem = acc[acc.length - 1];
            // 检查是否与最后一个元素的三要素相同
            if (!lastItem ||
                lastItem.line !== current.line ||
                lastItem.character !== current.character ||
                lastItem.message !== current.message) {
                acc.push(current);
            }
            return acc;
        }, [] as typeof myInvalidPositions);

        return uniqueArrays;
    }

    private addIssueReport(filePath: string, pos: MessageInfo, severity: number): void {
        let defect = new Defects(pos.line, pos.character, pos.endCol, pos.message, severity, this.rule.ruleId,
            filePath, this.metaData.ruleDocPath, true, false, false);
        this.issues.push(new IssueReport(defect, undefined));
        RuleListUtil.push(defect);
    }

    private isExportStatement(node: ts.Node): boolean {
        if (!node) {
            return false;
        }
        // 检查是否为导出声明
        if (ts.isExportDeclaration(node)) {
            return true;
        }
        // 检查是否为带有export修饰符的声明
        if (ts.isVariableStatement(node) ||
            ts.isFunctionDeclaration(node) ||
            ts.isClassDeclaration(node)) {
            return node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.ExportKeyword) ?? false;
        }
        // 检查是否为默认导出
        if (ts.isExportAssignment(node)) {
            return true;
        }
        return false;
    }
}