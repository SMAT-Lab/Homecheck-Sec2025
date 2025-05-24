# [Experimental]Destroy Lottie animations correctly (lottie-animation-destroy-check)

After an animation is loaded to the memory using Lottie (typically through **lottie.loadAnimation**), it is important to destroy it when it has finished executing, to reduce resource wastage and the impact on performance. Specifically, at an appropriate time (for example, **onDisAppear**, **onPageHide**, or **aboutToDisappear**), call the **destroy** method of **animationItem** to destroy a single animation or call the **lottie.destroy()** method to destroy all animations on the current page.

## Benefits from Code Optimization
Optimized memory usage.

## Rule Details
This rule is aimed at correct destroying of Lottie animations to reduce resource wastage and the impact on performance.
>See [***documentation***](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides-V13/ide-lottie-animation-destroy-check-V13) for more details.

Examples of **incorrect** code for this rule: 

```ets
// 1. The animation loaded through loadAnimation is not destroyed.
import lottie from '@ohos/lottie';
import { AnimationItem } from '@ohos/lottie';

const FRAME_START: number = 60;
const FRAME_END: number = 120;

@Entry
@Component
struct LottieAnimation1 {
  private politeChickyController: CanvasRenderingContext2D = new CanvasRenderingContext2D();
  private politeChicky: string = 'politeChicky';
  private politeChickyPath: string = 'media/politeChicky.json';
  private animateItem?: AnimationItem;

  build() {
    Canvas(this.politeChickyController)
      .width(160)
      .height(160)
      .backgroundColor(Color.Gray)
      .borderRadius(3)
      .onReady(() => {
        this.animateItem = lottie.loadAnimation({
          container: this.politeChickyController,
          renderer: 'canvas',
          loop: true,
          autoplay: true,
          name: this.politeChicky,
          path: this.politeChickyPath,
          initialSegment: [FRAME_START, FRAME_END]
        })
      })
  }
}

// 2. Multiple animations are loaded through loadAnimation, but only one of them is destroyed with the destroy method of animationItem.
import lottie from '@ohos/lottie';
import { AnimationItem } from '@ohos/lottie';

// Starting frame of the animation playback.
const FRAME_START: number = 60; 
// Ending frame of the animation playback.
const FRAME_END: number = 120; 

// loadAnimation are called multiple times, but destroy is called only once in onDisAppear.
@Entry
@Component
struct LottieAnimation4 {
  private politeChickyController: CanvasRenderingContext2D = new CanvasRenderingContext2D();
  private politeChicky: string = 'politeChicky'; // Animation name
  // Path to the animation resource file in the HAP. Only the JSON format is supported.
  private politeChickyPath: string = 'media/politeChicky.json'; 
  private animateItem: AnimationItem | null = null;
  // Initialize the number of clicks.
  @State times: number = 0; 

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      // Animation
      Canvas(this.politeChickyController)
        .width(160)
        .height(160)
        .backgroundColor(Color.Gray)
        .borderRadius(3)
        .onReady(() => {
          this.animateItem = lottie.loadAnimation({
            container: this.politeChickyController,
            renderer: 'canvas',
            loop: true,
            autoplay: true,
            name: this.politeChicky,
            path: this.politeChickyPath,
            initialSegment: [FRAME_START, FRAME_END]
          })
        })
        .onClick(() => {
          this.animateItem = lottie.loadAnimation({
            container: this.politeChickyController,
            renderer: 'canvas',
            loop: true,
            autoplay: true,
            name: this.politeChicky,
            path: this.politeChickyPath,
            initialSegment: [FRAME_START, FRAME_END]
          })
          this.times++;
        })
        .onDisAppear(()=> {
          // The destroy API of animateItem destroys only the last loaded animation. lottie.destroy() is recommended here for destroying all animations on the page.
          this.animateItem?.destroy();
        })
      // Text that responds to the animation
      Text('text')
        .fontSize(16)
        .margin(10)
        .fontColor(Color.White)
    }.margin({ top: 20 })
  }
}

// 2. Multiple animations are loaded through loadAnimation, but only the specified animation is destroyed with the lottie.destroy API.

import lottie from '@ohos/lottie';
import { AnimationItem } from '@ohos/lottie';
// Starting frame of the animation playback.
const FRAME_START: number = 60; 
// Ending frame of the animation playback.
const FRAME_END: number = 120; 

// destroy is called, but not all animations are destroyed.
@Entry
@Component
struct LottieAnimation5 {
  private politeChickyController: CanvasRenderingContext2D = new CanvasRenderingContext2D();
  // Animation name
  private politeChicky: string = 'politeChicky';
  // Path to the animation resource file in the HAP. Only the JSON format is supported.
  private politeChickyPath: string = 'media/politeChicky.json'; 
  private animateItem: AnimationItem | null = null;

  build() {
    Canvas(this.politeChickyController)
      .width(160)
      .height(160)
      .backgroundColor(Color.Gray)
      .borderRadius(3)
      .onReady(() => {
        this.animateItem = lottie.loadAnimation({
          container: this.politeChickyController,
          renderer: 'canvas',
          loop: true,
          autoplay: true,
          name: 'anim_name1',
          path: this.politeChickyPath,
          initialSegment: [FRAME_START, FRAME_END]
        })
      })
      .onClick(()=> {
        this.animateItem = lottie.loadAnimation({
          container: this.politeChickyController,
          renderer: 'canvas',
          loop: true,
          autoplay: true,
          name: 'anim_name2',
          path: this.politeChickyPath,
          initialSegment: [FRAME_START, FRAME_END]
        })
      })
      .onDisAppear(()=>{
        // Destroy only the animation named anim_name2. lottie.destroy() is recommended here for destroying all animations on the page.
        lottie.destroy('anim_name2');
      })
  }
}

```

Examples of **correct** code for this rule: 

```ets
// 1. After loadAnimation is called once to load the animation, the destroy method of animatationItem is called.
import lottie from '@ohos/lottie';
import { AnimationItem } from '@ohos/lottie';

const FRAME_START: number = 60;
const FRAME_END: number = 120;

@Entry
@Component
struct LottieAnimation1 {
  private politeChickyController: CanvasRenderingContext2D = new CanvasRenderingContext2D();
  private politeChicky: string = 'politeChicky';
  private politeChickyPath: string = 'media/politeChicky.json';
  private animateItem?: AnimationItem;

  build() {
    Canvas(this.politeChickyController)
      .width(160)
      .height(160)
      .borderRadius(3)
      .onReady(() => {
        this.animateItem = lottie.loadAnimation({
          container: this.politeChickyController,
          renderer: 'canvas',
          loop: true,
          autoplay: true,
          name: this.politeChicky,
          path: this.politeChickyPath,
          initialSegment: [FRAME_START, FRAME_END]
        })
      })
      .onDisAppear(() => {
        this.animateItem?.destroy();
      })
  }
}

// 2. lottie.destroy() is called after multiple loadAnimation calls.
import lottie from '@ohos/lottie';
import { AnimationItem } from '@ohos/lottie';

// Starting frame of the animation playback.
const FRAME_START: number = 60;
// Ending frame of the animation playback.
const FRAME_END: number = 120;

@Entry
@Component
struct LottieAnimation2 {
  private politeChickyController: CanvasRenderingContext2D = new CanvasRenderingContext2D();
  // Animation name
  private politeChicky: string = 'politeChicky';
  // Path to the animation resource file in the HAP. Only the JSON format is supported.
  private politeChickyPath: string = 'media/politeChicky.json';
  private animateItem: AnimationItem | null = null;

  build() {
    Canvas(this.politeChickyController)
      .width(160)
      .height(160)
      .borderRadius(3)
      .onReady(() => {
        this.animateItem = lottie.loadAnimation({
          container: this.politeChickyController,
          renderer: 'canvas',
          loop: true,
          autoplay: true,
          name: 'anim_name1',
          path: this.politeChickyPath,
          initialSegment: [FRAME_START, FRAME_END]
        })
      })
      .onClick(() => {
        this.animateItem = lottie.loadAnimation({
          container: this.politeChickyController,
          renderer: 'canvas',
          loop: true,
          autoplay: true,
          name: 'anim_name2',
          path: this.politeChickyPath,
          initialSegment: [FRAME_START, FRAME_END]
        })
      })
  }

  onPageHide(): void {
    lottie.destroy();
  }
}
```
