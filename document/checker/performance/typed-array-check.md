# Prioritize TypedArray for numeric arrays.(typed-array-check)

Where only numerical methods are involved, the TypedArray data structure is recommended. Common TypedArrays data structures: Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array, BigInt64Array, BigUint64Array.

## Benefits from Code Optimization
Adherence to ArkTS coding standards.

## Rule Details
This rule is aimed at enforcing the more performant way of using numeric arrays.
>See [***documentation***](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides-V13/ide-typed-array-check-V13) or [***best practice***](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides-V5/arkts-high-performance-programming-V5#%E6%95%B0%E5%80%BC%E6%95%B0%E7%BB%84%E6%8E%A8%E8%8D%90%E4%BD%BF%E7%94%A8typedarray) for more details.

Examples of **incorrect** code for this rule:

```ts
const typedArray1: number[] = new Array(1, 2, 3);
const typedArray2: number[] = new Array(4, 5, 6);
let res: number[] = new Array(3);
for (let i = 0; i < 3; i++) {
     res[i] = typedArray1[i] + typedArray2[i];
}
```

Examples of **correct** code for this rule:

```ts
const typedArray1 = new Int8Array([1, 2, 3]); 
const typedArray2 = new Int8Array([4, 5, 6]);  
let res = new Int8Array(3);
for (let i = 0; i < 3; i++) {
     res[i] = typedArray1[i] + typedArray2[i];
}
```
