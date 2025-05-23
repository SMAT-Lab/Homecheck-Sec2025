# Avoid printing logs in frequent operations.(high-frequency-log-check)

Printing logs in frequent operations can result in a large number of logs, significantly affecting app performance.

## Benefits from Code Optimization
Efficient handling of long-running functions.

## Rule Details
This rule is aimed at enforcing the more performant way of using frequent operations.
>See [***documentation***](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides-V13/ide-high-frequency-log-check-V13) for more details.

Examples of **incorrect** code for this rule:

```ets
// Test.ets
import hilog from '@ohos.hilog';
@Entry
@Component
struct Index {
  build() {
    Column() {
      Scroll()
        .onScroll(() => {
          // Avoid printing logs
          hilog.info(1001, 'Index', 'onScroll')
      })
    }
  }
}
```

Examples of **correct** code for this rule:

```ets
// Test.ets
@Entry
@Component
struct Index {
  build() {
    Column() {
      Scroll()
      .onScroll(() => {
        const TAG = 'onScroll';
      })
    }
  }
}
```
