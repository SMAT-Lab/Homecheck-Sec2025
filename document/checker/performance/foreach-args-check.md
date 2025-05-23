# Set keyGenerator for ForEach.(foreach-args-check)

While keyGenerator is an optional parameter of ForEach, you are advised to set it to deliver better performance.

## Benefits from Code Optimization
Reduced frame loss during swiping.

## Rule Details
This rule is aimed at enforcing the more performant way of using ForEach.
>See [***documentation***](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides-V13/ide-foreach-args-check-V13) or [***best practice***](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides-V5/arkts-rendering-control-foreach-V5#%E9%94%AE%E5%80%BC%E7%94%9F%E6%88%90%E8%A7%84%E5%88%99) for more details.

Examples of **incorrect** code for this rule:

```ets
@Entry
@Component
struct ForeachTest {
  private data: string[] = ['1', '2', '3'];

  build() {
    RelativeContainer() {
      List() {
        ForEach(this.data, (item: string, index: number) => {
          ListItem() {
            Text(item);
          }
        })
      }
      .width('100%')
      .height('100%')
    }
    .height('100%')
    .width('100%')
  }
}
```

Examples of **correct** code for this rule:

```ets
@Entry
@Component
struct ForeachTest {
  private data: string[] = ['1', '2', '3'];

  build() {
    RelativeContainer() {
      List() {
        ForEach(this.data, (item: string, index: number) => {
          ListItem() {
            Text(item);
          }
        }, (item: string, index: number) => item)
      }
      .width('100%')
      .height('100%')
    }
    .height('100%')
    .width('100%')
  }
}
```