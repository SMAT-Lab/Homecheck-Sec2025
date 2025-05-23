# Extract constant property accesses within the loop to reduce the number of property access times (constant-property-referencing-check-in-loops)

When there is a property access operation in a loop, if the return value of the property access does not change within that loop (in other words, the property is a constant), the operation can be extracted outside the loop to reduce the number of property accesses.

## Benefits from Code Optimization
Adherence to ArkTS coding standards.

## Rule Details
This rule enforces the extraction of constant property accesses within the loop to reduce the number of property access times.
>See [***documentation***](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides-V13/ide-constant-property-check-in-loops-V13) or [***best practice***](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides-V5/arkts-high-performance-programming-V5#%E5%BE%AA%E7%8E%AF%E4%B8%AD%E5%B8%B8%E9%87%8F%E6%8F%90%E5%8F%96%E5%87%8F%E5%B0%91%E5%B1%9E%E6%80%A7%E8%AE%BF%E9%97%AE%E6%AC%A1%E6%95%B0) for more details.

Examples of **incorrect** code for this rule:

```
class Time {
  static start: number = 0;
  static info: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
}

function getNum(num: number): number {
  /* Year has (12 * 29 =) 348 days at least */
  let total: number = 348;
  for (let index: number = 0x8000; index > 0x8; index >>= 1) {
    // warning
    total += ((Time.info[num- Time.start] & index) !== 0) ? 1 : 0;
  }
  return total;
}
```

Examples of **correct** code for this rule:

```ets
class Time {
  static start: number = 0;
  static info: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
}

function getNum(num: number): number {
  /* Year has (12 * 29 =) 348 days at least */
  let total: number = 348;

  const info = Time.info[num- Time.start];  
  for (let index: number = 0x8000; index > 0x8; index >>= 1) {
    if ((info & index) != 0) {
      total++;
    }
  }
  return total;
}
```