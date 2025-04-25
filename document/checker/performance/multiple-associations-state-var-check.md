# [Experimental]Use conditional update when multiple components are associated with the same data source (multiple-associations-state-var-check)

When multiple components depend on the same data source and update based on changes to that data source, directly associating with the data source can lead to all those components being updated every time the data changes. To precisely control the component update scope, consider the following:
Use the @Watch decorator within components to listen for changes to the data source. When a change occurs, execute conditional judgment logic to ensure that only components that meet the criteria are updated.

## Benefits from Code Optimization
Reduced frame loss in general cases.

## Rule Details
This rule aims to prevent the issue of frequent and redundant update of components when they use the same data source.
>See [***documentation***](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides-V13/ide-multi-associations-state-var-check-V13) or [***best practice***](https://developer.huawei.com/consumer/cn/doc/best-practices-V5/bpta-status-management-V5#section19081251381) for more details.

Examples of **incorrect** code for this rule:

```ets
// 1. The child component uses a state variable, but does not use @Watch to restrict the update condition.

@Observed
class UIStyle {
  fontSize: number = 0;
  fontColor: string = '';
  isChecked: boolean = false;
}

@Entry
@Component
struct MultipleAssociationsStateVarReport0 {
  @State uiStyle: UIStyle = new UIStyle();
  private listData: string[] = [];

  aboutToAppear(): void {
    for (let i = 0; i < 10; i++) {
      this.listData.push(`ListItemComponent ${i}`);
    }
  }

  build() {
    Row() {
      Column() {
        CompA({item: '1', index: 1, subStyle: this.uiStyle})
        CompB({item: '2', index: 2, subStyle: this.uiStyle})
        CompC({item: '3', index: 3, subStyle: this.uiStyle})
        Text('change state var')
          .onClick(()=>{
            this.uiStyle.fontSize = 20;
          })
      }
      .width('100%')
    }
    .height('100%')
  }
}

@Component
struct CompA {
  @Prop item: string;
  @Prop index: number;
  @Link subStyle: UIStyle;
  private sizeFont: number = 50;

  isRender(): number {
    console.info(`CompA ${this.index} Text is rendered`);
    return this.sizeFont;
  }

  build() {
    Column() {
      Text(this.item)
        .fontSize(this.isRender())
        .fontSize(this.subStyle.fontSize)
      Text('abc')
    }
  }
}

@Component
struct CompB {
  @Prop item: string;
  @Prop index: number;
  @Link subStyle: UIStyle;
  private sizeFont: number = 50;

  isRender(): number {
    console.info(`CompB ${this.index} Text is rendered`);
    return this.sizeFont;
  }

  build() {
    Column() {
      Text(this.item)
        .fontSize(this.isRender())
        .fontColor(this.subStyle.fontColor)
      Text('abc')
    }
  }
}


@Component
struct CompC {
  @Prop item: string;
  @Prop index: number;
  @Link subStyle: UIStyle;
  private sizeFont: number = 50;

  isRender(): number {
    console.info(`CompC ${this.index} Text is rendered`);
    return this.sizeFont;
  }

  build() {
    Column() {
      if (this.subStyle.isChecked) {
        Text('checked')
      } else {
        Text('unchecked')
      }
    }
  }
}
```

Examples of **correct** code for this rule:

```ets
// 1. The child component uses a state variable together with an @Watch decorator (adding the update condition).


@Observed
class UIStyle {
  fontSize: number = 0;
  fontColor: string = '';
  isChecked: boolean = false;
}

@Entry
@Component
struct MultipleAssociationsStateVarNoReport0 {
  @State uiStyle: UIStyle = new UIStyle();
  private listData: string[] = [];

  aboutToAppear(): void {
    for (let i = 0; i < 10; i++) {
      this.listData.push(`ListItemComponent ${i}`);
    }
  }

  build() {
    Row() {
      Column() {
        CompA({item: '1', index: 1, subStyle: this.uiStyle})
        CompB({item: '2', index: 2, subStyle: this.uiStyle})
        CompC({item: '3', index: 3, subStyle: this.uiStyle})
        Text('change state var')
          .onClick(()=>{
            this.uiStyle.fontSize = 20;
          })
      }
      .width('100%')
    }
    .height('100%')
  }
}

@Component
struct CompA {
  @Prop item: string;
  @Prop index: number;
  @Link @Watch('onStyleChange') subStyle: UIStyle;
  @State fontSize: number = 0;

  isRender(): number {
    console.info(`CompA ${this.index} Text is rendered`);
    return this.fontSize;
  }

  onStyleChange() {
    this.fontSize = this.subStyle.fontSize;
  }

  build() {
    Column() {
      Text(this.item)
        .fontSize(this.isRender())
        .fontSize(this.fontSize)
      Text('abc')
    }
  }
}

@Component
struct CompB {
  @Prop item: string;
  @Prop index: number;
  @Link @Watch('onStyleChange') subStyle: UIStyle;
  @State fontColor: string = '#00ffff';

  isRender(): number {
    console.info(`CompB ${this.index} Text is rendered`);
    return 10;
  }

  onStyleChange() {
    this.fontColor = this.subStyle.fontColor;
  }

  build() {
    Column() {
      Text(this.item)
        .fontSize(this.isRender())
        .fontColor(this.fontColor)
      Text('abc')
    }
  }
}


@Component
struct CompC {
  @Prop item: string;
  @Prop index: number;
  @Link @Watch('onStyleChange') subStyle: UIStyle;
  @State isChecked: boolean = false;

  isRender(): number {
    console.info(`CompC ${this.index} Text is rendered`);
    return 50;
  }

  onStyleChange() {
    this.isChecked = this.subStyle.isChecked;
  }

  build() {
    Column() {
      if (this.isChecked) {
        Text('checked')
      } else {
        Text('unchecked')
      }
    }
  }
}
```