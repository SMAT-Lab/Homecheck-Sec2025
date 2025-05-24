# Avoid using the index as the return value or part of the return value in keyGenerator of ForEach (foreach-index-check)

The **keyGenerator** parameter in **ForEach** is a callback that allows you to define your own key generation rules. However, if the generated keys incorporate index values, inserting new data into the data source can trigger a cascading effect. This insertion causes all subsequent items to have altered keys, potentially leading to unnecessary reconstruction of numerous components and a decline in rendering performance.

## Benefits from Code Optimization
Reduced frame loss during swiping.

## Rule Details
This rule is aimed at enforcing the more performant way of using ForEach.
>See [***documentation***](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides-V13/ide-foreach-index-check-V13) or [***best practice***](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides-V5/arkts-rendering-control-foreach-V5#%E6%B8%B2%E6%9F%93%E6%80%A7%E8%83%BD%E9%99%8D%E4%BD%8E) for more details.

Examples of **incorrect** code for this rule:

```ets
@Entry
@Component
struct ForeachTest {
  private data: string[] = ['one', 'two', 'three'];

  build() {
    RelativeContainer() {
      List() {
        // warning line
        ForEach(this.data, (item: string, index: number) => {
          ListItem() {
            Text(item);
          }
        }, (item: string, index: number) => item + index)
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
  private data: string[] = ['one', 'two', 'three'];

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