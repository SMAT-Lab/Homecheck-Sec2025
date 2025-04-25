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

/**
 * Record the module in the module.json5.
 */
export interface moduleJson5Module {
    name: string;
    type: string;
    description: string;
    mainElement: string;
    deviceTypes: string[];
    deliveryWithInstall: boolean;
    installationFree: boolean;
    abilities: moduleAbility[];
    extensionAbilities: extensionAbility[];
}

/**
 * Record the ability in the module.
 */
export interface moduleAbility {
    name: string;
    srcEntry: string;
    description: string;
    icon: string;
    label: string;
    startWindowIcon: string;
    startWindowBackground: string;
    exported: boolean;
    skills: abilitySkill[];
}

/**
 * Record the skill in the ability.
 */
interface abilitySkill {
    entities: string[];
    actions: string[];
}

/**
 * Record the extensionAbility in the module.
 */
export interface extensionAbility {
    name: string;
    srcEntry: string;
    description: string;
    icon: string;
    label: string;
    type: string;
    metadata: extensionAbilityMetadata[];
}

/**
 * Record the metadata in the extensionAbility.
 */
interface extensionAbilityMetadata {
    name: string;
    resource: string;
}

/**
 * Record the app in the app.json5.
 */
export interface appJson5App {
    bundleName: string;
    vendor: string;
    versionCode: number;
    versionName: string;
    devicetypes: string[];
    icon: string;
    label: string;
}