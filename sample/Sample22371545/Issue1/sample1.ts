// read null variable
function cal(num1) {
    const times = null;
    const res = num1 * times;
    return res;
}

function main() {
    const num1 = 1;
    const possiblyNull = null;
    cal(num1);
    const len1 = num1 + 1;
    const len2 = possiblyNull + 1;
}
