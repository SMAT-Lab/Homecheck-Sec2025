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

import type { ImageInfo, ImageData, IAttributes } from '../../../model/Interfaces';
import { toUTF8String, getLength } from '../BytesUtils';

const svgReg = /<svg\s([^>"']|"[^"]*"|'[^']*')*>/;
const extractorRegExps = {
    root: svgReg,
    height: /\sheight=(['"])([^%]+?)\1/,
    width: /\swidth=(['"])([^%]+?)\1/,
    viewbox: /\sviewbox=(['"])(.+?)\1/i,
};

function parseViewbox(viewbox: string): IAttributes | undefined {
    const bounds = viewbox.split(' ');
    let tmpWeight = getLength(bounds[3]);
    let tmpWidth = getLength(bounds[2]);
    if(tmpWidth && tmpWeight) {
        return {height: tmpWeight, width: tmpWidth};
    }
    return undefined;
}

function getAttirbutes(root: string): IAttributes | undefined {
    const widths = root.match(extractorRegExps.width);
    const heights = root.match(extractorRegExps.height);
    const viewbox = root.match(extractorRegExps.viewbox);
    if (widths && heights && viewbox) {
        let tempHeight = getLength(heights[2]);
        let tmpWidth = getLength(widths[2]);
        if (tmpWidth && tempHeight) {
            return {
                height: heights && tempHeight,
                viewbox: viewbox && parseViewbox(viewbox[2]),
                width: widths && tmpWidth,
            }
        }
    }
    return undefined;
}

function calculateByDimensions(attrs: IAttributes): ImageInfo {
    return {
        height: attrs.height as number,
        width: attrs.width as number,
    }
}

function calculateByViewbox(attrs: IAttributes, viewbox: IAttributes): ImageInfo {
    const ratio = (viewbox.width as number) / (viewbox.height as number);
    if (attrs.height) {
        return {
            height: attrs.height,
            width: Math.floor(attrs.height * ratio)
        }
    } else if (attrs.width) {
        return {
            height: Math.floor(attrs.width * ratio),
            width: attrs.width,
        }
    } else {
        return {
            height: viewbox.height as number,
            width: viewbox.width as number,
        }
    }
}

export const SVG: ImageData = {
    validate: (input) => svgReg.test(toUTF8String(input, 0, 1000)),

    calculate(input) {
        const root = toUTF8String(input).match(extractorRegExps.root);
        if (root) {
            const attrs = getAttirbutes(root[0]);
            if (attrs) {
                if (attrs.width && attrs.height) {
                    return calculateByDimensions(attrs);
                }
                if (attrs.viewbox) {
                    return calculateByViewbox(attrs, attrs.viewbox);
                }
            }
        }
        throw new TypeError('Invalid SVG');
    },
};