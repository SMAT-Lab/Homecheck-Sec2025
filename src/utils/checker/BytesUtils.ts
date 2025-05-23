const decoder = new TextDecoder();
export const toUTF8String = (
    input: Uint8Array,
    start = 0,
    end = input.length
): string => decoder.decode(input.slice(start, end));

export const toHexString = (
    input: Uint8Array,
    start = 0,
    end = input.length
): string => input.slice(start, end).reduce((memo, i) => memo + `0${i.toString(16)}`.slice(-2), '');

const getView = (
    input: Uint8Array,
    offset: number
) => new DataView(input.buffer, input.byteOffset + offset);

export const readInt16LE = (input: Uint8Array, offset = 0): number =>
    getView(input, offset).getInt16(0, true);

export const readUInt16BE = (input: Uint8Array, offset = 0): number =>
    getView(input, offset).getUint16(0, false);

export const readUInt16LE = (input: Uint8Array, offset = 0): number =>
    getView(input, offset).getUint16(0, true);

export const readUInt24LE = (input: Uint8Array, offset = 0): number => {
    const view = getView(input, offset);
    return view.getUint16(0, true) + (view.getUint8(2) << 16);
};

export const readInt32LE = (input: Uint8Array, offset = 0): number =>
    getView(input, offset).getInt32(0, true);

export const readUInt32BE = (input: Uint8Array, offset = 0): number =>
    getView(input, offset).getUint32(0, false);

export const readUInt32LE = (input: Uint8Array, offset = 0): number =>
    getView(input, offset).getUint32(0, true);

export const readUInt64 = (
    input: Uint8Array,
    offset: number,
    isBigEndian: boolean
): bigint => getView(input, offset).getBigUint64(0, !isBigEndian);

const methods = {
    readUInt16BE,
    readUInt16LE,
    readUInt32BE,
    readUInt32LE
} as const;

type MethodName = keyof typeof methods;

export function readUInt(
    input: Uint8Array,
    bits: 16 | 32,
    offset = 0,
    isBigEndian = false
): number {
    const endian = isBigEndian ? 'BE' : 'LE';
    const methodName = `readUInt${bits}${endian}` as MethodName;
    return methods[methodName](input, offset);
}

const INCH_CM = 2.54;

const units: Record<string, number> = {
    in: 96,
    cm: 96 / INCH_CM,
    em: 16,
    ex: 8,
    m: (96 / INCH_CM) * 100,
    mm: 96 / INCH_CM / 10,
    pc: 96 / 72 / 12,
    pt: 96 / 72,
    px: 1,
};
const unitsReg = new RegExp(`^([0-9.]+(?:e\\d+)?)(${Object.keys(units).join('|')})?$`,);

export function getLength(len: string): number | undefined {
    const m = unitsReg.exec(len);
    if (!m) {
        return undefined;
    }
    return Math.round(Number(m[1]) * (units[m[2]] || 1));
}
