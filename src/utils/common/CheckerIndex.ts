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

import Logger, { LOG_MODULE_TYPE } from 'arkanalyzer/lib/utils/logger';
import { ArrayDefinitionCheck } from '../../checker/performance/ArrayDefinitionCheck';
import { AvoidEmptyCallbackCheck } from '../../checker/performance/AvoidEmptyCallbackCheck';
import { AvoidUpdateAutoStateVarAboutToReuseCheck } from '../../checker/performance/AvoidUpdateAutoStateVarAboutToReuseCheck';
import { ConstantPropertyReferencingInLoopsCheck } from '../../checker/performance/ConstantPropertyReferencingInLoopsCheck';
import { EffectkitBlurCheck } from '../../checker/performance/EffectkitBlurCheck';
import { ForeachArgsCheck } from '../../checker/performance/ForEachArgsCheck';
import { ForeachIndexCheck } from '../../checker/performance/ForeachIndexCheck';
import { LottieAnimationDestoryCheck } from '../../checker/performance/LottieAnimationDestoryCheck';
import { HighFrequencyLogCheck } from '../../checker/performance/HighFrequencyLogCheck';
import { LayoutPropertiesScaleCheck } from '../../checker/performance/LayoutPropertiesScaleCheck';
import { RemoveRedundantStateVarCheck } from '../../checker/performance/RemoveRedundantStateVarCheck';
import { TimezoneInterfaceCheck } from '../../checker/performance/TimezoneInterfaceCheck';
import { TypedArrayCheck } from '../../checker/performance/TypedArrayCheck';
import { UseObjectLinkToReplacePropCheck } from '../../checker/performance/UseObjectLinkToReplacePropCheck';
import { WebCacheModeCheck } from '../../checker/performance/WebCacheModeCheck';
import { SparseArrayCheck } from '../../checker/performance/SparseArrayCheck';
import { WaterFlowUpdateDataCheck } from '../../checker/performance/WaterFlowUpdateDataCheck';
import { UnionTypeArrayCheck } from '../../checker/performance/UnionTypeArrayCheck';
import { OptionalParametersCheck } from '../../checker/performance/OptionalParametersCheck';
import { UseGridLayoutOptionsCheck } from '../../checker/performance/UseGridLayoutOptionsCheck';
import { RemoveUnchangedStateVarCheck } from '../../checker/performance/RemoveUnchangedStateVarCheck';
import { JsCodeCacheByPrecompileCheck } from '../../checker/performance/JsCodeCacheByPrecompileCheck';
import { JsCodeCacheByInterceptionCheck } from '../../checker/performance/JsCodeCacheByInterceptionCheck';
import { ImageInterpolationCheck } from '../../checker/correctness/ImageInterpolationCheck';
import { AudioInterruptCheck } from '../../checker/correctness/AudioInterruptCheck';
import { AudioPauseOrMuteCheck } from '../../checker/correctness/AudioPauseOrMuteCheck';
import { AvsessionButtonsCheck } from '../../checker/correctness/AvsessionButtonsCheck';
import { AvsessionMetadataCheck } from '../../checker/correctness/AvsessionMetadataCheck';
import { ImagePixelFormatCheck } from '../../checker/correctness/ImagePixelFormatCheck';
import { ImageSyncLoadCheck } from '../../checker/performance/ImageSyncLoadCheck';
import { ListInScrollCheck } from '../../checker/performance/ListInScrollCheck';
import { MultipleAssociationsStateVarCheck } from '../../checker/performance/MultipleAssociationsStateVarCheck';
import { NumberInitCheck } from '../../checker/performance/NumberInitCheck';
import { SetCachedCountForLazyforeachCheck } from '../../checker/performance/SetCachedCountForLazyforeachCheck';
import { StartWindowIconCheck } from '../../checker/performance/StartWindowIconCheck';
import { SymbolUsageCheck } from '../../checker/security/SymbolUsageCheck';
import { WebOnActiveCheck } from '../../checker/performance/WebOnActiveCheck';
import { GifHardwareDecodingCheck } from '../../checker/performance/GifHardwareDecodingCheck';
import { ModuleTopLevelCodeCheck } from '../../checker/performance/ModuleTopLevelCodeCheck';
import { NoFloatingPromisesCheck } from '../../checker/ArkTS-eslint/NoFloatingPromisesCheck';

// @ArkTS-eslint
import { InitDeclarationsCheck } from '../../checker/ArkTS-eslint/InitDeclarationsCheck';
import { DefaultParamLastCheck } from '../../checker/ArkTS-eslint/DefaultParamLastCheck';
import { ExplicitFunctionReturnTypeCheck } from '../../checker/ArkTS-eslint/ExplicitFunctionReturnTypeCheck';
import { ExplicitModuleBoundaryTypesCheck } from '../../checker/ArkTS-eslint/ExplicitModuleBoundaryTypesCheck';
import { NoDupeClassMembersCheck } from '../../checker/ArkTS-eslint/NoDupeClassMembersCheck';
import { BanTsCommentCheck } from '../../checker/ArkTS-eslint/BanTsCommentCheck';
import { MemberOrderingCheck } from '../../checker/ArkTS-eslint/MemberOrderingCheck';
import { NoUnnecessaryConditionCheck } from '../../checker/ArkTS-eslint/NoUnnecessaryConditionCheck';
import { NoUnnecessaryQualifierCheck } from '../../checker/ArkTS-eslint/NoUnnecessaryQualifierCheck';
import { NoUnnecessaryTypeArgumentsCheck } from '../../checker/ArkTS-eslint/NoUnnecessaryTypeArgumentsCheck';
import { NoUnnecessaryTypeAssertionCheck } from '../../checker/ArkTS-eslint/NoUnnecessaryTypeAssertionCheck';
import { ValidTypeofCheck } from '../../checker/ArkTS-eslint/ValidTypeofCheck';
import { ArrayTypeCheck } from '../../checker/ArkTS-eslint/ArrayTypeCheck';
import { NoUselessBackreferenceCheck } from '../../checker/ArkTS-eslint/NoUselessBackreferenceCheck';
import { BanTSLintCommentCheck } from '../../checker/ArkTS-eslint/BanTSLintCommentCheck';
import { BanTypesCheck } from '../../checker/ArkTS-eslint/BanTypesCheck';
import { BraceStyleCheck } from '../../checker/ArkTS-eslint/BraceStyleCheck';
import { NoUnsafeOptionalChainingCheck } from '../../checker/ArkTS-eslint/NoUnsafeOptionalChainingCheck';
import { NoUselessEscapeCheck } from '../../checker/ArkTS-eslint/NoUselessEscapeCheck';
import { NoThisAliasCheck } from '../../checker/ArkTS-eslint/NoThisAliasCheck';
import { NoNonNullAssertionCheck } from '../../checker/ArkTS-eslint/NoNonNullAssertionCheck';
import { NoMisusedNewCheck } from '../../checker/ArkTS-eslint/NoMisusedNewCheck';
import { NoRequireImportsCheck } from '../../checker/ArkTS-eslint/NoRequireImportsCheck';
import { NoParameterPropertiesCheck } from '../../checker/ArkTS-eslint/NoParameterPropertiesCheck';
import { NoRedeclareCheck } from '../../checker/ArkTS-eslint/NoRedeclareCheck';
import { NoShadowCheck } from '../../checker/ArkTS-eslint/NoShadowCheck';
import { NoNonNullAssertedOptionalChainCheck } from '../../checker/ArkTS-eslint/NoNonNullAssertedOptionalChainCheck';
import { ConsistentTypeAssertionsCheck } from '../../checker/ArkTS-eslint/ConsistentTypeAssertionsCheck';
import { ConsistentTypeDefinitionsCheck } from '../../checker/ArkTS-eslint/ConsistentTypeDefinitionsCheck';
import { ConsistentTypeImportsCheck } from '../../checker/ArkTS-eslint/ConsistentTypeImportsCheck';
import { ConsistentIndexedObjectStyleCheck } from '../../checker/ArkTS-eslint/ConsistentIndexedObjectStyleCheck';
import { NoUselessCatchCheck } from '../../checker/ArkTS-eslint/NoUselessCatchCheck';
import { NoNewWrappersCheck } from '../../checker/ArkTS-eslint/NoNewWrappersCheck';
import { NoCondAssignCheck } from '../../checker/ArkTS-eslint/NoCondAssignCheck';
import { MaxLinesPerFunctionCheck } from '../../checker/ArkTS-eslint/MaxLinesPerFunctionCheck';
import { NoDuplicateImportsCheck } from '../../checker/ArkTS-eslint/NoDuplicateImportsCheck';
import { NoForInArrayCheck } from '../../checker/ArkTS-eslint/NoForInArrayCheck';
import { NoLoopFuncCheck } from '../../checker/ArkTS-eslint/NoLoopFuncCheck';
import { NoLossOfPrecisionCheck } from '../../checker/ArkTS-eslint/NoLossOfPrecisionCheck';
import { NoExtraneousClassCheck } from '../../checker/ArkTS-eslint/NoExtraneousClassCheck';
import { NoArrayConstructorCheck } from '../../checker/ArkTS-eslint/NoArrayConstructorCheck';
import { NoCaseDeclarationsCheck } from '../../checker/ArkTS-eslint/NoCaseDeclarationsCheck';
import { NoUnsafeAssignmentCheck } from '../../checker/ArkTS-eslint/NoUnsafeAssignmentCheck';
import { MaxLinesCheck } from '../../checker/ArkTS-eslint/MaxLinesCheck';
import { DefaultCaseCheck } from '../../checker/ArkTS-eslint/DefaultCaseCheck';
import { DefaultCaseLastCheck } from '../../checker/ArkTS-eslint/DefaultCaseLastCheck';
import { UseIsNaNCheck } from '../../checker/ArkTS-eslint/UseIsNaNCheck';
import { TypedefCheck } from '../../checker/ArkTS-eslint/TypedefCheck';
import { NoNameSpaceCheck } from '../../checker/ArkTS-eslint/NoNameSpaceCheck';
import { MaxDepthCheck } from '../../checker/ArkTS-eslint/MaxDepthCheck';
import { MaxClassesPerFileCheck } from '../../checker/ArkTS-eslint/MaxClassesPerFileCheck';
import { MaxNestedCallbacksCheck } from '../../checker/ArkTS-eslint/MaxNestedCallbacksCheck';
import { NoAsyncPromiseExecutorCheck } from '../../checker/ArkTS-eslint/NoAsyncPromiseExecutorCheck';
import { NoUnsafeCallCheck } from '../../checker/ArkTS-eslint/NoUnsafeCallCheck';
import { NoUnnecessaryTypeConstraintCheck } from '../../checker/ArkTS-eslint/NoUnnecessaryTypeConstraintCheck';
import { NoUnsafeArgumentCheck } from '../../checker/ArkTS-eslint/NoUnsafeArgumentCheck';
import { NoControlRegexCheck } from '../../checker/ArkTS-eslint/NoControlRegexCheck';
import { NoEmptyCharacterClassCheck } from '../../checker/ArkTS-eslint/NoEmptyCharacterClassCheck';
import { NoInvalidRegexpCheck } from '../../checker/ArkTS-eslint/NoInvalidRegexpCheck';
import { NoExAssignCheck } from '../../checker/ArkTS-eslint/NoExAssignCheck';
import { NoOctalCheck } from '../../checker/ArkTS-eslint/NoOctalCheck';
import { RequireAwaitCheck } from '../../checker/ArkTS-eslint/RequireAwaitCheck';
import { SwitchExhaustivenessCheck } from '../../checker/ArkTS-eslint/SwitchExhaustivenessCheck';
import { UnifiedSignaturesCheck } from '../../checker/ArkTS-eslint/UnifiedSignaturesCheck';
import { NoUnexpectedMultilineCheck } from '../../checker/ArkTS-eslint/NoUnexpectedMultilineCheck';
import { NoUnreachableCheck } from '../../checker/ArkTS-eslint/NoUnreachableCheck';
import { NoInferrableTypesCheck } from '../../checker/ArkTS-eslint/NoInferrableTypesCheck';
import { SpaceInfixOpsCheck } from '../../checker/ArkTS-eslint/SpaceInfixOpsCheck';
import { SpaceBeforeFunctionParenCheck } from '../../checker/ArkTS-eslint/SpaceBeforeFunctionParenCheck';
import { NoRestrictedSyntaxCheck } from '../../checker/ArkTS-eslint/NoRestrictedSyntaxCheck';
import { AdjacentOverloadSignaturesCheck } from '../../checker/ArkTS-eslint/AdjacentOverloadSignaturesCheck';
import { ClassLiteralPropertyStyleCheck } from '../../checker/ArkTS-eslint/ClassLiteralPropertyStyleCheck';
import { NoEmptyFunctionCheck } from '../../checker/ArkTS-eslint/NoEmptyFunctionCheck';
import { PreferForOfCheck } from '../../checker/ArkTS-eslint/PreferForOfCheck';
import { NoConfusingNonNullAssertionCheck } from '../../checker/ArkTS-eslint/NoConfusingNonNullAssertionCheck';
import { NoMagicNumbersCheck } from '../../checker/ArkTS-eslint/NoMagicNumbersCheck';
import { AwaitThenableCheck } from '../../checker/ArkTS-eslint/AwaitThenableCheck';
import { NoUselessConstructorCheck } from '../../checker/ArkTS-eslint/NoUselessConstructorCheck';
import { PreferEnumInitializwersCheck } from '../../checker/ArkTS-eslint/PreferEnumInitializwersCheck';
import { PreferLiteralEnumMemberCheck } from '../../checker/ArkTS-eslint/PreferLiteralEnumMemberCheck';
import { PreferReadonlyParametertypesCheck } from '../../checker/ArkTS-eslint/PreferReadonlyParametertypesCheck';
import { RequireArraySortCompareCheck } from '../../checker/ArkTS-eslint/RequireArraySortCompareCheck';
import { NoUnusedVarsCheck } from '../../checker/ArkTS-eslint/NoUnusedVarsCheck';
import { NoInvalidVoidTypeCheck } from '../../checker/ArkTS-eslint/NoInvalidVoidTypeCheck';
import { NoInvalidThisCheck } from '../../checker/ArkTS-eslint/NoInvalidThisCheck';
import { NoFallthroughCheck } from '../../checker/ArkTS-eslint/NoFallthroughCheck';
import { NoBaseToStringCheck } from '../../checker/ArkTS-eslint/NoBaseToStringCheck';
import { NoExplicitAnyCheck } from '../../checker/ArkTS-eslint/NoExplicitAnyCheck';
import { NamingConventionCheck } from '../../checker/ArkTS-eslint/NamingConventionCheck';
import { NoUnusedExpressionsCheck } from '../../checker/ArkTS-eslint/NoUnusedExpressionsCheck';
import { NoUnsafeMemberAccessCheck } from '../../checker/ArkTS-eslint/NoUnsafeMemberAccessCheck';
import { NoThrowLiteralCheck } from '../../checker/ArkTS-eslint/NoThrowLiteralCheck';
import { EqeqeqCheck } from '../../checker/ArkTS-eslint/EqeqeqCheck';
import { NoExtraSemiCheck } from '../../checker/ArkTS-eslint/NoExtraSemiCheck';
import { CommaDangleCheck } from '../../checker/ArkTS-eslint/CommaDangleCheck';
import { PreferRegexpExecCheck } from '../../checker/ArkTS-eslint/PreferRegexpExecCheck';
import { PreferTsExpectErrorCheck } from '../../checker/ArkTS-eslint/PreferTsExpectErrorCheck';
import { DotNotationCheck } from '../../checker/ArkTS-eslint/DotNotationCheck';
import { ExplicitMemberAccessibilityCheck } from '../../checker/ArkTS-eslint/ExplicitMemberAccessibilityCheck';
import { NoExtraParensCheck } from '../../checker/ArkTS-eslint/NoExtraParensCheck';
import { NoDynamicDeleteCheck } from '../../checker/ArkTS-eslint/NoDynamicDeleteCheck';
import { NoImplicitAnyCatchCheck } from '../../checker/ArkTS-eslint/NoImplicitAnyCatchCheck';
import { NoEmptyInterfaceCheck } from '../../checker/ArkTS-eslint/NoEmptyInterfaceCheck';
import { NoUnsafeFinallyCheck } from '../../checker/ArkTS-eslint/NoUnsafeFinallyCheck';
import { PreferFunctionTypeCheck } from '../../checker/ArkTS-eslint/PreferFunctionTypeCheck';
import { PreferNamespaceKeywordCheck } from '../../checker/ArkTS-eslint/PreferNamespaceKeywordCheck';
import { PreferNullishCoalescingCheck } from '../../checker/ArkTS-eslint/PreferNullishCoalescingCheck';
import { ReturnAwaitCheck } from '../../checker/ArkTS-eslint/ReturnAwaitCheck';
import { PreferReduceTypeParameterCheck } from '../../checker/ArkTS-eslint/PreferReduceTypeParameterCheck';
import { CommaSpacingCheck } from '../../checker/ArkTS-eslint/CommaSpacingCheck';
import { NoExtraNonNullAssertionCheck } from '../../checker/ArkTS-eslint/NoExtraNonNullAssertionCheck';
import { NoTypeAliasCheck } from '../../checker/ArkTS-eslint/NoTypeAliasCheck';
import { NoMisusedPromisesCheck } from '../../checker/ArkTS-eslint/NoMisusedPromisesCheck';
import { TypeAnnotationSpacingCheck } from '../../checker/ArkTS-eslint/TypeAnnotationSpacingCheck';
import { StrictBooleanExpressionsCheck } from '../../checker/ArkTS-eslint/StrictBooleanExpressionsCheck';
import { SemiCheck } from '../../checker/ArkTS-eslint/SemiCheck';
import { NoArrayConstructorTSCheck } from '../../checker/ArkTS-eslint/NoArrayConstructorTSCheck';
import { PreferStringStartsEndsWithCheck } from '../../checker/ArkTS-eslint/PreferStringStartsEndsWithCheck';
import { PromiseFunctionAsyncCheck } from '../../checker/ArkTS-eslint/PromiseFunctionAsyncCheck';
import { KeywordSpacingCheck } from '../../checker/ArkTS-eslint/KeywordSpacingCheck';
import { FuncCallSpacingCheck } from '../../checker/ArkTS-eslint/FuncCallSpacingCheck';
import { MethodSignatureStyleCheck } from '../../checker/ArkTS-eslint/MethodSignatureStyleCheck';
import { LinesBetweenClassMembersCheck } from '../../checker/ArkTS-eslint/LinesBetweenClassMembersCheck';
import { MemberDelimiterStyleCheck } from '../../checker/ArkTS-eslint/MemberDelimiterStyleCheck';
import { NoUnsafeReturnCheck } from '../../checker/ArkTS-eslint/NoUnsafeReturnCheck';
import { PreferReadonlyCheck } from '../../checker/ArkTS-eslint/PreferReadonlyCheck';
import { NoUseBeforeDefineCheck } from '../../checker/ArkTS-eslint/NoUseBeforeDefineCheck';
import { PreferAsConstCheck } from '../../checker/ArkTS-eslint/PreferAsConstCheck';
import { QuotesCheck } from '../../checker/ArkTS-eslint/QuotesCheck';
import { NoRegexSpacesCheck } from '../../checker/ArkTS-eslint/NoRegexSpacesCheck';
import { PreferOptionalChainCheck } from '../../checker/ArkTS-eslint/PreferOptionalChainCheck';
import { NoTrailingSpacesCheck } from '../../checker/ArkTS-eslint/NoTrailingSpacesCheck';
import { NoExtraBooleanCastCheck } from '../../checker/ArkTS-eslint/NoExtraBooleanCastCheck';
import { NoConfusingVoidExpressionCheck } from '../../checker/ArkTS-eslint/NoConfusingVoidExpressionCheck';
import { PreferArrowCallbackCheck } from '../../checker/ArkTS-eslint/PreferArrowCallbackCheck';
import { NoUnnecessaryBooleanLiteralCompareCheck } from '../../checker/ArkTS-eslint/NoUnnecessaryBooleanLiteralCompareCheck';
import { NoImpliedEvalCheck } from '../../checker/ArkTS-eslint/NoImpliedEvalCheck';
import { PreferConstCheck } from '../../checker/ArkTS-eslint/PreferConstCheck';
import { PreferIncludesCheck } from '../../checker/ArkTS-eslint/PreferIncludesCheck';
import { RestrictPlusOperandsCheck } from '../../checker/ArkTS-eslint/RestrictPlusOperandsCheck';
import { UnboundMethodCheck } from '../../checker/ArkTS-eslint/UnboundMethodCheck';
import { RestrictTemplateExpressionsCheck } from '../../checker/ArkTS-eslint/RestrictTemplateExpressionsCheck';
import { TripleSlashReferenceCheck } from '../../checker/ArkTS-eslint/TripleSlashReferenceCheck';
import { CacheAvplayerCheck } from '../../checker/performance/CacheAvplayerCheck';
import { ColorOverlayEffectCheck } from '../../checker/performance/ColorOverlayEffectCheck';
import { CombineSameArgAnimatetoCheck } from '../../checker/performance/CombineSameArgAnimatetoCheck';
import { ConstantCheck } from '../../checker/performance/ConstantCheck';
import { HomepagePrepareLoadCheck } from '../../checker/performance/HomepagePrepareLoadCheck';
import { ImageFormatCheck } from '../../checker/performance/ImageFormatCheck';
import { ImageSizeCheck } from '../../checker/performance/ImageSizeCheck';
import { LimitRefreshScopeCheck } from '../../checker/performance/LimitRefreshScopeCheck';
import { LoadOnDemandCheck } from '../../checker/performance/LoadOnDemandCheck';
import { NoStateVarAccessInLoopCheck } from '../../checker/performance/NoStateVarAccessInLoopCheck';
import { NoUseAnyExportCurrentCheck } from '../../checker/performance/NoUseAnyExportCurrentCheck';
import { NoUseAnyExportOtherCheck } from '../../checker/performance/NoUseAnyExportOtherCheck';
import { PagePrefetchCheck } from '../../checker/performance/PagePrefetchCheck';
import { RemoveContainerWithoutPropertyCheck } from '../../checker/performance/RemoveContainerWithoutPropertyCheck';
import { ReplaceNestedReusableComponentByBuilderCheck } from '../../checker/performance/ReplaceNestedReusableComponentByBuilderCheck';
import { ResourcesFileCheck } from '../../checker/performance/ResourcesFileCheck';
import { SuggestReuseidForIfElseReusableComponentCheck } from '../../checker/performance/SuggestReuseidForlfElseReusableComponentCheck';
import { UseAttributeUpdaterControlRefreshScopeCheck } from '../../checker/performance/UseAttributeUpdaterControlRefreshScopeCheck';
import { UseReusableComponentCheck } from '../../checker/performance/UseReusableComponentCheck';
import { WebResourceForImageComponentCheck } from '../../checker/performance/WebResourceForImageComponentCheck';
import { NoCycleCheck } from '../../checker/security/NoCycleCheck';
import { NoUnsafeAesCheck } from '../../checker/security/NoUnsafeAesCheck';
import { NoUnsafeDhCheck } from '../../checker/security/NoUnsafeDhCheck';
import { NoUnsafeDhKeyCheck } from '../../checker/security/NoUnsafeDhKeyCheck';
import { NoUnsafeDsaCheck } from '../../checker/security/NoUnsafeDsaCheck';
import { NoUnsafeDsaKeyCheck } from '../../checker/security/NoUnsafeDsaKeyCheck';
import { NoUnsafeEcdsaCheck } from '../../checker/security/NoUnsafeEcdsaCheck';
import { NoUnsafeHashCheck } from '../../checker/security/NoUnsafeHashCheck';
import { NoUnsafeRsaEncryptCheck } from '../../checker/security/NoUnsafeRsaEncryptCheck';
import { NoUnsafeRsaKeyCheck } from '../../checker/security/NoUnsafeRsaKeyCheck';
import { NoUnsafeMacCheck } from '../../checker/security/NoUnsafeMacCheck';
import { NoUnsafeRsaSignCheck } from '../../checker/security/NoUnsafeRsaSignCheck';
import { NoHighLoadedFrameRateRangeCheck } from '../../checker/performance/NoHighLoadedFrameRateRangeCheck';
import { OneMultiBreakpointCheck } from '../../checker/cross-device-app-dev/OneMultiBreakpointCheck';
import { AvoidInspectorInterfaceCheck } from '../../checker/stability/AvoidInspectorInterfaceCheck';
import { AwaitTimeSequenceNormalCheck } from '../../checker/stability/AwaitTimeSequenceNormalCheck';
import { BanCallbackOperationsCheck } from '../../checker/stability/BanCallbackOperationsCheck';
import { CallAddInputBeforeAddOutputCheck } from '../../checker/stability/CallAddInputBeforeAddOutputCheck';
import { CameraInputOpenCheck } from '../../checker/stability/CameraInputOpenCheck';
import { ImageSyncBlurCheck } from '../../checker/stability/ImageSyncBlurCheck';


const logger = Logger.getLogger(LOG_MODULE_TYPE.HOMECHECK, 'CheckerIndex');

export const fileRules = {
    // @ArkTS-eslint
    "@ArkTS-eslint/init-declarations-check": InitDeclarationsCheck,
    "@ArkTS-eslint/default-param-last-check": DefaultParamLastCheck,
    "@ArkTS-eslint/explicit-function-return-type-check": ExplicitFunctionReturnTypeCheck,
    "@ArkTS-eslint/explicit-module-boundary-types-check": ExplicitModuleBoundaryTypesCheck,
    "@ArkTS-eslint/no-dupe-class-members-check": NoDupeClassMembersCheck,
    "@ArkTS-eslint/ban-ts-comment-check": BanTsCommentCheck,
    "@ArkTS-eslint/member-ordering-check": MemberOrderingCheck,
    "@ArkTS-eslint/no-unsafe-optional-chaining-check": NoUnsafeOptionalChainingCheck,
    "@ArkTS-eslint/no-unnecessary-condition-check": NoUnnecessaryConditionCheck,
    "@ArkTS-eslint/no-unnecessary-qualifier-check": NoUnnecessaryQualifierCheck,
    "@ArkTS-eslint/no-unnecessary-type-arguments-check": NoUnnecessaryTypeArgumentsCheck,
    "@ArkTS-eslint/no-unnecessary-type-assertion-check": NoUnnecessaryTypeAssertionCheck,
    "@ArkTS-eslint/require-await-check": RequireAwaitCheck,
    "@ArkTS-eslint/prefer-arrow-callback-check": PreferArrowCallbackCheck,
    "@ArkTS-eslint/no-unnecessary-boolean-literal-compare-check": NoUnnecessaryBooleanLiteralCompareCheck,
    "@ArkTS-eslint/switch-exhaustiveness-check": SwitchExhaustivenessCheck,
    "@ArkTS-eslint/unified-signatures-check": UnifiedSignaturesCheck,
    "@ArkTS-eslint/restrict-plus-operands-check": RestrictPlusOperandsCheck,
    "@ArkTS-eslint/restrict-template-expressions-check": RestrictTemplateExpressionsCheck,
    "@ArkTS-eslint/unbound-method-check": UnboundMethodCheck,
    "@ArkTS-eslint/triple-slash-reference-check": TripleSlashReferenceCheck,
    "@ArkTS-eslint/valid-typeof-check": ValidTypeofCheck,
    "@ArkTS-eslint/array-type-check": ArrayTypeCheck,
    "@ArkTS-eslint/no-floating-promises-check": NoFloatingPromisesCheck,
    "@ArkTS-eslint/no-useless-backreference-check": NoUselessBackreferenceCheck,
    "@ArkTS-eslint/ban-tslint-comment-check": BanTSLintCommentCheck,
    "@ArkTS-eslint/ban-types-check": BanTypesCheck,
    "@ArkTS-eslint/brace-style-check": BraceStyleCheck,
    "@ArkTS-eslint/no-useless-escape-check": NoUselessEscapeCheck,
    "@ArkTS-eslint/no-this-alias-check": NoThisAliasCheck,
    "@ArkTS-eslint/no-non-null-assertion-check": NoNonNullAssertionCheck,
    "@ArkTS-eslint/no-misused-new-check": NoMisusedNewCheck,
    "@ArkTS-eslint/no-require-imports-check": NoRequireImportsCheck,
    "@ArkTS-eslint/no-parameter-properties-check": NoParameterPropertiesCheck,
    "@ArkTS-eslint/no-redeclare-check": NoRedeclareCheck,
    "@ArkTS-eslint/no-shadow-check": NoShadowCheck,
    "@ArkTS-eslint/no-non-null-asserted-optional-chain-check": NoNonNullAssertedOptionalChainCheck,
    "@ArkTS-eslint/consistent-type-assertions-check": ConsistentTypeAssertionsCheck,
    "@ArkTS-eslint/consistent-type-definitions-check": ConsistentTypeDefinitionsCheck,
    "@ArkTS-eslint/consistent-type-imports-check": ConsistentTypeImportsCheck,
    "@ArkTS-eslint/consistent-indexed-object-style-check": ConsistentIndexedObjectStyleCheck,
    "@ArkTS-eslint/no-useless-catch-check": NoUselessCatchCheck,
    "@ArkTS-eslint/no-new-wrappers-check": NoNewWrappersCheck,
    "@ArkTS-eslint/no-cond-assign-check": NoCondAssignCheck,
    "@ArkTS-eslint/max-lines-per-function-check": MaxLinesPerFunctionCheck,
    "@ArkTS-eslint/no-duplicate-imports-check": NoDuplicateImportsCheck,
    "@ArkTS-eslint/no-regex-spaces-check": NoRegexSpacesCheck,
    "@ArkTS-eslint/no-loop-func-check": NoLoopFuncCheck,
    "@ArkTS-eslint/no-extraneous-class-check": NoExtraneousClassCheck,
    "@ArkTS-eslint/no-loss-of-precision-check": NoLossOfPrecisionCheck,
    "@ArkTS-eslint/no-for-in-array-check": NoForInArrayCheck,
    "@ArkTS-eslint/max-classes-per-file-check": MaxClassesPerFileCheck,
    "@ArkTS-eslint/max-nested-callbacks-check": MaxNestedCallbacksCheck,
    "@ArkTS-eslint/no-async-promise-executor-check": NoAsyncPromiseExecutorCheck,
    "@ArkTS-eslint/no-array-constructor-check": NoArrayConstructorCheck,
    "@ArkTS-eslint/max-depth-check": MaxDepthCheck,
    "@ArkTS-eslint/eqeqeq-check": EqeqeqCheck,
    "@ArkTS-eslint/no-extra-semi-check": NoExtraSemiCheck,
    "@ArkTS-eslint/no-array-constructor-ts-check": NoArrayConstructorTSCheck,
    "@ArkTS-eslint/no-extra-boolean-cast-check": NoExtraBooleanCastCheck,
    "@ArkTS-eslint/no-confusing-void-expression-check": NoConfusingVoidExpressionCheck,
    "@ArkTS-eslint/prefer-const-check": PreferConstCheck,
    "@ArkTS-eslint/no-case-declarations-check": NoCaseDeclarationsCheck,
    "@ArkTS-eslint/no-unsafe-assignment-check": NoUnsafeAssignmentCheck,
    "@ArkTS-eslint/max-lines-check": MaxLinesCheck,
    "@ArkTS-eslint/default-case-check": DefaultCaseCheck,
    "@ArkTS-eslint/default-case-last-check": DefaultCaseLastCheck,
    "@ArkTS-eslint/use-isnan-check": UseIsNaNCheck,
    "@ArkTS-eslint/no-invalid-void-type-check": NoInvalidVoidTypeCheck,
    "@ArkTS-eslint/no-namespace-check": NoNameSpaceCheck,
    "@ArkTS-eslint/typedef-check": TypedefCheck,
    "@ArkTS-eslint/no-unnecessary-type-constraint-check": NoUnnecessaryTypeConstraintCheck,
    "@ArkTS-eslint/no-unsafe-argument-check": NoUnsafeArgumentCheck,
    "@ArkTS-eslint/no-unsafe-call-check": NoUnsafeCallCheck,
    "@ArkTS-eslint/no-control-regex-check": NoControlRegexCheck,
    "@ArkTS-eslint/no-empty-character-class-check": NoEmptyCharacterClassCheck,
    "@ArkTS-eslint/no-invalid-regexp-check": NoInvalidRegexpCheck,
    "@ArkTS-eslint/no-ex-assign-check": NoExAssignCheck,
    "@ArkTS-eslint/no-octal-check": NoOctalCheck,
    "@ArkTS-eslint/no-unexpected-multiline-check": NoUnexpectedMultilineCheck,
    "@ArkTS-eslint/no-unreachable-check": NoUnreachableCheck,
    "@ArkTS-eslint/no-inferrable-types-check": NoInferrableTypesCheck,
    "@ArkTS-eslint/space-infix-ops-check": SpaceInfixOpsCheck,
    "@ArkTS-eslint/space-before-function-paren-check": SpaceBeforeFunctionParenCheck,
    "@ArkTS-eslint/no-restricted-syntax-check": NoRestrictedSyntaxCheck,
    "@ArkTS-eslint/adjacent-overload-signatures-check": AdjacentOverloadSignaturesCheck,
    "@ArkTS-eslint/class-literal-property-style-check": ClassLiteralPropertyStyleCheck,
    "@ArkTS-eslint/no-confusing-non-null-assertion-check": NoConfusingNonNullAssertionCheck,
    "@ArkTS-eslint/no-empty-function-check": NoEmptyFunctionCheck,
    "@ArkTS-eslint/prefer-for-of-check": PreferForOfCheck,
    "@ArkTS-eslint/no-magic-numbers-check": NoMagicNumbersCheck,
    "@ArkTS-eslint/return-await-check": ReturnAwaitCheck,
    "@ArkTS-eslint/prefer-reduce-type-parameter-check": PreferReduceTypeParameterCheck,
    "@ArkTS-eslint/prefer-nullish-coalescing-check": PreferNullishCoalescingCheck,
    "@ArkTS-eslint/await-thenable-check": AwaitThenableCheck,
    "@ArkTS-eslint/no-useless-constructor-check": NoUselessConstructorCheck,
    "@ArkTS-eslint/prefer-enum-initializers-check": PreferEnumInitializwersCheck,
    "@ArkTS-eslint/prefer-literal-enum-member-check": PreferLiteralEnumMemberCheck,
    "@ArkTS-eslint/prefer-readonly-parameter-types-check": PreferReadonlyParametertypesCheck,
    "@ArkTS-eslint/require-array-sort-compare-check": RequireArraySortCompareCheck,
    "@ArkTS-eslint/no-unused-vars-check": NoUnusedVarsCheck,
    "@ArkTS-eslint/no-invalid-this-check": NoInvalidThisCheck,
    "@ArkTS-eslint/no-fallthrough-check": NoFallthroughCheck,
    "@ArkTS-eslint/no-base-to-string-check": NoBaseToStringCheck,
    "@ArkTS-eslint/no-explicit-any-check": NoExplicitAnyCheck,
    "@ArkTS-eslint/naming-convention-check": NamingConventionCheck,
    "@ArkTS-eslint/no-unused-expressions-check": NoUnusedExpressionsCheck,
    "@ArkTS-eslint/no-unsafe-member-access-check": NoUnsafeMemberAccessCheck,
    "@ArkTS-eslint/no-throw-literal-check": NoThrowLiteralCheck,
    "@ArkTS-eslint/comma-dangle-check": CommaDangleCheck,
    "@ArkTS-eslint/prefer-regexp-exec-check": PreferRegexpExecCheck,
    "@ArkTS-eslint/prefer-ts-expect-error-check": PreferTsExpectErrorCheck,
    "@ArkTS-eslint/dot-notation-check": DotNotationCheck,
    "@ArkTS-eslint/explicit-member-accessibility-check": ExplicitMemberAccessibilityCheck,
    "@ArkTS-eslint/no-extra-parens-check": NoExtraParensCheck,
    "@ArkTS-eslint/no-dynamic-delete-check": NoDynamicDeleteCheck,
    "@ArkTS-eslint/no-implicit-any-catch-check": NoImplicitAnyCatchCheck,
    "@ArkTS-eslint/no-empty-interface-check": NoEmptyInterfaceCheck,
    "@ArkTS-eslint/no-unsafe-finally-check": NoUnsafeFinallyCheck,
    "@ArkTS-eslint/prefer-function-type-check": PreferFunctionTypeCheck,
    "@ArkTS-eslint/prefer-namespace-keyword-check": PreferNamespaceKeywordCheck,
    "@ArkTS-eslint/comma-spacing-check": CommaSpacingCheck,
    "@ArkTS-eslint/no-extra-non-null-assertion-check": NoExtraNonNullAssertionCheck,
    "@ArkTS-eslint/no-type-alias-check": NoTypeAliasCheck,
    "@ArkTS-eslint/no-misused-promises-check": NoMisusedPromisesCheck,
    "@ArkTS-eslint/type-annotation-spacing-check": TypeAnnotationSpacingCheck,
    "@ArkTS-eslint/strict-boolean-expressions-check": StrictBooleanExpressionsCheck,
    "@ArkTS-eslint/semi-check": SemiCheck,
    "@ArkTS-eslint/prefer-string-starts-ends-with-check": PreferStringStartsEndsWithCheck,
    "@ArkTS-eslint/promise-function-async-check": PromiseFunctionAsyncCheck,
    "@ArkTS-eslint/keyword-spacing-check": KeywordSpacingCheck,
    "@ArkTS-eslint/func-call-spacing-check": FuncCallSpacingCheck,
    "@ArkTS-eslint/method-signature-style-check": MethodSignatureStyleCheck,
    "@ArkTS-eslint/prefer-as-const-check": PreferAsConstCheck,
    "@ArkTS-eslint/lines-between-class-members-check": LinesBetweenClassMembersCheck,
    "@ArkTS-eslint/member-delimiter-style-check": MemberDelimiterStyleCheck,
    "@ArkTS-eslint/no-unsafe-return-check": NoUnsafeReturnCheck,
    "@ArkTS-eslint/no-use-before-define-check": NoUseBeforeDefineCheck,
    "@ArkTS-eslint/prefer-readonly-check": PreferReadonlyCheck,
    "@ArkTS-eslint/quotes-check": QuotesCheck,
    "@ArkTS-eslint/prefer-optional-chain-check": PreferOptionalChainCheck,
    "@ArkTS-eslint/no-trailing-spaces-check": NoTrailingSpacesCheck,
    "@ArkTS-eslint/no-implied-eval-check": NoImpliedEvalCheck,
    "@ArkTS-eslint/prefer-includes-check": PreferIncludesCheck,

    "@performance/array-definition-check": ArrayDefinitionCheck,
    "@performance/avoid-empty-callback-check": AvoidEmptyCallbackCheck,
    "@performance/avoid-update-auto-state-var-in-aboutToReuse-check": AvoidUpdateAutoStateVarAboutToReuseCheck,
    "@performance/constant-property-referencing-check-in-loops": ConstantPropertyReferencingInLoopsCheck,
    "@performance/effectkit-blur-check": EffectkitBlurCheck,
    "@performance/foreach-args-check": ForeachArgsCheck,
    "@performance/foreach-index-check": ForeachIndexCheck,
    "@performance/layout-properties-scale-check": LayoutPropertiesScaleCheck,
    "@performance/remove-redundant-state-var-check": RemoveRedundantStateVarCheck,
    "@performance/timezone-interface-check": TimezoneInterfaceCheck,
    "@performance/typed-array-check": TypedArrayCheck,
    "@performance/use-object-link-to-replace-prop-check": UseObjectLinkToReplacePropCheck,
    "@performance/web-cache-mode-check": WebCacheModeCheck,
    "@performance/web-on-active-check": WebOnActiveCheck,
    "@performance/sparse-array-check": SparseArrayCheck,
    "@performance/waterflow-data-preload-check": WaterFlowUpdateDataCheck,
    "@performance/union-type-array-check": UnionTypeArrayCheck,
    "@performance/optional-parameters-check": OptionalParametersCheck,
    "@performance/use-grid-layout-options-check": UseGridLayoutOptionsCheck,
    "@performance/remove-unchanged-state-var-check": RemoveUnchangedStateVarCheck,
    "@performance/js-code-cache-by-precompile-check": JsCodeCacheByPrecompileCheck,
    "@performance/js-code-cache-by-interception-check": JsCodeCacheByInterceptionCheck,
    "@correctness/image-interpolation-check": ImageInterpolationCheck,
    "@correctness/image-pixel-format-check": ImagePixelFormatCheck,
    "@performance/gif-hardware-decoding-check": GifHardwareDecodingCheck,
    "@performance/cache-avplayer-check": CacheAvplayerCheck,
    "@performance/color-overlay-effect-check": ColorOverlayEffectCheck,
    "@performance/combine-same-arg-animateto-check": CombineSameArgAnimatetoCheck,
    "@performance/constant-check": ConstantCheck,
    "@performance/limit-refresh-scope-check": LimitRefreshScopeCheck,
    "@performance/load-on-demand-check": LoadOnDemandCheck,
    "@performance/no-state-var-access-in-loop-check": NoStateVarAccessInLoopCheck,
    "@performance/no-use-any-export-current-check": NoUseAnyExportCurrentCheck,
    "@performance/no-use-any-export-other-check": NoUseAnyExportOtherCheck,
    "@performance/remove-container-without-property-check": RemoveContainerWithoutPropertyCheck,
    "@performance/replace-nested-reusable-component-by-builder-check": ReplaceNestedReusableComponentByBuilderCheck,
    "@performance/suggest-reuseid-for-if-else-reusable-component-check": SuggestReuseidForIfElseReusableComponentCheck,
    "@performance/use-attribute-updater-control-refresh-scope-check": UseAttributeUpdaterControlRefreshScopeCheck,
    "@performance/use-reusable-component-check": UseReusableComponentCheck,
    "@performance/web-resource-for-image-component-check": WebResourceForImageComponentCheck,
    "@performance/module-top-level-code-check": ModuleTopLevelCodeCheck,
    "@performance/no-high-loaded-frame-rate-range": NoHighLoadedFrameRateRangeCheck,
    "@security/no-unsafe-aes-check": NoUnsafeAesCheck,
    "@security/no-unsafe-dh-check": NoUnsafeDhCheck,
    "@security/no-unsafe-dh-key-check": NoUnsafeDhKeyCheck,
    "@security/no-unsafe-dsa-check": NoUnsafeDsaCheck,
    "@security/no-unsafe-dsa-key-check": NoUnsafeDsaKeyCheck,
    "@security/no-unsafe-ecdsa-check": NoUnsafeEcdsaCheck,
    "@security/no-unsafe-hash-check": NoUnsafeHashCheck,
    "@security/no-unsafe-mac-check": NoUnsafeMacCheck,
    "@security/no-unsafe-rsa-encrypt-check": NoUnsafeRsaEncryptCheck,
    "@security/no-unsafe-rsa-key-check": NoUnsafeRsaKeyCheck,
    "@security/no-unsafe-rsa-sign-check": NoUnsafeRsaSignCheck,
    "@cross-device-app-dev/one-multi-breakpoint-check": OneMultiBreakpointCheck,
    "@stability/avoid-inspector-interface-check": AvoidInspectorInterfaceCheck,
    "@stability/await-time-sequence-normal-check": AwaitTimeSequenceNormalCheck,
    "@stability/ban-callback-operations-check": BanCallbackOperationsCheck,
    "@stability/call-addInput-before-addOutput-check": CallAddInputBeforeAddOutputCheck,
    "@stability/camera-input-open-check": CameraInputOpenCheck
};

export const projectRules = {
    '@correctness/audio-interrupt-check': AudioInterruptCheck,
    '@performance/start-window-icon-check': StartWindowIconCheck,
    '@correctness/audio-pause-or-mute-check': AudioPauseOrMuteCheck,
    "@correctness/avsession-buttons-check": AvsessionButtonsCheck,
    "@correctness/avsession-metadata-check": AvsessionMetadataCheck,
    "@security/specified-interface-call-chain-check": SymbolUsageCheck,
    "@performance/number-init-check": NumberInitCheck,
    "@performance/image-sync-load-check": ImageSyncLoadCheck,
    "@performance/list-in-scroll-check": ListInScrollCheck,
    "@performance/high-frequency-log-check": HighFrequencyLogCheck,
    "@performance/lottie-animation-destroy-check": LottieAnimationDestoryCheck,
    "@performance/multiple-associations-state-var-check": MultipleAssociationsStateVarCheck,
    "@performance/set-cached-count-for-lazyforeach-check": SetCachedCountForLazyforeachCheck,
    "@performance/homepage-prepare-load-check": HomepagePrepareLoadCheck,
    "@performance/image-format-check": ImageFormatCheck,
    "@performance/image-size-check": ImageSizeCheck,
    "@performance/page-prefetch-check": PagePrefetchCheck,
    "@performance/resources-file-check": ResourcesFileCheck,
    "@security/no-cycle-check": NoCycleCheck,
    "@stability/image-sync-blur-check": ImageSyncBlurCheck
};

// 新增文件级的checker，需要在此处注册
export const file2CheckRuleMap: Map<string, any> = new Map(Object.entries(fileRules));
// 新增项目级checker，需要在此处注册
export const project2CheckRuleMap: Map<string, any> = new Map(Object.entries(projectRules));

export class ProxyChecker {
    static getClass(ruleId: string) {
        const checker = file2CheckRuleMap.get(ruleId) ?? project2CheckRuleMap.get(ruleId);
        if (!checker) {
            logger.error(`${ruleId} is not matched to any checker`);
            return null;
        }
        return new checker();
    }
}