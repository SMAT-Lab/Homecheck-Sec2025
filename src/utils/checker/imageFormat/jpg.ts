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

import type { ImageInfo, ImageData } from '../../../model/Interfaces';
import { readUInt, readUInt16BE, toHexString } from '../BytesUtils';

const EXIF_MARKER = '45786966';
const APP1_DATA_SIZE_BYTES = 2;
const EXIF_HEADER_BYTES = 6;
const TIFF_BYTE_ALIGN_BYTES = 2;
const BIG_ENDIAN_BYTE_ALIGN = '4d4d';
const LITTLE_ENDIAN_BYTE_ALIGN = '4949';
const IDF_ENTRY_BYTES = 12;
const NUM_DIRECTORY_ENTRIES_BYTES = 2;

function isEXIF(input: Uint8Array): boolean {
    return toHexString(input, 2, 6) === EXIF_MARKER;
}

function extractSize(input: Uint8Array, index: number): ImageInfo {
    return {
        height: readUInt16BE(input, index),
        width: readUInt16BE(input, index + 2),
    }
}


function extractOrientation(exifBlock: Uint8Array, isBigEndian: boolean) {
    const idfOffset = 8;
    const offset = EXIF_HEADER_BYTES + idfOffset;
    const idfDirectoryEntries = readUInt(exifBlock, 16, offset, isBigEndian);
    for(let directoryEntryNumber = 0; directoryEntryNumber < idfDirectoryEntries; directoryEntryNumber++) {
        const start = offset + NUM_DIRECTORY_ENTRIES_BYTES + directoryEntryNumber * IDF_ENTRY_BYTES;
        const end = start + IDF_ENTRY_BYTES;
        if (start > exifBlock.length) {
            return;
        }
        const block = exifBlock.slice(start, end);
        const tagNumber = readUInt(block, 16, 0, isBigEndian);
        if (tagNumber === 274) {
            const dataFormat = readUInt(block, 16, 2, isBigEndian);
            if (dataFormat !== 3) {
                return;
            }
            const numberOfComponents = readUInt(block, 32, 4, isBigEndian);
            if (numberOfComponents !== 1) {
                return;
            }
            return readUInt(block, 16, 8, isBigEndian);
        }
    }
}

function validateExifBlock(input: Uint8Array, index: number) {
    const exifBlock = input.slice(APP1_DATA_SIZE_BYTES, index);
    const byteAlign = toHexString(exifBlock, EXIF_HEADER_BYTES, EXIF_HEADER_BYTES + TIFF_BYTE_ALIGN_BYTES);
    const isBigEndian = byteAlign === BIG_ENDIAN_BYTE_ALIGN;
    const isLittleEndian = byteAlign === LITTLE_ENDIAN_BYTE_ALIGN;
    if (isBigEndian || isLittleEndian) {
        return extractOrientation(exifBlock, isBigEndian);
    }
}

function validateInput(input: Uint8Array, index: number): void {
    if (index > input.length) {
        throw new TypeError('Corrupt JPG, exceeded buffer limits');
    }
}

export const JPG: ImageData = {
    validate: (input) => toHexString(input, 0, 2) === 'ffd8',

    calculate(_input) {
        let input = _input.slice(4);
        let orientation: number | undefined;
        let next: number;
        while(input.length) {
            const i = readUInt16BE(input, 0);
            if (input[i] !== 0xff) {
                input = input.slice(1);
                continue;
            }
            if(isEXIF(input)) {
                orientation = validateExifBlock(input, i);
            }
            validateInput(input, i);
            next = input[i + 1];
            if (next === 0xc0 || next === 0xc1 || next === 0xc2) {
                const size = extractSize(input, i + 5);
                if (!orientation) {
                    return size;
                }
                return {
                    height: size.height,
                    orientation,
                    width: size.width,
                }
            }
            input = input.slice(i + 2);
        }
        throw new TypeError('Invalid JPG, no size found');
    },
};