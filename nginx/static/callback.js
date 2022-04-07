$(document).ready(()=> {
    let url = new URL(window.location.href);
    let code = url.searchParams.get('code');
    console.log(`Code -> ${code}`);

    axios({
        method : "GET",
        url : "http://localhost:8888/oauth2callback?code=" + code
    });
});