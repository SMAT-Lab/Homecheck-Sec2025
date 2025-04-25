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

import { AliasType, ArrayType, ClassType, FunctionType, GenericType, TupleType, Type, UnclearReferenceType, UnionType } from "arkanalyzer";

/**
 * 检查类型是否为指定类型
 * 
 * @param appointType 指定类型
 * @param type 被检查类型
 * @returns 
 */
export function isAppointType(appointType: Type, type: Type): boolean {

  if (appointType.getTypeString() === type.getTypeString()) {
    return true;
  }

  if (type instanceof ArrayType) {
    return isAppointType(appointType, type.getBaseType());
  }

  if (type instanceof UnclearReferenceType) {
    return generic(appointType, type.getGenericTypes());
  }

  if (type instanceof UnionType) {
    return generic(appointType, type.getTypes());
  }

  if (type instanceof FunctionType) {
    return generic(appointType, type.getRealGenericTypes());
  }

  if (type instanceof ClassType) {
    return generic(appointType, type.getRealGenericTypes());
  }

  if (type instanceof TupleType) {
    return generic(appointType, type.getTypes());
  }

  if (type instanceof AliasType) {
    return isAppointType(appointType, type.getOriginalType());
  }

  if (type instanceof GenericType) {
    let defType = type.getDefaultType();
    let constraintType = type.getConstraint();
    return (defType ? isAppointType(appointType, defType) : false) ||
      (constraintType ? isAppointType(appointType, constraintType) : false);
  }
  return false;
}

function generic(appointType: Type, type: Type[] | undefined): boolean {
  if (!type) {
    return false;
  }
  for (const t of type) {
    if (isAppointType(appointType, t)) {
      return true;
    }
  }
  return false;
}

/**
 * 递归替换类型中的指定类型
 * 
 * @param appointType 指定类型
 * @param type 需要被替换的类型
 * @param newType 新的类型
 * @returns 
 */
export function fixAppointType(appointType: Type, type: Type, newType: Type): Type {
  if (appointType.getTypeString() === type.getTypeString()) {
    return newType;
  }

  if (type instanceof ArrayType) {
    type.setBaseType(fixAppointType(appointType, type.getBaseType(), newType));
    return type;
  }

  if (type instanceof UnclearReferenceType) {
    return handleUnclearReferenceType(appointType, type, newType);
  }

  if (type instanceof UnionType) {
    return handleUnionType(appointType, type, newType);
  }

  if (type instanceof FunctionType) {
    return handleFunctionType(appointType, type, newType);
  }

  if (type instanceof ClassType) {
    return handleClassType(appointType, type, newType);
  }

  if (type instanceof TupleType) {
    return handleTupleType(appointType, type, newType);
  }

  if (type instanceof AliasType) {
    type.setOriginalType(fixAppointType(appointType, type.getOriginalType(), newType));
    return type;
  }

  if (type instanceof GenericType) {
    return handleGenericType(appointType, type, newType);
  }
  return type;
}

// 处理 UnclearReferenceType 的逻辑
function handleUnclearReferenceType(appointType: Type, type: UnclearReferenceType, newType: Type): Type {
  const genericTypes = type.getGenericTypes() || [];
  for (let i = 0; i < genericTypes.length; i++) {
    genericTypes[i] = fixAppointType(appointType, genericTypes[i], newType);
  }
  return new UnclearReferenceType(type.getName(), genericTypes);
}

// 处理 UnionType 的逻辑
function handleUnionType(appointType: Type, type: UnionType, newType: Type): Type {
  const unionTypes = type.getTypes() || [];
  for (let i = 0; i < unionTypes.length; i++) {
    unionTypes[i] = fixAppointType(appointType, unionTypes[i], newType);
  }
  return new UnionType(unionTypes);
}

// 处理 FunctionType 的逻辑
function handleFunctionType(appointType: Type, type: FunctionType, newType: Type): Type {
  const realGenericTypes = type.getRealGenericTypes() || [];
  for (let i = 0; i < realGenericTypes.length; i++) {
    realGenericTypes[i] = fixAppointType(appointType, realGenericTypes[i], newType);
  }
  return new FunctionType(type.getMethodSignature(), realGenericTypes);
}

// 处理 ClassType 的逻辑
function handleClassType(appointType: Type, type: ClassType, newType: Type): Type {
  const realGenericTypes = type.getRealGenericTypes() || [];
  for (let i = 0; i < realGenericTypes.length; i++) {
    realGenericTypes[i] = fixAppointType(appointType, realGenericTypes[i], newType);
  }
  type.setRealGenericTypes(realGenericTypes);
  return type;
}

// 处理 TupleType 的逻辑
function handleTupleType(appointType: Type, type: TupleType, newType: Type): Type {
  const tupleTypes = type.getTypes() || [];
  for (let i = 0; i < tupleTypes.length; i++) {
    tupleTypes[i] = fixAppointType(appointType, tupleTypes[i], newType);
  }
  return new TupleType(tupleTypes);
}

// 处理 GenericType 的逻辑
function handleGenericType(appointType: Type, type: GenericType, newType: Type): Type {
  let defType = type.getDefaultType();
  let constraintType = type.getConstraint();
  if (defType) {
    defType = fixAppointType(appointType, defType, newType);
  }
  if (constraintType) {
    constraintType = fixAppointType(appointType, constraintType, newType);
  }
  if (defType) {
    type.setDefaultType(defType);
  }

  if (constraintType) {
    type.setConstraint(constraintType);
  }
  return type;
}


/**
 * 检查类型中是否有不明确的引用类型
 * 
 * @param type 被检查类型
 * @returns 
 */
export function isUnclearReferenceType(type: Type): boolean {

  if (type instanceof ArrayType) {
    return isUnclearReferenceType(type.getBaseType());
  }

  if (type instanceof UnclearReferenceType) {
    return true;
  }

  if (type instanceof UnionType) {
    return traversalType(type.getTypes());
  }

  if (type instanceof FunctionType) {
    return traversalType(type.getRealGenericTypes());
  }

  if (type instanceof ClassType) {
    return traversalType(type.getRealGenericTypes());
  }

  if (type instanceof TupleType) {
    return traversalType(type.getTypes());
  }

  if (type instanceof AliasType) {
    return isUnclearReferenceType(type.getOriginalType());
  }

  if (type instanceof GenericType) {
    let defType = type.getDefaultType();
    let constraintType = type.getConstraint();
    return (defType ? isUnclearReferenceType(defType) : false) ||
      (constraintType ? isUnclearReferenceType(constraintType) : false);
  }
  return false;
}

/**
 * 遍历类型数组
 * 
 * @param types 
 * @returns 
 */
function traversalType(types: Type[] | undefined): boolean {
  if (!types) {
    return false;
  }
  for (const t of types) {
    if (isUnclearReferenceType(t)) {
      return true;
    }
  }
  return false;
}