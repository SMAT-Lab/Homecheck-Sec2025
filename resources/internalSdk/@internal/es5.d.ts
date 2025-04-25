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

interface ObjectConstructor {
    new (value?: any): Object;
    (): any;
    (value: any): any;

    readonly prototype: Object;

    getPrototypeOf(o: any): any;

    getOwnPropertyDescriptor(o: any, p: PropertyKey): PropertyDescriptor | undefined;

    getOwnPropertyNames(o: any): string[];

    create(o: object | null): any;

    create(o: object | null, properties: PropertyDescriptorMap & ThisType<any>): any;

    defineProperty<T>(o: T, p: PropertyKey, attributes: PropertyDescriptor & ThisType<any>): T;

    defineProperties<T>(o: T, properties: PropertyDescriptorMap & ThisType<any>): T;

    seal<T>(o: T): T;

    freeze<T extends Function>(f: T): T;

    freeze<T extends { [idx: string]: U | null | undefined | object; }, U extends string | bigint | number | boolean | symbol>(o: T): Readonly<T>;

    freeze<T>(o: T): Readonly<T>;

    preventExtensions<T>(o: T): T;

    isSealed(o: any): boolean;

    isFrozen(o: any): boolean;

    isExtensible(o: any): boolean;

    keys(o: object): string[];
}

declare var Object: ObjectConstructor;