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
    ts,
    ArkMethod,
    ArkFile,
    ArkAssignStmt,
    Stmt,
    ArkClass,
    Type,
    Local,
    NeverType,
    UnionType,
    IntersectionType,
    BooleanType,
    StringType,
    NumberType,
    NullType,
    UndefinedType,
    ClassType,
    AnyType,
    UnknownType,
    AstTreeUtils,
    GenericType,
    UnclearReferenceType,
    AliasType,
    VoidType,
    ArrayType,
    FunctionType
} from 'arkanalyzer/lib';
import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { BaseChecker, BaseMetaData } from '../BaseChecker';
import { Defects, IssueReport } from '../../model/Defects';
import { FileMatcher, MatcherCallback, MatcherTypes } from '../../matcher/Matchers';
import { Rule } from '../../model/Rule';
import { RuleListUtil } from '../../utils/common/DefectsList';

// 定义配置选项接口，与原始规则一致
interface Options {
    /** 是否允许any类型值在模板表达式中 */
    allowAny?: boolean;
    /** 是否允许布尔类型值在模板表达式中 */
    allowBoolean?: boolean;
    /** 是否允许null或undefined类型值在模板表达式中 */
    allowNullish?: boolean;
    /** 是否允许数字类型值在模板表达式中 */
    allowNumber?: boolean;
    /** 是否允许正则表达式类型值在模板表达式中 */
    allowRegExp?: boolean;
    /** 是否允许never类型值在模板表达式中 */
    allowNever?: boolean;
}

// 默认配置选项
const defaultOptions: Options = {
    allowAny: true,
    allowBoolean: true,
    allowNullish: true,
    allowNumber: true,
    allowRegExp: true,
};

// 设置日志记录器
const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'RestrictTemplateExpressionsCheck');
const strRegex = /^'[^']*'$|^"[^"]*"$/;
// 规则元数据
const gmetaData: BaseMetaData = {
    severity: 2,
    ruleDocPath: 'docs/restrict-template-expressions-check.md',
    description: 'Enforce template literal expressions to be of string type',
    messages: {
        invalidType: 'Invalid type "{{type}}" of template literal expression.'
    }
};

/**
 * 限制模板表达式类型的检查器
 * 该规则强制要求模板字符串表达式为字符串类型
 */
export class RestrictTemplateExpressionsCheck implements BaseChecker {
    readonly metaData: BaseMetaData = gmetaData;

    public rule: Rule;
    public defects: Defects[] = [];
    public issues: IssueReport[] = [];
    private globalStmt: Stmt;
    private globalArkMethod: ArkMethod;
    private rootNode: ts.Node;
    private errorPositions: { line: number, colum: number, sourceCode: string, type: string }[] = [];

    // 文件匹配器
    private fileMatcher: FileMatcher = {
        matcherType: MatcherTypes.FILE,
    };
    // 记录已检查过的类型，避免递归检查无限循环
    private checkedTypes = new Set<string>();

    /**
     * 注册匹配器回调
     * @returns 匹配器回调
     */
    public registerMatchers(): MatcherCallback[] {
        const matchBuildCb: MatcherCallback = {
            matcher: this.fileMatcher,
            callback: this.check
        };
        return [matchBuildCb];
    }

    /**
     * 获取规则配置选项
     * @returns 规则配置选项
     */
    private getOptions(): Options {
        if (this.rule && this.rule.option.length > 0) {
            return { ...defaultOptions, ...this.rule.option[0] } as Options;
        }
        return defaultOptions;
    }

    /**
     * 检查单个语句
     * @param stmt 语句
     */
    private checkStatement(stmt: Stmt): void {
        // 获取语句的原始文本
        const originalText = stmt.getOriginalText();
        if (!originalText) {
            return;
        }

        // 检查语句是否包含模板字符串
        if (!this.containsTemplateString(originalText)) {
            return;
        }
        this.globalStmt = stmt;
        let tsNode = AstTreeUtils.getASTNode('template', originalText);
        this.rootNode = tsNode.statements[0];
        this.checkAssignmentStatement(this.rootNode);
    }
    /**
     * 判断是否应该跳过检查该节点
     * @param node 要检查的节点
     * @returns 如果应该跳过则返回true
     */
    private shouldSkipNode(node: ts.Node): boolean {
        // 跳过 String.raw/valueOf 标签模板表达式
        if (ts.isTaggedTemplateExpression(node) &&
            ts.isPropertyAccessExpression(node.tag) &&
            ts.isIdentifier(node.tag.expression) &&
            node.tag.expression.text === 'String' &&
            (node.tag.name.text === 'raw' || node.tag.name.text === 'valueOf')) {
            return true;
        }

        // 跳过嵌套在String()函数中的表达式
        if (ts.isCallExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === 'String') {
            return true;
        }

        // 可以添加更多的条件来跳过其他类型的节点

        return false;
    }
    /**
     * 检查赋值语句
     * @param astree 表达式
     */
    private checkAssignmentStatement(astree: ts.Node): void {
        if (this.shouldSkipNode(astree)) {
            return;
        }
        if (ts.isTemplateExpression(astree)) {
            this.checkExpressionForTemplates(astree);
            return;
        }
        astree.forEachChild(child => {
            this.checkAssignmentStatement(child);
        });
    }

    /**
     * 在表达式中查找并检查模板表达式
     * @param node 表达式
     */
    private checkExpressionForTemplates(node: ts.TemplateExpression): void {
        // 检查各种类型的表达式
        if (ts.isTaggedTemplateExpression(node)) {
            return;
        }
        node.templateSpans.forEach(span => {
            let type = this.getUnderlyingType(span.expression);
            if (type && !this.isInnerUnionOrIntersectionConformingTo(type)) {
                let typeString = this.getUnderlyingTypeString(type);
                this.report(span, typeString);
            }
        });
    }

    /**
     * 获取实际类型的字符串表示
     * @param type 类型
     * @returns 实际类型的字符串表示
     */
    private getUnderlyingTypeString(type: Type): string {
        if (type instanceof ClassType) {
            let className = type.getClassSignature().getClassName();
            let arkCls = this.globalArkMethod.getDeclaringArkFile().getClassWithName(className);
            if (!className.includes('%')) {
                return `${className}`;
            }
            if (arkCls) {
                let clsString = '{';
                arkCls.getFields().forEach(field => {
                    clsString += `${field.getName()}:${this.getUnderlyingTypeString(field.getType())};`;
                });
                clsString += '}';
                return clsString;
            }
            return type.toString();

        }
        if (type instanceof FunctionType) {
            let subSignature = type.getMethodSignature().getMethodSubSignature();
            let params = subSignature.getParameters().map(param => {
                return `${param.getName()}:${this.getUnderlyingTypeString(param.getType())}`;
            }).join(',');
            return ` (${params}) => ${this.getUnderlyingTypeString(subSignature.getReturnType())}`;
        }
        if (type instanceof IntersectionType) {
            return type.getTypes().map(t => this.getUnderlyingTypeString(t)).join('&');
        }
        if (type instanceof UnionType) {
            return type.getTypes().map(t => this.getUnderlyingTypeString(t)).join('|');
        }
        if (type instanceof UnknownType) {
            return 'any';
        }
        return type.toString();
    }

    /**
     * 报告错误
     * @param node 节点
     * @param type 类型
     */
    private report(node: ts.Node, type: string): void {
        if (!this.rootNode) {
            return;
        }
        let { line, character } = this.rootNode.getSourceFile().getLineAndCharacterOfPosition(node.getStart());
        let startLine = this.globalStmt.getOriginPositionInfo().getLineNo();
        let startCol = this.globalStmt.getOriginPositionInfo().getColNo();
        this.errorPositions.push({ line: line + startLine, colum: character + startCol, sourceCode: node.getText(), type: type });
    }


    /**
     * 获取表达式的实际类型
     * @param span 表达式
     * @returns 表达式的实际类型
     */
    private getUnderlyingType(span: ts.Node): Type | undefined {
        if (ts.isIdentifier(span)) {
            let type = this.getTypeByName(span.text);
            if (type instanceof GenericType) {
                let constraint = type.getConstraint();
                let defaultType = type.getDefaultType();
                type = constraint ? constraint : defaultType ?? type;
            }
            if (type instanceof AliasType) {
                type = type.getOriginalType();
            }

            if (ts.isConditionalExpression(span.parent.parent.parent)) {
                return this.checkConditionalExpressionType(span, type);
            }
            return type;
        }
        if (ts.isStringLiteral(span)) {
            return StringType.getInstance();
        }
        if (ts.isNumericLiteral(span)) {
            return new UnclearReferenceType(span.getText());
        }
        return this.getUnderlyingTypeForExpression(span);
    }

    private getUnderlyingTypeForExpression(span: ts.Node): Type | undefined {
        if (ts.isCallExpression(span) && ts.isPropertyAccessExpression(span.expression) &&
            ts.isIdentifier(span.expression.expression) && span.expression.expression.text === 'Promise') {
            let types = span.arguments.map(arg => this.getUnderlyingType(arg));
            let filterTypes = types.filter(t => t !== undefined) as Type[];
            return new UnclearReferenceType('Promise', filterTypes.length > 0 ? filterTypes : [VoidType.getInstance()]);
        }
        if (ts.isPropertyAccessExpression(span) && ts.isIdentifier(span.expression)) {
            return this.getUnderlyingTypeForPropertyAccessExpression(span);
        }
        if (ts.isAsExpression(span)) {
            return this.getUnderlyingTypeForAsExpression(span);
        }
        if (ts.isArrayLiteralExpression(span)) {
            let types = span.elements.map(arg => this.getUnderlyingTypeForArray(arg));
            let filterTypes = types.filter(t => t !== undefined) as Type[];
            return this.getArrayElementType(filterTypes);
        }
        if (ts.isNewExpression(span) && ts.isIdentifier(span.expression)) {
            return new UnclearReferenceType(span.expression.text);
        }
        if (ts.isBinaryExpression(span)) {
            return this.getUnderTypeBinaryExpression(span);
        }
        if (ts.isOmittedExpression(span)) {
            return UndefinedType.getInstance();
        }
        return undefined;

    }

    private getUnderlyingTypeForPropertyAccessExpression(span: ts.PropertyAccessExpression): Type | undefined {
        if (!ts.isIdentifier(span.expression)) {
            return undefined;
        }
        let type = this.getTypeByName(span.expression.text);
        if (type instanceof UnknownType || type === undefined) {
            return AnyType.getInstance();
        }
        if (type instanceof UnionType) {
            let classTypes = type.getTypes().map(ty => {
                if (!(ty instanceof ClassType)) {
                    return ty;
                }
                let arkFile = this.globalArkMethod.getDeclaringArkClass().getDeclaringArkFile();
                let arkCls = arkFile.getClassWithName(ty.getClassSignature().getClassName());
                let field = arkCls?.getFieldWithName(span.name.text);
                if (field) {
                    return field.getType();
                }
                return ty;
            });
            return new UnionType(classTypes);
        }
        return type;
    }

    private getUnderlyingTypeForAsExpression(node: ts.AsExpression): Type | undefined {
        if (node.type.kind === ts.SyntaxKind.NumberKeyword) {
            return NumberType.getInstance();
        }
        if (node.type.kind === ts.SyntaxKind.StringKeyword) {
            return StringType.getInstance();
        }
        if (node.type.kind === ts.SyntaxKind.BooleanKeyword) {
            return BooleanType.getInstance();
        }
        return undefined;
    }

    private getUnderlyingTypeForArray(span: ts.Node): Type | undefined {
        if (ts.isOmittedExpression(span)) {
            return UndefinedType.getInstance();
        }
        if (ts.isStringLiteral(span)) {
            return StringType.getInstance();
        }
        if (ts.isNumericLiteral(span)) {
            return NumberType.getInstance();
        }
        return this.getUnderlyingType(span);
    }

    /**
     * 获取数组元素的类型
     * @param types 类型数组
     * @returns 数组元素的类型
     */
    private getArrayElementType(types: Type[]): Type | undefined {
        // 获取数组中每个元素的类型
        if (types.length === 0) {
            // 空数组，返回 any[] 类型
            return new ArrayType(AnyType.getInstance(), 1);
        } else if (types.length === 1) {
            // 只有一种类型，直接使用该类型作为数组元素类型
            return new ArrayType(types[0], 1);
        }
        // 检查是否所有类型都相同
        const firstTypeString = types[0].getTypeString();
        const allSameType = types.every(t => t.getTypeString() === firstTypeString);

        if (allSameType) {
            // 所有元素类型相同，直接使用第一个类型
            return new ArrayType(types[0], 1);
        } else {
            // 有多种类型，创建联合类型
            return new ArrayType(new UnionType(types), 1);
        }
    }

    /**
     * 获取二元表达式的类型
     * @param span 表达式
     * @returns 表达式的类型
     */
    private getUnderTypeBinaryExpression(span: ts.BinaryExpression): Type | undefined {
        // 获取左右两侧的类型
        let leftType = this.getUnderlyingType(span.left);
        let rightType = this.getUnderlyingType(span.right);

        // 特别处理逻辑或运算符 (||)
        if (span.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
            // 如果两边都有类型，创建联合类型
            if (leftType && rightType) {
                // 先检查两个类型是否相同，避免创建不必要的联合类型
                if (leftType.getTypeString() === rightType.getTypeString()) {
                    return leftType; // 如果类型相同，直接返回左侧类型
                }
                if ([leftType, rightType].some(t => t instanceof StringType)) {
                    return [leftType, rightType].find(t => !(t instanceof StringType));
                }
                // 类型不同，创建联合类型
                return new UnionType([leftType, rightType]);
            }
            // 如果只有一边有类型，返回那一边的类型
            return leftType || rightType;
        }

        // 其他二元运算符（如+, -, *, / 等）
        const types: Type[] = [];
        if (leftType && !this.hasType(types, leftType)) {
            types.push(leftType);
        }
        if (rightType && !this.hasType(types, rightType)) {
            types.push(rightType);
        }
        if (types.every(ty => /^\d+$/.test(ty.getTypeString()))) {
            return NumberType.getInstance();
        }
        if (types.length === 1) {
            return types[0];
        } else if (types.length > 1) {
            // 有不同类型，创建联合类型
            return new UnionType(types);
        }
        return undefined;
    }

    private hasType(types: Type[], type: Type): boolean {
        return types.some(t => t.getTypeString() === type.getTypeString());
    }

    /**
     * 检查父节点
     * @param node 当前节点
     * @returns 父节点
     */
    private checkParentNode(node: ts.Node): ts.Node | undefined {
        node = node.parent;
        if (ts.isSwitchStatement(node) || ts.isConditionalExpression(node) || ts.isIfStatement(node)) {
            return node;
        }
        node.forEachChild(child => this.checkParentNode(child));
        return undefined;
    }

    /**
     * 检查条件表达式中的类型
     * @param span 当前节点
     * @param type 变量的实际类型
     * @returns 根据条件表达式判断后的类型
     */
    private checkConditionalExpressionType(span: ts.Node, type: Type | undefined): Type | undefined {
        let conditionalExpr = span.parent.parent.parent as ts.ConditionalExpression;
        if (ts.isBinaryExpression(conditionalExpr.condition)) {
            let binaryExpr = conditionalExpr.condition;
            if (ts.isTypeOfExpression(binaryExpr.left) &&
                ts.isStringLiteral(binaryExpr.right)) {
                // 如果是 whenFalse 分支中的模板表达式，根据 typeof 检查的类型判断
                if (span.parent.parent === conditionalExpr.whenFalse && type &&
                    type.getTypeString().toLowerCase() === binaryExpr.right.text) {
                    return NeverType.getInstance();
                }
            }
        }
        return type;
    }

    /**
     * 获取变量的实际类型
     * @param name 变量名
     * @returns 变量的实际类型
     */
    private getTypeByName(name: string): Type | undefined {
        let type = undefined;
        //先检查是否当前方法入参变量
        this.globalArkMethod.getParameters().forEach(parameter => {
            if (parameter.getName() === name) {
                type = parameter.getType();
            }
        });
        if (type) {
            return type;
        }
        //再检查是否当前方法的局部变量
        let declarStmt = this.globalArkMethod.getBody()?.getCfg().getStmts().find(stmt => {
            if (stmt instanceof ArkAssignStmt && stmt.getLeftOp() instanceof Local) {
                let leftLocal = stmt.getLeftOp() as Local;
                if (leftLocal.getName() === name) {
                    return stmt;
                }
            }
            return undefined;
        });
        if (declarStmt instanceof ArkAssignStmt) {
            let rightOp = declarStmt.getRightOp();
            let leftOp = declarStmt.getLeftOp();
            let ast = this.getAstTree(declarStmt.getOriginalText() ?? '');
            if (leftOp instanceof Local && (ts.isVariableStatement(ast) || ts.isVariableDeclaration(ast))) {
                type = this.getVariableType(ast, name, leftOp);
            }
            if (type) {
                return type;
            }
            if (leftOp) {
                type = leftOp.getType();
            }
            if (type === undefined && rightOp) {
                type = rightOp.getType();
            }
        }

        if (!type) {
            let method = this.globalArkMethod.getDeclaringArkClass().getMethodWithName(name);
            if (method) {
                type = new FunctionType(method.getSignature());
            }
        }

        return type ? type : undefined;
    }

    private getVariableType(ast: ts.VariableStatement | ts.VariableDeclaration, name: string, leftOp: Local): Type | undefined {
        if (ts.isVariableStatement(ast)) {
            let declaration = ast.declarationList.declarations.find(declaration =>
                ts.isIdentifier(declaration.name) && declaration.name.getText() === name);
            if (declaration) {
                return this.getVariableType(declaration, name, leftOp);
            }
        }
        if (ts.isVariableDeclaration(ast) && !ast.type && ast.initializer) {
            if (ts.isConditionalExpression(ast.initializer)) {
                let condition = ast.initializer;
                if (condition.whenTrue.kind !== condition.whenFalse.kind) {
                    let whenTrue = new UnclearReferenceType(condition.whenTrue.getText());
                    let whenFalse = new UnclearReferenceType(condition.whenFalse.getText());
                    return new UnionType([whenTrue, whenFalse]);
                }
            }

            if (leftOp.getConstFlag() &&
                ([ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword].includes(ast.initializer.kind) ||
                    ts.isNumericLiteral(ast.initializer))) {
                return new UnclearReferenceType(ast.initializer.getText());
            }
        }
        if (ts.isVariableDeclaration(ast) && ast.type && ts.isUnionTypeNode(ast.type) &&
            ast.initializer && ts.isLiteralExpression(ast.initializer)) {
            let literalType = ast.initializer.kind;
            if (literalType === ts.SyntaxKind.StringLiteral) {
                return StringType.getInstance();
            }
            if (literalType === ts.SyntaxKind.NumericLiteral) {
                return NumberType.getInstance();
            }
        }
        return undefined;
    }

    private getAstTree(text: string): ts.Node {
        let ast = AstTreeUtils.getASTNode('template', text);
        return ast.statements[0] ?? ast;
    }

    /**
     * 检查是否为内部联合或交集类型
     * @param type 类型
     * @returns 是否为内部联合或交集类型
     */
    private isInnerUnionOrIntersectionConformingTo(type: Type): boolean {
        if (type instanceof UnionType) {
            return type.getTypes().every(t => {
                return this.isInnerUnionOrIntersectionConformingTo(t) || t instanceof NeverType;
            });
        }
        if (type instanceof IntersectionType) {
            return type.getTypes().some(t => this.isInnerUnionOrIntersectionConformingTo(t));
        }
        return this.isTypePrimitive(type);
    }

    /**
     * 检查是否为字符串类型
     * @param type 类型
     * @returns 是否为字符串类型
     */
    private isStringType(type: Type): boolean {
        if (type instanceof StringType) {
            return true;
        }
        if (type instanceof UnclearReferenceType) {
            const typeName = type.getName();
            if (strRegex.test(typeName)) {
                return true;
            }
        }
        return false;
    }

    /**
     * 检查是否为原始类型
     * @param type 类型
     * @returns 是否为原始类型
     */
    private isTypePrimitive(type: Type): boolean {
        let options = this.getOptions();
        if (this.isStringType(type)) {
            return true;
        }
        if (options.allowNumber && this.isNumberType(type)) {
            return true;
        }
        if (options.allowBoolean && this.isBooleanType(type)) {
            return true;
        }
        if (options.allowAny && this.isAnyType(type)) {
            return true;
        }
        if (options.allowRegExp && this.isRegExpType(type)) {
            return true;
        }
        if (options.allowNullish && this.isNullishType(type)) {
            return true;
        }
        if (options.allowNever && this.isNeverType(type)) {
            return true;
        }
        return false;
    }

    /**
     * 检查是否为Any类型
     */
    private isAnyType(type: Type): boolean {
        return type instanceof AnyType || type instanceof UnknownType ||
            (type instanceof UnclearReferenceType && type.getName() === 'T');
    }

    /**
     * 检查是否为布尔类型
     */
    private isBooleanType(type: Type): boolean {
        if (type instanceof BooleanType) {
            return true;
        }
        if (type instanceof UnclearReferenceType && ['boolean', 'Boolean', 'true', 'false'].includes(type.getName())) {
            return true;
        }
        return false;
    }

    /**
     * 检查是否为数字类型
     */
    private isNumberType(type: Type): boolean {
        if (type instanceof NumberType) {
            return true;
        }
        if (type instanceof UnclearReferenceType &&
            (type.getName() === 'number' || type.getName() === 'Number' || /^\d+$/.test(type.getName()))) {
            return true;
        }
        return false;
    }

    /**
     * 检查是否为null或undefined类型
     */
    private isNullishType(type: Type): boolean {
        return type instanceof NullType || type instanceof UndefinedType ||
            (type instanceof UnclearReferenceType && (type.getName() === 'null' || type.getName() === 'Null'));
    }

    /**
     * 检查是否为RegExp类型
     */
    private isRegExpType(type: Type): boolean {
        if (type instanceof ClassType) {
            return type.getClassSignature().getClassName() === 'RegExp';
        }
        if (type instanceof UnclearReferenceType) {
            return type.getName() === 'RegExp';
        }
        return false;
    }

    /**
     * 检查是否为Never类型（在ArkTS中可能没有直接对应）
     */
    private isNeverType(type: Type): boolean {
        // 在ArkTS中可能没有直接对应never类型，这里简化处理
        // 可以根据实际需求调整此处逻辑
        return type instanceof NeverType || type.toString().includes('never');
    }

    /**
     * 判断文本中是否包含模板字符串
     */
    private containsTemplateString(text: string): boolean {
        return /\$\{(.*?)\}/g.test(text);
    }

    /**
     * 检查Ark类
     * @param arkCls 类
     */
    private checkArkCls(arkCls: ArkClass): void {
        let methods = arkCls.getMethods();
        methods.forEach(method => {
            this.checkArkMethod(method);
        });
    }

    /**
     * 检查Ark方法
     * @param method 方法
     */
    private checkArkMethod(method: ArkMethod): void {
        this.globalArkMethod = method;
        // 重置已检查类型的集合
        const statements = method.getBody()?.getCfg().getStmts() ?? [];
        // 遍历所有语句进行检查
        for (const stmt of statements) {
            this.checkStatement(stmt);
        }
    }

    /**
     * 检查方法入口点
     */
    public check = (arkFile: ArkFile): void => {
        // 重置已检查类型的集合
        this.checkedTypes.clear();
        arkFile.getClasses().forEach(cls => {
            this.checkArkCls(cls);
        });
        this.sortAndReportErrors(arkFile);
    };

    /**
     * 排序并报告错误
     * @param target 目标文件
     */
    private sortAndReportErrors(target: ArkFile): void {
        this.errorPositions.sort((a, b) => {
            if (a.line !== b.line) {
                return a.line - b.line;
            }
            return a.colum - b.colum;
        });
        this.errorPositions.forEach(position => {
            this.addIssueReport(target, position.line, position.colum, position.sourceCode, position.type);
        });
    }

    /**
     * 报告错误
     */
    private addIssueReport(arkFile: ArkFile, lineNum: number, startColum: number, code: string, type: string): void {
        const severity = this.rule.alert ?? this.metaData.severity;
        let message = `Invalid type "${type}" of template literal expression.`;
        let filePath = arkFile.getFilePath();
        let endColum = startColum + code.length - 1;
        let defect = new Defects(
            lineNum,
            startColum,
            endColum,
            message,
            severity,
            this.rule.ruleId,
            filePath,
            this.metaData.ruleDocPath,
            true,
            false,
            false
        );
        this.issues.push(new IssueReport(defect, undefined));
        RuleListUtil.push(defect);
    }
}