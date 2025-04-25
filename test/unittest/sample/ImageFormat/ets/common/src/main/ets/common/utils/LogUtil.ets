/*
 * Copyright (c) 2024 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import hilog from '@ohos.hilog';

/**
 * Hilog utils.
 */
export class LogUtil {
  /**
   * Indicates the log color.
   */
  private domain: number;

  /**
   * Indicates the log prefix string.
   */
  private prefix: string;

  /**
   * Indicates the log format string.
   */
  private format: string = '%{public}s,%{public}s';

  /**
   * Constructor.
   *
   * @param prefix Identifies the log tag.
   * @param domain Indicates the service domain, which is a hexadecimal integer ranging from 0x0 to 0xFFFFF.
   */
  constructor(prefix: string = 'MyNFC', domain: number = 0xFF00) {
    this.prefix = prefix;
    this.domain = domain;
  }

  /**
   * Show log in debug level.
   *
   * @param args
   */
  public debug(...args: string[]): void {
    hilog.debug(this.domain, this.prefix, this.format, args);
  }

  /**
   * Show log in info level.
   *
   * @param args
   */
  public info(...args: string[]): void {
    hilog.info(this.domain, this.prefix, this.format, args);
  }

  /**
   * Show log in warn level.
   *
   * @param args
   */
  public warn(...args: string[]): void {
    hilog.warn(this.domain, this.prefix, this.format, args);
  }

  /**
   * Show log in error level.
   *
   * @param args
   */
  public error(...args: string[]): void {
    hilog.error(this.domain, this.prefix, this.format, args);
  }
}