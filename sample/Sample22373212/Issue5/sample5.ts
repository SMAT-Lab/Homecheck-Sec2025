let url = new URL(window.location.href);
let redirect = url.searchParams.get("redirect");
// 不做任何校验就重定向
if (redirect) window.location.href = redirect;

