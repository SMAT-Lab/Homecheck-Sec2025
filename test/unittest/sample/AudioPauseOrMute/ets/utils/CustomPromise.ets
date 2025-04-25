/*
 * Copyright (c) Huawei Technologies Co., Ltd. 2024-2024. All rights reserved.
 */

export class CustomPromise<T> extends Promise<T> {
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: Error) => void;

  constructor() {
    let tempResolve: (value: T | PromiseLike<T>) => void;
    let tempReject: (reason?: Error) => void;

    super((resolve,reject) => {
      tempResolve = resolve;
      tempReject = reject;
    });

    this.resolve = tempResolve;
    this.reject = tempReject;
  }

  static get [Symbol.species](): typeof Promise {
    return Promise;
  }
}