# Avoid sparse arrays.(sparse-array-check)

When a VM allocates an array whose size exceeds 1024, it uses a hash table to store the array elements. Compared with offset-based access, access with the hash table is slower. Therefore, avoid sparse arrays during development.

## Benefits from Code Optimization
Adherence to ArkTS coding standards.

## Rule Details
This rule is aimed at enforcing the more performant way of using arrays.
>See [***documentation***](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides-V13/ide-sparse-array-check-V13) or [***best practice***](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides-V5/arkts-high-performance-programming-V5#%E9%81%BF%E5%85%8D%E4%BD%BF%E7%94%A8%E7%A8%80%E7%96%8F%E6%95%B0%E7%BB%84) for more details.

Examples of **incorrect** code for this rule:

```ets
// 1. Directly allocate an array of the 100000 size. The VM uses a hash table to store elements.
let count = 100000;
let result: number[] = new Array(count);

// 2. The array will become sparse array if it is initialized at index 9999 directly.
result = new Array();
result[9999] = 0;
```

Examples of **correct** code for this rule:

```ets
let index = 3;
let result: number[] = [];
result[index] = 0;
```
