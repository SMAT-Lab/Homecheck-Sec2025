## 规则名

@performance/lower-power-consumption-check，在音乐播放场景或导航定位场景中，应设置正确的usage类型，不可设置为STREAM_USAGE_UNKNOWN。

## 规则来源

参考文档：[音乐场景最佳实践](https://developer.huawei.com/consumer/cn/doc/best-practices/bpta-music-playback-scenarios) 和
[导航场景最佳实践](https://developer.huawei.com/consumer/cn/doc/best-practices/bpta-navigation-scenarios)

## 反例代码

```
let audioStreamInfo: audio.AudioStreamInfo = {
  samplingRate: audio.AudioSamplingRate.SAMPLE_RATE_44100,
  channels: audio.AudioChannel.CHANNEL_1,
  sampleFormat: audio.AudioSampleFormat.SAMPLE_FORMAT_S16LE,
  encodingType: audio.AudioEncodingType.ENCODING_TYPE_RAW
};
let audioRendererInfo: audio.AudioRendererInfo = {
  usage: audio.StreamUsage.STREAM_USAGE_UNKNOWN,
  rendererFlags: 0
};
let audioRendererOptions: audio.AudioRendererOptions = {
  streamInfo: audioStreamInfo,
  rendererInfo: audioRendererInfo
};

audio.createAudioRenderer(audioRendererOptions, (err, data) => {
  if (err) {
    console.error(`Invoke createAudioRenderer failed, code is ${err.code}, message is ${err.message}`);
    return;
  } else {
    console.info('Invoke createAudioRenderer succeeded.');
    let audioRenderer = data;
  }
});
```

## 正例代码

```
let audioStreamInfo: audio.AudioStreamInfo = {
  samplingRate: audio.AudioSamplingRate.SAMPLE_RATE_44100,
  channels: audio.AudioChannel.CHANNEL_1,
  sampleFormat: audio.AudioSampleFormat.SAMPLE_FORMAT_S16LE,
  encodingType: audio.AudioEncodingType.ENCODING_TYPE_RAW
};
let audioRendererInfo: audio.AudioRendererInfo = {
  usage: audio.StreamUsage.STREAM_USAGE_MUSIC,
  rendererFlags: 0
};
let audioRendererOptions: audio.AudioRendererOptions = {
  streamInfo: audioStreamInfo,
  rendererInfo: audioRendererInfo
};

audio.createAudioRenderer(audioRendererOptions, (err, data) => {
  if (err) {
    console.error(`Invoke createAudioRenderer failed, code is ${err.code}, message is ${err.message}`);
    return;
  } else {
    console.info('Invoke createAudioRenderer succeeded.');
    let audioRenderer = data;
  }
});
```