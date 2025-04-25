# Use number variables correctly.(number-init-check)

For number variables, the compiler distinguishes between 'int' and 'float' during optimization. As such, do not change
the type of a number variable after it has been initialized.

## Benefits from Code Optimization
Adherence to ArkTS coding standards.

## Rule Details
This rule is aimed enforcing the more performant way of using number variables.
>See [***documentation***](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides-V13/ide-number-init-check-V13) or [***best practice***](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides-V5/arkts-high-performance-programming-V5#number%E7%B1%BB%E5%9E%8B%E5%8F%98%E9%87%8F%E9%81%BF%E5%85%8D%E6%95%B4%E5%9E%8B%E5%92%8C%E6%B5%AE%E7%82%B9%E5%9E%8B%E6%B7%B7%E7%94%A8) for more details.

Examples of **incorrect** code for this rule:

```ets
let intNum = 1;
// intNum is declared as int. Avoid changing it to float.
intNum = 1.1; 

let floatNum = 1.3;
// floatNum is declared as float. Avoid changing it to int.
floatNum = 2; 
```

Examples of **correct** code for this rule:

```ets
let intNum = 1;
intNum = 2;

let floatNum = 1.3;
floatNum = 2.4;
```