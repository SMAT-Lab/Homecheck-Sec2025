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

import { ArkFile, AstTreeUtils, ts } from 'arkanalyzer/lib';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Defects, IssueReport } from '../../model/Defects';
import { MatcherCallback, MatcherTypes, FileMatcher } from '../../matcher/Matchers';
import { Rule } from '../../model/Rule';
import { RuleListUtil } from '../../utils/common/DefectsList';
import { RuleFix } from '../../model/Fix';

interface Issue {
    line: number;
    column: number;
    columnEnd: number;
    message: string;
    filePath: string;
    fixCode: string;
}

type Options = [{
    destructuring?: 'any' | 'all';
    ignoreReadBeforeAssign?: boolean;
}];

type VariableDeclarationType = ts.VariableDeclaration & {
    parent: ts.VariableDeclarationList;
    name: ts.Identifier;
};

type BindingPattern = ts.ObjectBindingPattern | ts.ArrayBindingPattern;

class Scope {
    parent?: Scope;
    variables = new Map<string, Variable>();
    type: 'global' | 'function' | 'block';
    loopDepth: number = 0;
    isClassStaticBlock: boolean = false;
    constructor(parent?: Scope, type: Scope['type'] = 'block') {
        this.parent = parent;
        this.type = type;
        this.loopDepth = parent?.loopDepth || 0;
    };
    getVariable(name: string): Variable | undefined {
        return this.variables.get(name) ?? this.parent?.getVariable(name);
    };

    isWithinFunctionOf(targetScope: Scope): boolean {
        let current: Scope | undefined = this;
        while (current) {
            if (current === targetScope) {
                return true;
            };
            // 遇到函数作用域时停止向上查找（利用 type 属性）
            if (current.type === 'function') {
                return false;
            };
            current = current.parent;
        };
        return false;
    };
}

class Variable {
    name: string;
    declarations: ts.Identifier[] = [];
    references: Reference[] = [];
    scope: Scope;
    declaredAt?: ts.Node; // 新增字段
    constructor(name: string, scope: Scope, declaredAt?: ts.Node) {
        this.name = name;
        this.scope = scope;
        this.declaredAt = declaredAt;
    };

    addReference(ref: Reference): void {
        this.references.push(ref);
    };
}

class Reference {
    isWrite: boolean;
    read: boolean;
    node: ts.Identifier;
    isInitial: boolean;
    scope: Scope;
    meta?: {
        isCrossScope: boolean;
        patternDepth: number;
        inClassStaticBlock: boolean;
        isInitializerRead?: boolean; // 标记初始化器中的自引用读取
        inParenthesis?: boolean;
        isAccess?: boolean;
        isInCondition?: boolean;
        isConditionalWrite?: boolean;
        isConstructorCall?: boolean;
    };
    // 新增字段：关联的声明节点（用于溯源初始化状态）
    declarationNode?: ts.VariableDeclaration;
    constructor(node: ts.Identifier, isWrite: boolean, isInitial: boolean = false, scope: Scope, meta?: Partial<Reference['meta']>,
        declarationNode?: ts.VariableDeclaration) {
        this.node = node;
        this.isWrite = isWrite;
        this.read = !isWrite;
        this.isInitial = isInitial;
        this.scope = scope;
        this.meta = {
            isCrossScope: meta?.isCrossScope || false,
            patternDepth: meta?.patternDepth || 0,
            inClassStaticBlock: scope.isClassStaticBlock,
            inParenthesis: meta?.inParenthesis || false, // 初始化新属性
            isInitializerRead: meta?.isInitializerRead,
            isAccess: meta?.isAccess || false,
            isInCondition: meta?.isInCondition || false,
            isConditionalWrite: meta?.isConditionalWrite || false,
            isConstructorCall: meta?.isConstructorCall || false
        };
        this.declarationNode = declarationNode;
    };
}

interface LoopContext {
    initializedVars: Set<string>;
    conditionRefs: Set<string>;
    incrementorRefs: Set<string>;
    writeVarsInLoop: Set<string>;
}

export class PreferConstCheck implements BaseChecker {
    metaData: BaseMetaData = {
        severity: 2,
        ruleDocPath: 'docs/prefer-const-check.md',
        description: 'Require `const` declarations for variables that are never reassigned after declared.'
    };
    private defaultOptions: Options = [{
        destructuring: 'any',
        ignoreReadBeforeAssign: false
    }];
    private config = {
        destructuring: 'any',
        ignoreReadBeforeAssign: false
    };
    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private scopeStack: Scope[] = [];
    private ast: ts.SourceFile;
    private currentArkFile: ArkFile;
    private fileMatcher: FileMatcher = { matcherType: MatcherTypes.FILE };
    private loopStack: Scope[] = [];
    private currentLoopParts: ('initializer' | 'condition' | 'incrementor' | 'body')[] = [];
    private allLoopContexts: LoopContext[] = [];
    private currentScope(): Scope {
        return this.scopeStack[this.scopeStack.length - 1];
    };

    private enterScope(type: Scope['type']): void {
        const newScope = new Scope(this.currentScope(), type);
        newScope.loopDepth = this.currentScope()?.loopDepth || 0;
        this.scopeStack.push(newScope);
    };

    private exitScope(): void {
        this.scopeStack.pop();
    };

    private enterLoop(): void {
        const currentScope = this.currentScope();
        currentScope.loopDepth++;
        this.loopStack.push(currentScope);
    };

    private exitLoop(): void {
        const exited = this.loopStack.pop();
        if (exited) {
            exited.loopDepth--;
        };
    };

    private enterLoopPart(part: 'initializer' | 'condition' | 'incrementor' | 'body'): void {
        this.currentLoopParts.push(part);
    };

    private exitLoopPart(): void {
        this.currentLoopParts.pop();
    };

    public registerMatchers(): MatcherCallback[] {
        return [{
            matcher: this.fileMatcher,
            callback: this.check,
        }];
    };

    private parseConfig(): void {
        this.defaultOptions = this.rule?.option?.[0] ? this.rule.option as Options : this.defaultOptions;
        this.config.destructuring = this.defaultOptions[0].destructuring || 'any';
        this.config.ignoreReadBeforeAssign = this.defaultOptions[0].ignoreReadBeforeAssign || false;
    };

    public check = (target: ArkFile): void => {
        this.parseConfig();
        if (target instanceof ArkFile) {
            this.checkPreferConst(target);
            this.issues.sort((a, b) => a.defect.reportLine - b.defect.reportLine || a.defect.reportColumn - b.defect.reportColumn);
            this.issues.forEach(issue => RuleListUtil.push(issue.defect));
        };
    };

    private checkPreferConst(arkFile: ArkFile): void {
        this.currentArkFile = arkFile;
        this.ast = AstTreeUtils.getSourceFileFromArkFile(arkFile);
        this.scopeStack = [new Scope(undefined, 'global')];
        const visitors = {
            enter: (node: ts.Node): void => {
                this.enter(node);
            },
            leave: (node: ts.Node): void => {
                this.leave(node);
            },
            visitVariableDeclaration: (node: VariableDeclarationType): void => {
                this.visitVariableDeclaration(node);
            },
            visitBinaryExpression: (node: ts.BinaryExpression): void => {
                this.visitBinaryExpression(node);
            },
            visitPrefixUnaryExpression: (node: ts.PrefixUnaryExpression): void => {
                if ([ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(node.operator)) {
                    this.processAssignment(node.operand);
                }
            },
            visitPostfixUnaryExpression: (node: ts.PostfixUnaryExpression): void => {
                if ([ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(node.operator)) {
                    this.processAssignment(node.operand);
                }
            },
            visitForStatement: (node: ts.ForStatement): void => {
                this.visitForStatement(node, visitors);
            },
            visitForOfStatement: (node: ts.ForOfStatement): void => {
                this.visitForOfStatement(node, visitors);
            },
            visitForInStatement: (node: ts.ForInStatement): void => {
                this.visitForInStatement(node, visitors);
            }
        };
        this.walkNodes(this.ast, visitors);
        this.currentScope().variables.forEach(variable => {
            if (!this.isReassigned(variable)) {
                this.reportConstSuggestion(variable);
            };
        });
    }

    private enter(node: ts.Node): void {
        if (ts.isSwitchStatement(node)) {
            // 为 switch 语句创建新的块级作用域
            this.enterScope('block');
        }
        if (ts.isClassStaticBlockDeclaration(node)) {
            this.enterScope('block');
            this.currentScope().isClassStaticBlock = true;
        };
        if (ts.isBlock(node) || ts.isFunctionLike(node)) {
            this.enterScope('block');
        };
    }

    private leave(node: ts.Node): void {
        if (ts.isSwitchStatement(node)) {
            // 退出 switch 的作用域并分析变量
            const exitedScope = this.currentScope();
            this.exitScope();
            exitedScope.variables.forEach(variable => {
                if (!this.isReassigned(variable)) {
                    this.reportConstSuggestion(variable);
                }
            });
        }
        if (ts.isClassStaticBlockDeclaration(node)) {
            const exitedScope = this.currentScope();
            this.exitScope();
            // 处理静态块作用域内的变量
            exitedScope.variables.forEach(variable => {
                if (!this.isReassigned(variable)) {
                    this.reportConstSuggestion(variable);
                };
            });
        };
        if (ts.isBlock(node) || ts.isFunctionLike(node)) {
            const exitedScope = this.currentScope();
            this.exitScope();
            exitedScope.variables.forEach(variable => {
                if (!this.isReassigned(variable)) {
                    this.reportConstSuggestion(variable);
                };
            });
        };
    }

    private visitVariableDeclaration(node: VariableDeclarationType): void {
        const declarationList = node.parent;
        const keywordToken = declarationList.getChildren().find(child =>
            ts.isToken(child) && [ts.SyntaxKind.LetKeyword, ts.SyntaxKind.ConstKeyword, ts.SyntaxKind.VarKeyword].includes(child.kind)
        );
        if (keywordToken?.kind === ts.SyntaxKind.LetKeyword) {
            this.processLetDeclaration(node);
        } else if (keywordToken?.kind === ts.SyntaxKind.VarKeyword) {
            this.processVarDeclaration(node);
        };
    }

    private visitBinaryExpression(node: ts.BinaryExpression): void {
        if (node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
            // 检测整个赋值表达式是否被括号包裹
            let current: ts.Node = node;
            let hasParenthesis = false;
            while (ts.isParenthesizedExpression(current.parent) && (ts.isBlock(current.parent.parent.parent) &&
                !ts.isClassStaticBlockDeclaration(current.parent.parent.parent.parent))) {
                current = current.parent;
                hasParenthesis = true;
            };
            // 将括号状态传入processAssignment
            this.processAssignment(node.left, hasParenthesis); // 注意传递node.left
        };
    }

    private visitForStatement(node: ts.ForStatement, visitors: any): void {
        this.enterLoop();
        try {
            if (node.initializer) {
                this.enterLoopPart('initializer');
                this.enterScope('block');
                this.walkNodes(node.initializer, visitors);
                this.exitScope();
                this.exitLoopPart();
            };
            if (node.condition) {
                this.enterLoopPart('condition');
                this.walkNodes(node.condition, visitors);
                this.exitLoopPart();
            };
            if (node.incrementor) {
                this.enterLoopPart('incrementor');
                this.walkNodes(node.incrementor, visitors);
                this.exitLoopPart();
            };
            this.enterLoopPart('body');
            this.enterScope('block');
            this.walkNodes(node.statement, visitors);
            this.exitScope();
            this.exitLoopPart();
        } finally {
            this.exitLoop();
        };
    }

    private visitForOfStatement(node: ts.ForOfStatement, visitors: any): void {
        this.enterLoop();
        try {
            // 处理迭代表达式
            this.enterLoopPart('initializer');
            this.walkNodes(node.expression, visitors);
            this.exitLoopPart();
            // 处理声明部分
            this.enterLoopPart('initializer');
            this.enterScope('block');
            this.walkNodes(node.initializer, visitors);
            this.exitScope();
            this.exitLoopPart();
            // 处理循环体
            this.enterLoopPart('body');
            this.enterScope('block');
            this.walkNodes(node.statement, visitors);
            this.exitScope();
            this.exitLoopPart();
        } finally {
            this.exitLoop();
        }
    }

    private visitForInStatement(node: ts.ForInStatement, visitors: any): void {
        this.enterLoop();
        try {
            // 处理迭代表达式
            this.enterLoopPart('initializer');
            this.walkNodes(node.expression, visitors);
            this.exitLoopPart();
            // 处理声明部分
            this.enterLoopPart('initializer');
            this.enterScope('block');
            this.walkNodes(node.initializer, visitors);
            this.exitScope();
            this.exitLoopPart();
            // 处理循环体
            this.enterLoopPart('body');
            this.enterScope('block');
            this.walkNodes(node.statement, visitors);
            this.exitScope();
            this.exitLoopPart();
        } finally {
            this.exitLoop();
        }
    }

    private walkNodes(node: ts.Node, visitors: any): void {
        this.enhancedVisitors.enter(node);
        visitors.enter?.(node);
        if (ts.isVariableDeclaration(node)) {
            visitors.visitVariableDeclaration?.(node);
        } else if (ts.isBinaryExpression(node)) {
            visitors.visitBinaryExpression?.(node);
        } else if (ts.isPrefixUnaryExpression(node)) {
            visitors.visitPrefixUnaryExpression?.(node);
        } else if (ts.isPostfixUnaryExpression(node)) {
            visitors.visitPostfixUnaryExpression?.(node);
        } else if (ts.isForStatement(node)) {
            visitors.visitForStatement?.(node);
        } else if (ts.isForOfStatement(node)) {
            visitors.visitForOfStatement?.(node);
        } else if (ts.isForInStatement(node)) {
            visitors.visitForInStatement?.(node);
        };
        if (ts.isAsExpression(node)) {
            // 当遇到类型断言时，优先处理类型部分
            this.walkNodes(node.expression, visitors);
            return;
        };
        ts.forEachChild(node, child => this.walkNodes(child, visitors));
        visitors.leave?.(node);
        this.enhancedVisitors.leave(node);
    }

    private collectReferencesInExpression(node: ts.Node, refSet: Set<string>): void {
        const isWriteAccess = (n: ts.Node): boolean => {
            const parent = n.parent;
            return (
                // 检查赋值表达式左侧
                (ts.isBinaryExpression(parent) && parent.left === n && parent.operatorToken.kind === ts.SyntaxKind.EqualsToken) ||
                // 检查自增/自减表达式
                ts.isPostfixUnaryExpression(parent) ||
                ts.isPrefixUnaryExpression(parent) ||
                // 检查变量声明中的初始化
                ts.isVariableDeclaration(parent)
            );
        };
        const visitNode = (n: ts.Node): void => {
            if (ts.isIdentifier(n) && !isWriteAccess(n)) { // 收集只读引用
                refSet.add(n.text);
            }
            ts.forEachChild(n, visitNode);
        };
        visitNode(node);
    }

    private checkForStatement = (node: ts.ForStatement): void => {
        const loopContext = this.createLoopContext();
        this.allLoopContexts.push(loopContext);
        // 捕获初始化变量
        if (node.initializer) {
            if (ts.isVariableDeclarationList(node.initializer)) {
                node.initializer.declarations.forEach(decl => {
                    this.collectDeclaredVariables(decl.name, loopContext.initializedVars);
                });
            } else {
                // 处理表达式形式的初始化（如逗号表达式）
                this.walkForExpression(node.initializer, (id: ts.Identifier) => {
                    loopContext.initializedVars.add(id.text);
                });
            };
        };
        // 收集条件中的引用
        if (node.condition) {
            this.collectReferencesInExpression(node.condition, loopContext.conditionRefs);
        };
        // 收集递增部分的引用
        if (node.incrementor) {
            this.collectReadRefs(node.incrementor, loopContext.incrementorRefs);
        };
    };

    private enhancedVisitors = {
        enter: (node: ts.Node): void => {
            // 捕获标识符的读取操作
            if (ts.isIdentifier(node) && this.isReadAccess(node)) {
                const variable = this.currentScope().getVariable(node.text);
                if (variable) {
                    const isInCondition = this.isInConditionContext(node);
                    // 创建读取引用（isWrite: false, read: true）
                    variable.references.push(
                        new Reference(node, false, false, this.currentScope(),
                            {
                                ...variable.references[variable.references.length - 1]?.meta,
                                isInCondition
                            })
                    );
                };
            };
            if (ts.isNewExpression(node)) {
                const expr = node.expression;
                if (ts.isIdentifier(expr)) {
                    const variable = this.currentScope().getVariable(expr.text);
                    variable?.references.push(
                        new Reference(expr, false, false, this.currentScope(),
                            { isConstructorCall: true })
                    );
                }
            };
            if (ts.isWhileStatement(node) || ts.isDoStatement(node)) {
                const ctx = this.createLoopContext();
                this.collectLoopConditionWrites(node.expression, ctx.writeVarsInLoop);
                this.allLoopContexts.push(ctx);
            };
            if (ts.isForStatement(node)) {
                this.checkForStatement(node);
            };
            if (ts.isIdentifier(node) && this.isReadAccess(node)) {
                const parent = node.parent;
                const isAccess = (ts.isPropertyAccessExpression(parent) && parent.expression === node) ||
                    (ts.isElementAccessExpression(parent) && parent.expression === node);
                const variable = this.currentScope().getVariable(node.text);
                if (variable) {
                    variable.references.push(
                        new Reference(node, false, false, this.currentScope(), {
                            ...variable.references[variable.references.length - 1]?.meta, // 保留现有meta
                            isAccess
                        })
                    );
                }
            }
        },
        leave: (node: ts.Node): void => { }
    };

    private isInConditionContext(node: ts.Node): boolean {
        let current: ts.Node = node;
        while (current.parent) {
            const parent = current.parent;
            if (
                (ts.isIfStatement(parent) && parent.expression === current) ||
                (ts.isWhileStatement(parent) && parent.expression === current) ||
                (ts.isForStatement(parent) && parent.condition === current) ||
                (ts.isConditionalExpression(parent) && parent.condition === current)
            ) {
                return true;
            };
            current = parent;
        };
        return false;
    };

    private isReadAccess(node: ts.Identifier): boolean {
        const parent = node.parent;
        // 排除写入场景（赋值左侧、自增、变量声明等）
        if (
            (ts.isBinaryExpression(parent) &&
                parent.left === node &&
                parent.operatorToken.kind === ts.SyntaxKind.EqualsToken) ||
            ts.isPostfixUnaryExpression(parent) ||
            ts.isPrefixUnaryExpression(parent) ||
            ts.isVariableDeclaration(parent) ||
            (ts.isForInStatement(parent) && parent.initializer === node) ||
            (ts.isForOfStatement(parent) && parent.initializer === node)
        ) {
            return false;
        };
        // 其他情况视为读取
        return true;
    };

    // 创建新的循环上下文
    private createLoopContext(): LoopContext {
        return {
            initializedVars: new Set(),
            conditionRefs: new Set(),
            incrementorRefs: new Set(),
            writeVarsInLoop: new Set(),
        };
    };

    private collectLoopConditionWrites(expr: ts.Expression | undefined, target: Set<string>): void {
        if (!expr) {
            return;
        };
        const detector = (n: ts.Node): void => {
            // 检测赋值表达式（a = foo()）
            if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
                this.trackAssignmentTarget(n.left, target);
            }
            // 检测复合赋值（a += 1）
            else if (ts.isBinaryExpression(n) && [
                ts.SyntaxKind.PlusEqualsToken,
                ts.SyntaxKind.MinusEqualsToken
            ].includes(n.operatorToken.kind)) {
                this.trackAssignmentTarget(n.left, target);
            }
            ts.forEachChild(n, detector);
        };
        detector(expr);
    };

    // 递归追踪赋值目标（支持解构）
    private trackAssignmentTarget(pattern: ts.Node, target: Set<string>): void {
        const checkElement = (n: ts.ArrayBindingPattern | ts.ObjectBindingPattern): void => {
            n.elements.forEach(elem => {
                if (ts.isBindingElement(elem)) {
                    visit(elem.name);
                };
            });
        };
        const visit = (n: ts.Node): void => {
            if (ts.isIdentifier(n)) {
                target.add(n.text);
            } else if (ts.isArrayBindingPattern(n) || ts.isObjectBindingPattern(n)) {
                checkElement(n);
            }
        };
        visit(pattern);
    };

    private walkForExpression(node: ts.Node, callback: (id: ts.Identifier) => void): void {
        if (ts.isIdentifier(node)) {
            callback(node);
        } else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
            this.walkForExpression(node.left, callback);
        } else if (ts.isParenthesizedExpression(node)) {
            this.walkForExpression(node.expression, callback);
        } else if (ts.isCommaListExpression(node)) {
            node.elements.forEach(elem => this.walkForExpression(elem, callback));
        }
    };

    private collectDeclaredVariables(pattern: ts.BindingName, targetSet: Set<string>): void {

        const checkElement = (elem: ts.BindingElement): void => {
            if (ts.isIdentifier(elem.name)) {
                targetSet.add(elem.name.text);
            } else if (ts.isObjectBindingPattern(elem.name) || ts.isArrayBindingPattern(elem.name)) {
                processPattern(elem.name);
            };
        };
        const processPattern = (p: ts.BindingPattern): void => {
            p.elements.forEach(elem => {
                if (ts.isBindingElement(elem)) {
                    checkElement(elem);
                };
            });
        };
        if (ts.isIdentifier(pattern)) {
            targetSet.add(pattern.text);
        } else if (ts.isObjectBindingPattern(pattern) || ts.isArrayBindingPattern(pattern)) {
            processPattern(pattern);
        };
    };

    private processPatternForContext(pattern: ts.BindingPattern, targetSet: Set<string>): void {
        pattern.elements.forEach(elem => {
            if (ts.isBindingElement(elem)) {
                if (ts.isIdentifier(elem.name)) {
                    targetSet.add(elem.name.text);
                } else if (ts.isObjectBindingPattern(elem.name) || ts.isArrayBindingPattern(elem.name)) {
                    this.processPatternForContext(elem.name, targetSet);
                };
            };
        });
    };

    private collectReadRefs(node: ts.Node, targetSet: Set<string>): void {
        const visit = (n: ts.Node): void => {
            if (ts.isIdentifier(n) && !this.isWriteAccess(n)) {
                targetSet.add(n.text);
            }
            ts.forEachChild(n, visit);
        };
        visit(node);
    };

    private isWriteAccess(node: ts.Node): boolean {
        const parent = node.parent;
        return (
            (ts.isBinaryExpression(parent) && parent.left === node && parent.operatorToken.kind === ts.SyntaxKind.EqualsToken) ||
            ts.isPostfixUnaryExpression(parent) ||
            ts.isPrefixUnaryExpression(parent) ||
            ts.isVariableDeclaration(parent)
        );
    };

    private hasReadBeforeAssign(variable: Variable): boolean {
        if (!variable.declaredAt || this.config.ignoreReadBeforeAssign === false) {
            return false;
        };
        const declarationPos = variable.declaredAt.getStart();
        return variable.references.some(ref => {
            // 使用原有Reference结构判断
            return ref.read && ref.node.getStart() < declarationPos;
        });
    };

    //变量声明的方法
    private processLetDeclaration(node: VariableDeclarationType): void {
        if (ts.isIdentifier(node.name)) {
            this.registerVariable(node.name);
            if (node.initializer) {
                const variable = this.currentScope().getVariable(node.name.text);
                variable?.references.push(new Reference(node.name, true, true, this.currentScope(), {}, node));
            };
        } else if (ts.isObjectBindingPattern(node.name) || ts.isArrayBindingPattern(node.name)) {
            this.processBindingPattern(node.name, node);
        };
    };

    private visitVarBindingName = (elem: ts.BindingElement, parentDeclaration: VariableDeclarationType, bindingName: ts.Identifier): void => {
        const varName = bindingName.text;
        if (varName === 'globalThis' && elem.initializer) {
            this.walkNodes(elem.initializer, {
                enter: (node: ts.Node) => {
                    if (ts.isBindingElement(node.parent)) {
                        const variable = this.currentScope().getVariable(varName);
                        variable?.references.push(new Reference(bindingName, true, true, this.currentScope(), {}, parentDeclaration));
                    };
                },
                leave: () => { }
            });
        };
    };

    private processVarBindingPattern(pattern: BindingPattern, parentDeclaration: VariableDeclarationType): void {
        const processElement = (elem: ts.BindingElement, depth: number = 0): void => {
            const bindingName = elem.name;
            if (ts.isIdentifier(bindingName)) {
                this.visitVarBindingName(elem, parentDeclaration, bindingName);
            } else if (ts.isObjectBindingPattern(elem.name)) {
                this.processVarBindingPattern(elem.name, ts.factory.createVariableDeclaration(elem.name, undefined, undefined, undefined) as any);
            };
        };
        if (ts.isObjectBindingPattern(pattern)) {
            pattern.elements.forEach(processElement);
        };
    };

    private processVarDeclaration(node: VariableDeclarationType): void {
        if (ts.isObjectBindingPattern(node.name)) {
            this.processVarBindingPattern(node.name, node);
        };
    };

    // 解构模式
    private processBindingPattern(pattern: BindingPattern, parentDeclaration: VariableDeclarationType): void {
        const processElement = (elem: ts.BindingElement, depth: number = 0): void => {
            const declaredAt = ts.isIdentifier(elem.name)
                ? elem.name
                : parentDeclaration.name;
            if (ts.isIdentifier(elem.name)) {
                // 2. 正确注册变量并关联声明节点
                const variable = new Variable(
                    elem.name.text,
                    this.currentScope(),
                    declaredAt);
                variable.declarations.push(elem.name); // 存储标识符
                this.currentScope().variables.set(elem.name.text, variable);
                // 3. 记录初始引用（关联到父级声明节点）
                variable.references.push(
                    new Reference(elem.name, true, true, this.currentScope(), { patternDepth: depth }, parentDeclaration)
                );
            } else if (ts.isObjectBindingPattern(elem.name) || ts.isArrayBindingPattern(elem.name)) {
                // 4. 递归处理嵌套解构
                this.processBindingPattern(elem.name, ts.factory.createVariableDeclaration(elem.name, undefined, undefined, undefined) as any);
            };
            // 处理默认值
            if (elem.initializer) {
                this.walkNodes(elem.initializer, this.enhancedVisitors);
            };
        };
        if (ts.isArrayBindingPattern(pattern)) {
            pattern.elements.forEach(elem => {
                if (ts.isBindingElement(elem)) {
                    processElement(elem);
                };
            });
        } else {
            pattern.elements.forEach(processElement);
        };
    };

    private registerVariable(identifier: ts.Identifier): void {
        const variable = new Variable(identifier.text, this.currentScope(), identifier);
        this.currentScope().variables.set(identifier.text, variable);
        variable.declarations.push(identifier);
    };

    private parseAssignmentIsParenthesizedExpression(left: ts.Expression, inParenthesis: boolean): boolean {
        if (ts.isParenthesizedExpression(left)) {
            this.processAssignment(left.expression, inParenthesis); // 传递 inParenthesis 为 true
            return true;
        }
        return false;
    };

    // 处理对象或数组解构赋值
    private processAssignment(left: ts.Expression, inParenthesis: boolean = false): void {
        if (this.parseAssignmentIsParenthesizedExpression(left, inParenthesis) || this.isInExportAssignment(left)) {
            return;
        };
        const isConditionalWrite = this.isInConditionContext(left);
        const processIdentifier = (node: ts.Identifier, patternDepth: number): void => {
            const variable = this.currentScope().getVariable(node.text);
            if (variable) {
                const isCrossScope = variable.scope !== this.currentScope();
                variable.references.push(new Reference(node, true, false, this.currentScope(),
                    { isCrossScope, patternDepth, inParenthesis, isConditionalWrite }));
            };
        };
        const checkElement = (element: ts.BindingElement, depth: number): void => {
            if (ts.isIdentifier(element.name)) {
                processIdentifier(element.name, depth);
            } else if (ts.isArrayBindingPattern(element.name) || ts.isObjectBindingPattern(element.name)) {
                processBindingPattern(element.name, depth + 1);
            };
        };
        const processBindingPattern = (pattern: ts.BindingPattern, depth: number): void => {
            pattern.elements.forEach(element => {
                if (ts.isBindingElement(element)) {
                    checkElement(element, depth);
                };
            });
        };
        if (ts.isIdentifier(left)) {
            processIdentifier(left, 0);
        } else if (ts.isObjectBindingPattern(left) || ts.isArrayBindingPattern(left)) {
            processBindingPattern(left, 1);
        } else if (ts.isObjectLiteralExpression(left)) {
            left.properties.forEach(prop => {
                if (ts.isShorthandPropertyAssignment(prop)) {
                    processIdentifier(prop.name, 1);
                } else if (ts.isPropertyAssignment(prop)) {
                    this.processAssignment(prop.initializer, inParenthesis);
                };
            });
        } else if (ts.isArrayLiteralExpression(left)) {
            left.elements.forEach(element => {
                if (ts.isIdentifier(element)) {
                    processIdentifier(element, 1);
                } else if (ts.isSpreadElement(element)) {
                    this.processAssignment(element.expression, inParenthesis);
                } else {
                    this.processAssignment(element, inParenthesis);
                };
            });
        };
    };

    private isReassigned(variable: Variable): boolean {
        return variable.references.filter(ref => ref.isWrite).length > 1;
    };

    private isVariableInitialized(variable: Variable): boolean {
        // 遍历所有初始化的引用，检查是否有初始化表达式
        return variable.references.some(ref =>
            ref.isInitial &&
            ref.declarationNode?.initializer !== undefined
        );
    };

    private isInExportAssignment(node: ts.Node): boolean {
        let parent = node.parent;
        while (parent) {
            if (ts.isExportAssignment(parent)) {
                return true;
            };
            parent = parent.parent;
        };
        return false;
    };

    private isVoidZeroInitializer(variable: Variable): boolean {
        const findParentDeclaration = (node: ts.Identifier): ts.VariableDeclaration | undefined => {
            let parent = node.parent;
            while (parent) {
                if (ts.isVariableDeclaration(parent)) {
                    return parent;
                };
                parent = parent.parent;
            };
            return undefined;
        };
        const isVoidZeroExpression = (node: ts.Node): boolean => {
            // 处理括号包裹的情况：(void 0)
            if (ts.isParenthesizedExpression(node)) {
                return isVoidZeroExpression(node.expression);
            };
            return ts.isVoidExpression(node) &&
                ts.isNumericLiteral(node.expression) &&
                node.expression.text === '0';
        };
        return variable.declarations.some(decl => {
            const declaration = findParentDeclaration(decl);
            return declaration?.initializer && isVoidZeroExpression(declaration.initializer);
        });
    };

    private isVariableInLoop(variable: Variable): boolean {
        return variable.references.some(ref => {
            let current: ts.Node = ref.node;
            while (current.parent) {
                if (ts.isForStatement(current.parent) || ts.isForInStatement(current.parent) || ts.isForOfStatement(current.parent)) {
                    return true;
                }
                current = current.parent;
            };
            return false;
        });
    };

    private isObjectLiteral(variable: Variable): boolean {
        if (variable.references.length > 1) {
            if (ts.isSpreadAssignment(variable.references[1].node.parent) && ts.isObjectLiteralExpression(variable.references[1].node.parent.parent)) {
                return true;
            };
        };
        return false;
    };

    private reportConstSuggestion(variable: Variable): void {
        const noInitializer = !this.isVariableInitialized(variable);
        // void 0检测以及
        if (noInitializer && variable.references.filter(ref => ref.isWrite).length === 0 && 
            !this.isVariableInLoop(variable) && !this.isObjectLiteral(variable)) {
            return;
        }
        // 优先检查未初始化且存在属性访问
        if (variable.references.length > 0 && ts.isPostfixUnaryExpression(variable.references[0].node.parent)) {
            return;
        };
        const isUninitializedWithAccess = noInitializer &&
            variable.references.some(ref => ref.meta?.isAccess);
        const UninitializedWithHasConditionRead = noInitializer && variable.references.some(ref =>
            (ref.read && ref.meta?.isInCondition) || (ref.isWrite && ref.meta?.isConditionalWrite)
        );
        //是否在循环条件中被写
        const isWrittenInLoop = this.allLoopContexts.some(ctx =>
            ctx.writeVarsInLoop.has(variable.name)
        );
        if (isUninitializedWithAccess || UninitializedWithHasConditionRead || this.hasReadBeforeAssign(variable) || isWrittenInLoop) {
            return; // 跳过未初始化但有属性访问的变量 跳过先读后写的变量
        };
        // 新增：检查是否循环控制变量	
        const isLoopControlVar = this.allLoopContexts.some(ctx =>
            ctx.initializedVars.has(variable.name) &&
            (ctx.conditionRefs.has(variable.name) || ctx.incrementorRefs.has(variable.name))
        );
        if (this.shouldSkip(variable) || isLoopControlVar) {
            return;
        };
        variable.declarations.forEach(decl => {
            this.analyzeVariableDeclaration(decl, variable);
        });
    };

    private shouldSkip(variable: Variable): boolean {
        const shouldSkip = variable.references.some(ref => {
            // 跳过跨作用域的解构赋值（用例1）
            if (ref.meta?.isCrossScope && ref.meta.patternDepth > 0) {
                return true;
            };
            // 跳过类静态块中的解构赋值（用例2）
            if (ref.meta?.inClassStaticBlock && ref.meta.patternDepth > 0) {
                return true;
            };
            // 新增条件：若引用在括号内的解构中，跳过上报
            if (ref.meta?.inParenthesis && ref.isWrite) {
                return true;
            };
            return false;
        });
        return shouldSkip;
    };

    private analyzeVariableDeclaration(decl: ts.Identifier, variable: Variable): void {
        const declarationList = decl.parent.parent as ts.VariableDeclarationList;
        const hasCrossScopeWrite = variable.references.some(ref =>
            ref.isWrite && !ref.isInitial && ref.scope !== variable.scope
        );
        const writeCount = variable.references
            .filter(ref => ref.isWrite && !ref.isInitial)
            .reduce((sum, ref) => sum + (ref.scope.loopDepth > 0 ? 2 : 1), 0);
        // 1. 动态获取声明列表（兼容解构模式）
        const { declarations, isForInOf } = this.getDeclarationsAndLoopType(declarationList);
        const hasRead = variable.references.some(ref => ref.read);
        // ||  // 有读取
        const hasWrite = variable.references.filter(ref => ref.isWrite).length > 0;
        // 2. 安全解构检查（独立方法封装）
        const hasUnsafeDestructuring = this.checkUnsafeDestructuring(declarations);
        // 3. 初始化检查（兼容解构模式）
        const allInitialized = this.checkAllInitialized(declarations);
        // 只声明，未给初始值，没赋值，没调用
        if (!hasRead && !hasWrite && !allInitialized) {
            return;
        };
        // 最终修复条件
        const shouldFix = !hasUnsafeDestructuring &&
            (isForInOf || allInitialized);
        if (!hasCrossScopeWrite && writeCount <= 1) {
            const isInitialized = this.isVariableInitialized(variable);
            // 确定报告节点
            let reportNode: ts.Identifier = variable.declarations[0]; // 默认声明位置
            if (!isInitialized) {
                // 查找第一个非初始化的写操作
                const firstWriteRef = variable.references.find(
                    ref => ref.isWrite && !ref.isInitial
                );
                if (firstWriteRef) {
                    reportNode = firstWriteRef.node; // 使用赋值位置
                };
            };
            const diagnostic = this.createDiagnostic(reportNode);
            let ruleFix;
            if (shouldFix) {
                ruleFix = this.createFix(declarationList);
            }
            this.addIssueReport(diagnostic, ruleFix);
        };
    };

    // 动态获取声明列表并判断循环类型 node 可能为 VariableDeclarationList 或解构模式节点
    private getDeclarationsAndLoopType(node: ts.Node): {
        declarations: ts.VariableDeclaration[],
        isForInOf: boolean
    } {
        let declarations: ts.VariableDeclaration[] = [];
        let isForInOf = false;
        // 处理标准声明列表
        if (ts.isVariableDeclarationList(node)) {
            declarations = [...node.declarations];
            const parent = node.parent;
            isForInOf = ts.isForInStatement(parent) || ts.isForOfStatement(parent);
        }
        // 处理解构模式（如 [x, y]）
        else if (ts.isArrayBindingPattern(node) || ts.isObjectBindingPattern(node)) {
            const parentVarDecl = node.parent;
            if (ts.isVariableDeclaration(parentVarDecl)) {
                declarations = [{
                    ...parentVarDecl,
                    name: node,
                    initializer: parentVarDecl.initializer
                } as ts.VariableDeclaration];
            };
            // 循环类型判断：祖父节点可能是 ForIn/OfStatement
            const grandParent = parentVarDecl?.parent?.parent;
            isForInOf = ts.isForInStatement(grandParent) || ts.isForOfStatement(grandParent);
        };
        return { declarations, isForInOf };
    };

    // 解构安全检查（如 obj.x 或 arr[0]）
    private checkUnsafeDestructuring(declarations: ts.VariableDeclaration[]): boolean {
        return declarations.some(declaration => {
            if (!(ts.isArrayBindingPattern(declaration.name) || ts.isObjectBindingPattern(declaration.name))) {
                return false;
            };
            let unsafe = false;
            const checkNode = (node: ts.Node): void => {
                if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
                    unsafe = true;
                }
                ts.forEachChild(node, checkNode);
            };
            checkNode(declaration.name);
            return unsafe;
        });
    };

    // 初始化检查（解构模式默认视为已初始化）
    private checkAllInitialized(declarations: ts.VariableDeclaration[]): boolean {
        return declarations.every(declaration =>
            ((ts.isArrayBindingPattern(declaration.name) || ts.isObjectBindingPattern(declaration.name))) ? true : !!declaration.initializer
        );
    };

    private createFix(declarationList: ts.VariableDeclarationList): RuleFix {
        const start = declarationList.getStart();
        const end = start + 'let'.length;
        return { range: [start, end], text: 'const' };
    };

    private createDiagnostic(node: ts.Node): Issue {
        const { line, character } = ts.getLineAndCharacterOfPosition(this.ast, node.getStart());
        return {
            line: line + 1,
            column: character + 1,
            columnEnd: character + 1 + (ts.isIdentifier(node) ? node.getText().length : 0),
            message: `'${ts.isIdentifier(node) ? node.text : 'variable'}' is never reassigned. Use 'const' instead.`,
            filePath: this.currentArkFile.getFilePath() ?? '',
            fixCode: 'const'
        };
    };

    private addIssueReport(issue: Issue, ruleFix?: RuleFix): void {
        this.metaData.description = issue.message;
        const severity = this.rule.alert ?? this.metaData.severity;
        const defects = new Defects(issue.line, issue.column, issue.columnEnd, this.metaData.description, severity, this.rule.ruleId, issue.filePath,
            this.metaData.ruleDocPath, true, false, (ruleFix !== undefined ? true : false));
        this.issues.push(new IssueReport(defects, ruleFix));
        RuleListUtil.push(defects);
    };
}