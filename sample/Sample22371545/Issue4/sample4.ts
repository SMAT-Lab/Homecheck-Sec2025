function hello(name, day) {
    console.log("Hello!\n" + name);
    return;
}

function bye(name, day) {
    console.log("Bye!\nDay: " + day);
    return;
}

function main() {
    let name = "the defect";
    let day = 7;
    hello(name, day);
    bye(name, day);
    return;
}