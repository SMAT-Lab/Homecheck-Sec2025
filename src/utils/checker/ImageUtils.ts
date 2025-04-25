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

import fs from 'fs';
import { BMP } from './imageFormat/bmp';
import { JPG } from './imageFormat/jpg';
import { PNG } from './imageFormat/png';
import { SVG } from './imageFormat/svg';
import { WEBP } from './imageFormat/webp';
import { ImageInfo } from '../../model/Interfaces';

const MaxInputSize = 512 * 1024;
const typeHandlers = {
    bmp: BMP,
    jpg: JPG,
    png: PNG,
    svg: SVG,
    webp: WEBP,
};

export type imageType = keyof typeof typeHandlers;

const firstBytes: Record<number, imageType> = {
    0x42: 'bmp',
    0x52: 'webp',
    0x89: 'png',
    0xff: 'jpg',
};
const keys = Object.keys(typeHandlers) as imageType[];

export function readImageInfo(filePath: string): ImageInfo | undefined {
    const input = readFileSync(filePath);
    if (!input) return undefined;
    const type = detector(input);
    if (typeof type === 'undefined') {
        return undefined;
    }
    if (type in typeHandlers) {
        const size = typeHandlers[type].calculate(input, filePath);
        if (!size) {
            return undefined;
        }
        let imageInfo = { width: size.width, height: size.height, type: '' };
        imageInfo.type = size.type ?? type;
        if (size.images && size.images.length > 1) {
            const largestImage = size.images.reduce((largest, current) => {
                return current.width * current.height > largest.width * largest.height ? current : largest;
            }, size.images[0]);
            imageInfo.width = largestImage.width;
            imageInfo.height = largestImage.height;
        }
        return imageInfo;
    }
    return undefined;
}

function readFileSync(filepath: string): Uint8Array | undefined {
    const descriptor = fs.openSync(filepath, 'r');
    try {
        const { size } = fs.fstatSync(descriptor);
        if (size <= 0) {
            return undefined;
        }
        const inputSize = Math.min(size, MaxInputSize);
        const input = new Uint8Array(inputSize);
        fs.readSync(descriptor, input, 0, inputSize, 0);
        return input;
    } finally {
        fs.closeSync(descriptor);
    }
}

function detector(input: Uint8Array): imageType | undefined {
    try {
        const byte = input[0];
        if (byte in firstBytes) {
            const type = firstBytes[byte];
            if (type && typeHandlers[type].validate(input)) {
                return type;
            }
        }
        const finder = (key: imageType) => typeHandlers[key].validate(input);
        return keys.find(finder);
    } catch (error) {
        return undefined;
    }
}